#!/bin/bash
# ============================================================================
# Financial Advisor — Deploy to AgentCore
# ============================================================================
# Deploys the agent to AWS Bedrock AgentCore and updates the frontend config.
#
# Prerequisites:
#   - setup.sh has been run successfully
#   - .venv is activated
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGION="us-east-1"

echo "============================================"
echo "  Financial Advisor — Deploy to AgentCore"
echo "============================================"
echo ""

PYTHON_BIN="/e/GenAi-Project-Cloudage/StrandsMultiAgent/.venv/Scripts/python.exe"

cd "$PROJECT_DIR"

# Get AWS account
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $AWS_ACCOUNT"
echo "Region: $REGION"
echo ""

# ----------------------------------------------------------------------------
# Step 1: Build and Deploy via AgentCore Starter Toolkit
# ----------------------------------------------------------------------------
echo "━━━ Step 1: Deploying agent to AgentCore ━━━"

# Use the starter toolkit to deploy
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 $PYTHON_BIN -c "
from bedrock_agentcore_starter_toolkit import Runtime
runtime = Runtime()
runtime.configure(
    entrypoint='main.py',
    execution_role='arn:aws:iam::$AWS_ACCOUNT:role/AmazonBedrockAgentCoreSDKRuntime-$REGION',
    auto_create_execution_role=False,
    auto_create_ecr=True,
    requirements_file='requirements.txt',
    region='$REGION',
    agent_name='personal_finance_agent',
)
result = runtime.launch()
print(f'Agent ARN: {result.agent_arn}')
print(f'Agent ID: {result.agent_id}')
" 2>&1 | tee /tmp/deploy_output.txt

# Extract the runtime ARN
AGENT_ARN=$(grep "Agent ARN:" /tmp/deploy_output.txt | awk '{print $NF}' || echo "")
AGENT_ID=$(grep "Agent ID:" /tmp/deploy_output.txt | awk '{print $NF}' || echo "")

if [ -z "$AGENT_ARN" ]; then
    echo "⚠️  Could not extract agent ARN from deployment output."
    echo "  Check the output above and update frontend/.env.local manually."
    echo ""
    echo "  Expected format for NEXT_PUBLIC_AGENTCORE_ENDPOINT:"
    echo "  https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/{URL_ENCODED_ARN}/invocations"
    exit 1
fi

echo ""
echo "✓ Agent deployed successfully"
echo "  ARN: $AGENT_ARN"
echo "  ID: $AGENT_ID"

# ----------------------------------------------------------------------------
# Step 2: Update Frontend Config
# ----------------------------------------------------------------------------
echo ""
echo "━━━ Step 2: Updating frontend configuration ━━━"

# URL-encode the ARN
ENCODED_ARN=$(PYTHONUTF8=1 PYTHONIOENCODING=utf-8 $PYTHON_BIN -c "import urllib.parse; print(urllib.parse.quote('$AGENT_ARN', safe=''))")

# Always read Cognito values dynamically from AWS (not from .env.local)
# This prevents stale pool ID errors when setup.sh creates a new pool
COGNITO_VALUES=$(PYTHONUTF8=1 PYTHONIOENCODING=utf-8 $PYTHON_BIN -c "
import boto3, json
cognito = boto3.client('cognito-idp', region_name='$REGION')
pools = cognito.list_user_pools(MaxResults=20)
for pool in pools['UserPools']:
    if pool['Name'] == 'agentpool':
        pool_id = pool['Id']
        clients = cognito.list_user_pool_clients(UserPoolId=pool_id, MaxResults=10)
        client_id = clients['UserPoolClients'][0]['ClientId']
        print(json.dumps({'pool_id': pool_id, 'client_id': client_id}))
        break
")

POOL_ID=$(echo "$COGNITO_VALUES" | $PYTHON_BIN -c "import sys,json; print(json.load(sys.stdin)['pool_id'])")
CLIENT_ID=$(echo "$COGNITO_VALUES" | $PYTHON_BIN -c "import sys,json; print(json.load(sys.stdin)['client_id'])")

echo "  Cognito Pool:   $POOL_ID"
echo "  Cognito Client: $CLIENT_ID"

# Write updated .env.local with fresh Cognito values
cat > "$PROJECT_DIR/frontend/.env.local" << EOF
# AgentCore Runtime Endpoint
NEXT_PUBLIC_AGENTCORE_ENDPOINT=https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/$ENCODED_ARN/invocations

# Cognito configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=$REGION
EOF

echo "✓ Frontend .env.local updated with runtime endpoint and fresh Cognito values"

# ----------------------------------------------------------------------------
# Step 2.5: Configure Cognito JWT Authorizer on the Runtime
# ----------------------------------------------------------------------------
echo ""
echo "━━━ Step 2.5: Configuring JWT authorization ━━━"

PYTHONUTF8=1 PYTHONIOENCODING=utf-8 $PYTHON_BIN -c "
import boto3, time

region = '$REGION'
runtime_id = '$AGENT_ID'
pool_id = '$POOL_ID'
client_id = '$CLIENT_ID'

if not pool_id:
    print('⚠️  Cognito pool not found — skipping JWT config')
    exit(0)

discovery_url = f'https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/openid-configuration'

# Get current runtime config
agentcore = boto3.client('bedrock-agentcore-control', region_name=region)
r = agentcore.get_agent_runtime(agentRuntimeId=runtime_id)

# Update with JWT authorizer
agentcore.update_agent_runtime(
    agentRuntimeId=runtime_id,
    agentRuntimeArtifact=r['agentRuntimeArtifact'],
    roleArn=r['roleArn'],
    networkConfiguration=r['networkConfiguration'],
    authorizerConfiguration={
        'customJWTAuthorizer': {
            'allowedClients': [client_id],
            'discoveryUrl': discovery_url
        }
    }
)
time.sleep(5)
print(f'✓ JWT authorizer configured')
print(f'  Pool ID:   {pool_id}')
print(f'  Client ID: {client_id}')
" 2>&1 || echo "⚠️  JWT config skipped — configure manually if needed"

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  ✅ Deployment Complete!"
echo "============================================"
echo ""
echo "Agent Runtime: $AGENT_ID"
echo "Endpoint: https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/$ENCODED_ARN/invocations"
echo ""

# ----------------------------------------------------------------------------
# Print Login Credentials
# ----------------------------------------------------------------------------
echo "━━━ Login Credentials ━━━"
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 $PYTHON_BIN -c "
import boto3, json

region = '$REGION'
pool_id = '$POOL_ID'

# Try Secrets Manager first
try:
    sm = boto3.client('secretsmanager', region_name=region)
    secrets = sm.list_secrets(Filters=[{'Key':'name','Values':['agentcore-project-credentials']}])
    for s in secrets['SecretList']:
        if not s.get('DeletedDate'):
            val = sm.get_secret_value(SecretId=s['Name'])
            data = json.loads(val['SecretString'])
            if data.get('username') and data.get('password') and data.get('pool_id') == pool_id:
                print('Username:', data['username'])
                print('Password:', data['password'])
                exit(0)
except Exception:
    pass

# Fall back: get username from Cognito, use fixed password
cognito = boto3.client('cognito-idp', region_name=region)
users = cognito.list_users(UserPoolId=pool_id)
if users['Users']:
    username = users['Users'][0]['Username']
    # Set a known password
    new_pw = 'NovaMind@2026!AI'
    cognito.admin_set_user_password(
        UserPoolId=pool_id,
        Username=username,
        Password=new_pw,
        Permanent=True
    )
    print('Username:', username)
    print('Password:', new_pw)
" 2>&1 || echo "  Run the credentials command in steps_to_do_final.md to get credentials"

echo ""
echo "Next step: Deploy frontend to Amplify"
echo "  ./deploy-frontend.sh"
echo ""
