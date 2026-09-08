# Deployment Guide — Financial Advisor Multi-Agent AI Platform

**Project:** AI-powered multi-agent financial advisor (Budget + Investment analysis)  
**Stack:** Python 3.12 · Strands Agents SDK · Amazon Bedrock AgentCore · Next.js 12 · AWS  
**Region:** `us-east-1`  
**Account:** `637423369471`  
**IAM User:** `mlops-user`

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [End-to-End Application Flow](#2-end-to-end-application-flow)
3. [AWS Services Used](#3-aws-services-used)
4. [Deployment Prerequisites](#4-deployment-prerequisites)
5. [Pre-Deployment Checklist](#5-pre-deployment-checklist)
6. [WAY 1 — Manual Step-by-Step (RECOMMENDED)](#6-way-1--manual-step-by-step-recommended)
7. [WAY 2 — Jupyter Notebook Approach](#7-way-2--jupyter-notebook-approach)
8. [WAY 3 — Shell Scripts via WSL](#8-way-3--shell-scripts-via-wsl)
9. [Deployment Method Comparison](#9-deployment-method-comparison)
10. [Post-Deployment Verification](#10-post-deployment-verification)
11. [Testing the Application](#11-testing-the-application)
12. [Troubleshooting](#12-troubleshooting)
13. [Cleanup — Before Redeployment](#13-cleanup--before-redeployment)
14. [Cleanup — Final / Delete Everything](#14-cleanup--final--delete-everything)
15. [Known Issues and Deployment Blockers](#15-known-issues-and-deployment-blockers)

---

## 1. What This Project Does

This is a **production-grade multi-agent AI financial advisor** deployed on Amazon Bedrock AgentCore Runtime. Users interact through a Next.js chat UI hosted on AWS Amplify. Their messages are authenticated via Amazon Cognito and streamed to an orchestrator agent running in a serverless ARM64 container on AgentCore.

The orchestrator routes queries to two specialist agents:

- **Budget Agent** — 50/30/20 rule budgeting, spending analysis, chart generation, Pydantic structured output
- **Financial Analysis Agent** — real-time stock data via yfinance, portfolio recommendations (conservative/moderate/aggressive), stock performance comparison

Conversation memory persists across sessions using AgentCore Memory (semantic, preference, and summary strategies). A Bedrock Guardrail blocks Bitcoin/crypto investment advice.

---

## 2. End-to-End Application Flow

```
User opens https://main.{app_id}.amplifyapp.com
  │
  ▼
Login page (Next.js)
  │  POST to https://cognito-idp.us-east-1.amazonaws.com/
  │  AuthFlow: USER_PASSWORD_AUTH
  │  Returns: JWT AccessToken (stored in localStorage)
  │
  ▼
Chat interface
  │  POST https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT
  │  Headers: Authorization: Bearer {jwt}, X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: {36-char UUID}
  │  Body: { prompt, session_id, actor_id }
  │
  ▼
AgentCore Runtime (ARM64 container, us-east-1)
  │  → main.py @app.entrypoint async def invoke(payload)
  │  → Queries AgentCore Memory for prior context (AGENTCORE_MEMORY_ID env var)
  │  → Orchestrator agent routes to sub-agent(s)
  │
  ├── Budget queries → budget_agent_tool(query)
  │     → budget_agent.structured_output(FinancialReport)
  │     → Tools: calculate_budget, create_financial_chart, calculator
  │
  └── Investment queries → financial_analysis_agent_tool(query)
        → financial_analysis_agent(query)
        → Tools: get_stock_analysis (yfinance), create_diversified_portfolio, compare_stock_performance
  │
  ▼
Streaming SSE response chunks → frontend strips <thinking> tags → renders markdown
  │
  ▼
After response: memory_client.create_event() stores conversation for next session
```

---

## 3. AWS Services Used

| Service | Purpose | Resource Name |
|---------|---------|--------------|
| **Bedrock AgentCore Runtime** | Hosts the agent container | `personal_finance_agent-{id}` |
| **Bedrock AgentCore Memory** | Cross-session conversation memory | `FinancialAdvisorMemory-{id}` |
| **Amazon Bedrock** | LLM inference (Nova Pro) + Guardrails | `guardrail-no-bitcoin-advice` |
| **Amazon ECR** | Container image registry | `bedrock-agentcore-personal_finance_agent` |
| **AWS CodeBuild** | ARM64 container build (no Docker required) | `bedrock-agentcore-personal_finance_agent-builder` |
| **Amazon S3** | CodeBuild source artifacts | `bedrock-agentcore-codebuild-sources-637423369471-us-east-1` |
| **Amazon Cognito** | JWT authentication | User pool `agentpool` |
| **AWS Secrets Manager** | Stores Cognito credentials | `agentcore-project-credentials-{hex}` |
| **AWS IAM** | Execution roles | `AmazonBedrockAgentCoreSDKRuntime-us-east-1`, `AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-{hash}` |
| **AWS Amplify** | Frontend static hosting | `finance-advisor-ui` |
| **Amazon CloudWatch** | Agent logs and observability | `/aws/bedrock-agentcore/runtimes/{agent_id}-DEFAULT` |

**No CloudFormation, CDK, or Terraform is used.** All resources are created imperatively via the Python SDK (`bedrock-agentcore-starter-toolkit`) and AWS CLI.

---

## 4. Deployment Prerequisites

### Must Exist BEFORE Deployment

| Requirement | Details | How to Verify |
|------------|---------|--------------|
| AWS Account | Account ID `637423369471` | `aws sts get-caller-identity` |
| IAM User | `mlops-user` with AdministratorAccess (or permissions listed below) | `aws iam get-user --user-name mlops-user` |
| AWS CLI v2 | Configured with `us-east-1`, access key for `mlops-user` | `aws configure list` |
| Amazon Nova Pro model access | **Must be manually enabled in Bedrock console** | AWS Console → Bedrock → Model access → Enable `amazon.nova-pro-v1:0` |
| Python 3.12 | Installed and on PATH | `python --version` or `python3 --version` |
| pip | For installing Python dependencies | `pip --version` |
| Node.js v18+ | For building the Next.js frontend | `node --version` |
| npm | Comes with Node.js | `npm --version` |
| Git | For cloning/working with the repo | `git --version` |
| Internet access | yfinance fetches live stock data; CodeBuild pulls from GitHub container registry | — |

### IAM Permissions Required for `mlops-user`

The deployment creates and manages resources across these services. The user needs permissions for:

```
bedrock:*
bedrock-agentcore:*
iam:CreateRole, AttachRolePolicy, DetachRolePolicy, DeleteRole, GetRole, ListRoles,
    ListRolePolicies, DeleteRolePolicy, PutRolePolicy, UpdateAssumeRolePolicy
cognito-idp:*
secretsmanager:*
ecr:*
codebuild:*
s3:*
amplify:*
sts:GetCallerIdentity
logs:*
codecommit:DeleteRepository  (cleanup only)
```

Using `AdministratorAccess` covers all of the above.

### Created DURING Deployment (do not pre-create these)

- IAM role `AmazonBedrockAgentCoreSDKRuntime-us-east-1`
- IAM role `AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-{hash}`
- ECR repository `bedrock-agentcore-personal_finance_agent`
- CodeBuild project `bedrock-agentcore-personal_finance_agent-builder`
- S3 bucket `bedrock-agentcore-codebuild-sources-637423369471-us-east-1`
- Cognito User Pool `agentpool` + App Client + User
- Secrets Manager secret `agentcore-project-credentials-{hex}`
- Bedrock Guardrail `guardrail-no-bitcoin-advice`
- AgentCore Runtime `personal_finance_agent-{id}`
- AgentCore Memory `FinancialAdvisorMemory-{id}` *(Way 2 only)*
- Amplify app `finance-advisor-ui`

---

## 5. Pre-Deployment Checklist

Work through this checklist before running any deployment command.

```
AWS Account & Access
[ ] AWS CLI installed (aws --version shows v2.x)
[ ] aws configure done: region=us-east-1, access key for mlops-user set
[ ] aws sts get-caller-identity returns account 637423369471 and mlops-user ARN
[ ] IAM user has required permissions (AdministratorAccess recommended for POC)

Amazon Bedrock
[ ] Logged into AWS Console in us-east-1
[ ] Bedrock → Model access → amazon.nova-pro-v1:0 shows "Access granted"
     (If not: click Request model access → select Amazon Nova Pro → Save changes)
     (This can take a few minutes to activate)

Python Environment
[ ] Python 3.12 installed: python --version  (must be 3.12.x)
[ ] pip available: pip --version
[ ] You are in the SourceCode directory: cd SourceCode

Node.js / Frontend
[ ] Node.js v18+: node --version
[ ] npm available: npm --version

Source Code
[ ] You are working from: SourceCode/ directory
[ ] main.py, budget_agent.py, financial_analysis_agent.py all present
[ ] utils/ directory present with __init__.py, agentcore_utils.py, guardrail.py
[ ] frontend/ directory present with package.json
[ ] requirements.txt present
[ ] Dockerfile present

Existing Resources (check before first deploy)
[ ] No existing Cognito pool named "agentpool" in us-east-1 (or intentionally reusing)
[ ] No existing Bedrock Guardrail named "guardrail-no-bitcoin-advice" (or intentionally reusing)
[ ] No existing AgentCore Runtime named "personal_finance_agent" (or intentionally updating)
```

---

## 6. WAY 1 — Manual Step-by-Step (RECOMMENDED)

> **Why recommended:** `setup.sh` and `deploy.sh` contain hardcoded Windows/WSL paths (`/mnt/e/GenAi-Project-Cloudage/...`) that will fail on any machine other than the original developer's. This manual approach executes the same logic using portable commands that work on any machine.

**Shell environment guidance:**
- Steps marked **[PowerShell]** run in Windows PowerShell or Command Prompt
- Steps marked **[Git Bash]** require Git Bash (install from https://git-scm.com)
- Steps marked **[Python]** are Python one-liners or scripts, run in PowerShell after activating the venv

---

### Phase 1 — Python Environment Setup

**[PowerShell]** — Run from `SourceCode/` directory

```powershell
# Navigate to the SourceCode directory
cd "e:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode"

# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# If you get an execution policy error, run first:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install all Python dependencies (pinned versions from requirements.txt)
pip install -r requirements.txt

# Verify key packages installed
python -c "import strands; import bedrock_agentcore; import boto3; print('OK')"
```

---

### Phase 2 — Verify AWS Configuration

**[PowerShell]**

```powershell
# Confirm identity
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDAZI2LEXT76SSX35I2Q",
#     "Account": "637423369471",
#     "Arn": "arn:aws:iam::637423369471:user/mlops-user"
# }

# Confirm region
aws configure get region
# Expected: us-east-1

# If region is wrong:
aws configure set region us-east-1
```

---

### Phase 3 — Create IAM Execution Role

**[PowerShell]** — This role allows AgentCore to run your container.

```powershell
# Set variables
$REGION = "us-east-1"
$ROLE_NAME = "AmazonBedrockAgentCoreSDKRuntime-$REGION"

# Check if role already exists
aws iam get-role --role-name $ROLE_NAME 2>$null
# If it returns a role, skip to "Attach policies" below

# Create the role (trust policy allows bedrock-agentcore service to assume it)
$TRUST_POLICY = '{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "bedrock-agentcore.amazonaws.com"},
        "Action": "sts:AssumeRole"
    }]
}'

aws iam create-role `
    --role-name $ROLE_NAME `
    --assume-role-policy-document $TRUST_POLICY

# Attach required policies
aws iam attach-role-policy --role-name $ROLE_NAME `
    --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

aws iam attach-role-policy --role-name $ROLE_NAME `
    --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess

aws iam attach-role-policy --role-name $ROLE_NAME `
    --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

# Wait 10 seconds for IAM propagation before deploying
Start-Sleep -Seconds 10

Write-Host "IAM role ready: $ROLE_NAME"
```

---

### Phase 4 — Create Bedrock Guardrail

**[PowerShell]** — With venv activated, run from `SourceCode/`

```powershell
python -c "
from utils.guardrail import create_guardrail
result = create_guardrail()
if result:
    print(f'Guardrail ready — ID: {result[0]}, ARN: {result[1]}')
else:
    print('Guardrail already exists or error occurred')
"
```

Expected output:
```
Guardrail 'guardrail-no-bitcoin-advice' already exists. Returning existing guardrail.
```
or:
```
Creating new guardrail 'guardrail-no-bitcoin-advice'...
Guardrail ready — ID: abc123xyz, ARN: arn:aws:bedrock:...
```

---

### Phase 5 — Create Cognito User Pool

**[PowerShell]** — With venv activated, run from `SourceCode/`

```powershell
python -c "
import json
from utils.agentcore_utils import setup_cognito_user_pool
result = setup_cognito_user_pool()
if result:
    print('SAVE THESE VALUES:')
    print(f'  Pool ID:   {result[\"pool_id\"]}')
    print(f'  Client ID: {result[\"client_id\"]}')
    print(f'  Username:  {result[\"username\"]}')
    print(f'  Secret:    {result[\"secret_name\"]}')
    print(f'  Discovery: {result[\"discovery_url\"]}')
"
```

> ⚠️ **Save the output immediately.** The password is stored in Secrets Manager and not shown again. The Pool ID, Client ID, and discovery URL are needed for the next steps.

If Cognito already exists (redeployment), retrieve existing credentials:

```powershell
python -c "
from utils.agentcore_utils import retrieve_credentials_from_secrets_manager
creds = retrieve_credentials_from_secrets_manager()
print(creds)
"
```

---

### Phase 6 — Update Frontend Environment Config

**[PowerShell]** — Replace the values with your actual Cognito output from Phase 5.

```powershell
# Edit frontend/.env.local — leave AGENTCORE_ENDPOINT blank for now (set after deploy)
$POOL_ID = "us-east-1_XXXXXXXXX"    # Replace with your Pool ID
$CLIENT_ID = "your-client-id"        # Replace with your Client ID
$REGION = "us-east-1"

$envContent = @"
# AgentCore Runtime Endpoint (populated after backend deploy)
NEXT_PUBLIC_AGENTCORE_ENDPOINT=

# Cognito configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=$REGION
"@

Set-Content -Path "frontend\.env.local" -Value $envContent
Write-Host "frontend/.env.local updated"
```

---

### Phase 7 — Install Frontend Dependencies

**[PowerShell]**

```powershell
cd frontend
npm install
cd ..
Write-Host "Frontend dependencies installed"
```

---

### Phase 8 — Deploy Agent to AgentCore Runtime

**[PowerShell]** — With venv activated, run from `SourceCode/`. This is the main deployment step. It triggers a CodeBuild ARM64 build and deploys the container to AgentCore. **Expect 3–10 minutes.**

```powershell
$REGION = "us-east-1"
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$EXECUTION_ROLE = "arn:aws:iam::${ACCOUNT_ID}:role/AmazonBedrockAgentCoreSDKRuntime-${REGION}"

Write-Host "Deploying to AgentCore Runtime..."
Write-Host "Execution Role: $EXECUTION_ROLE"

python -c "
from bedrock_agentcore_starter_toolkit import Runtime

runtime = Runtime()

# Configure the deployment
runtime.configure(
    entrypoint='main.py',
    execution_role='$EXECUTION_ROLE',
    auto_create_execution_role=False,
    auto_create_ecr=True,
    requirements_file='requirements.txt',
    region='$REGION',
    agent_name='personal_finance_agent',
)

print('Configuration complete. Launching...')

# Launch — triggers CodeBuild, creates ECR repo, deploys to AgentCore
result = runtime.launch()

print(f'Agent ARN: {result.agent_arn}')
print(f'Agent ID:  {result.agent_id}')
"
```

> **What happens during launch:**
> 1. SDK creates ECR repository `bedrock-agentcore-personal_finance_agent`
> 2. Creates CodeBuild role `AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-{hash}`
> 3. Creates S3 bucket for source artifacts
> 4. Zips your source code, uploads to S3
> 5. Runs CodeBuild to build ARM64 Docker image (~52 seconds)
> 6. Pushes image to ECR
> 7. Creates/updates AgentCore Runtime (`personal_finance_agent-{id}`)
> 8. Polls until runtime status is `READY`

> **Platform warning is normal:** You may see `⚠️ Platform mismatch: linux/amd64 vs linux/arm64`. This is expected — CodeBuild builds the image for ARM64 automatically.

---

### Phase 9 — Update Frontend with Agent Endpoint

After Phase 8 completes, you will have an Agent ARN. URL-encode it and update `.env.local`.

**[PowerShell]** — Replace `AGENT_ARN` with the actual ARN from Phase 8 output.

```powershell
$AGENT_ARN = "arn:aws:bedrock-agentcore:us-east-1:637423369471:runtime/personal_finance_agent-XXXXXXXX"
$REGION = "us-east-1"

# URL-encode the ARN
$ENCODED_ARN = python -c "import urllib.parse; print(urllib.parse.quote('$AGENT_ARN', safe=''))"

$ENDPOINT = "https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/$ENCODED_ARN/invocations"
Write-Host "Endpoint: $ENDPOINT"

# Read existing Cognito config from .env.local
$POOL_ID = (Get-Content "frontend\.env.local" | Where-Object { $_ -match "COGNITO_USER_POOL_ID" }) -replace ".*=", ""
$CLIENT_ID = (Get-Content "frontend\.env.local" | Where-Object { $_ -match "COGNITO_CLIENT_ID" }) -replace ".*=", ""

# Write updated .env.local
$envContent = @"
# AgentCore Runtime Endpoint
NEXT_PUBLIC_AGENTCORE_ENDPOINT=$ENDPOINT

# Cognito configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=$REGION
"@

Set-Content -Path "frontend\.env.local" -Value $envContent
Write-Host "frontend/.env.local updated with endpoint"
```

---

### Phase 10 — Build and Deploy Frontend to Amplify

**[PowerShell]** — With venv activated, run from `SourceCode/`. This builds the Next.js static site and uploads it to AWS Amplify.

```powershell
# Step 1: Build the frontend
cd frontend
npm run build

# Step 2: Export as static files (required — next.config.js does NOT have output:'export')
npx next export

# This creates frontend/out/ containing all static HTML/CSS/JS
cd ..

# Step 3: Deploy to Amplify via Python
python -c "
import boto3, zipfile, os, requests, sys, time

region = 'us-east-1'
app_name = 'finance-advisor-ui'
out_dir = 'frontend/out'

client = boto3.client('amplify', region_name=region)

# Find or create the Amplify app
apps = client.list_apps()
app_id = None
for app in apps.get('apps', []):
    if app['name'] == app_name:
        app_id = app['appId']
        print(f'Using existing Amplify app: {app_id}')
        break

if not app_id:
    response = client.create_app(
        name=app_name,
        platform='WEB',
        customRules=[
            {'source': '/<*>', 'target': '/index.html', 'status': '404-200'}
        ]
    )
    app_id = response['app']['appId']
    client.create_branch(appId=app_id, branchName='main')
    print(f'Created Amplify app: {app_id}')

# Create deployment
deploy = client.create_deployment(appId=app_id, branchName='main')
upload_url = deploy['zipUploadUrl']
job_id = deploy['jobId']

# Zip the out/ directory
zip_path = 'amplify-frontend.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(out_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, out_dir)
            zf.write(file_path, arcname)
print(f'Zip created: {os.path.getsize(zip_path) / 1024:.1f} KB')

# Upload zip
resp = requests.put(upload_url, data=open(zip_path, 'rb'))
if resp.status_code != 200:
    print(f'Upload failed: {resp.status_code}')
    sys.exit(1)
print('Artifacts uploaded')

# Start deployment and poll
client.start_deployment(appId=app_id, branchName='main', jobId=job_id)
status = 'PENDING'
while status in ('PENDING', 'RUNNING'):
    time.sleep(10)
    job = client.get_job(appId=app_id, branchName='main', jobId=job_id)
    status = job['job']['summary']['status']
    print(f'  Status: {status}')

if status == 'SUCCEED':
    print(f'')
    print(f'Frontend live at: https://main.{app_id}.amplifyapp.com')
else:
    print(f'Deployment failed: {status}')
    sys.exit(1)
"
```

---

### Phase 11 — Retrieve Login Credentials

**[PowerShell]** — With venv activated

```powershell
python -c "
from utils.agentcore_utils import retrieve_credentials_from_secrets_manager
creds = retrieve_credentials_from_secrets_manager()
if creds:
    print(f'Username: {creds[\"username\"]}')
    print(f'Password: {creds[\"password\"]}')
    print(f'Pool ID:  {creds[\"pool_id\"]}')
"
```

Use these credentials to log into the frontend at the Amplify URL.

---

### Phase 12 — Optional: Test Locally Before Deploying to Amplify

If you want to test the frontend against the deployed AgentCore endpoint locally:

**[PowerShell]**

```powershell
cd frontend
npm run dev -- -p 3001
# Open http://localhost:3001
```

---

## 7. WAY 2 — Jupyter Notebook Approach

> **When to use:** Best for step-by-step learning, demos, and when you want full control over each resource created. This is the **most complete** method — it is the only way that configures AgentCore Memory and Cognito JWT authorization on the runtime itself.

### Prerequisites

#### Step 1 — Create the Virtual Environment

**[PowerShell]** — Run once. Skip if `.venv` already exists in `SourceCode/`.

```powershell
# Go to SourceCode directory
cd "e:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode"

# Create virtual environment (creates .venv/ folder)
python -m venv .venv
```

---

#### Step 2 — Activate the Virtual Environment

**[PowerShell]** — Run every time you open a new terminal.

```powershell
.\.venv\Scripts\Activate.ps1
```

Your prompt should now show `(.venv)` at the start:
```
(.venv) PS E:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode>
```

> If you get `cannot be loaded because running scripts is disabled`, run this first then retry:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

---

#### Step 3 — Install Project Dependencies

**[PowerShell]** — With `(.venv)` active. Takes a few minutes (~80 packages).

```powershell
pip install -r requirements.txt
```

Verify key packages installed:
```powershell
python -c "import strands; import bedrock_agentcore; import boto3; print('OK')"
```

---

#### Step 4 — Install Jupyter Inside the Virtual Environment

**[PowerShell]** — With `(.venv)` active.

```powershell
pip install notebook jupyterlab --timeout 300 --retries 10
# pip install notebook jupyterlab
```

Verify:
```powershell
jupyter --version
```

---

#### Step 5 — Launch Jupyter from SourceCode/

**[PowerShell]** — With `(.venv)` active, from `SourceCode/` directory.

```powershell
jupyter lab
```

This opens Jupyter in your browser at `http://localhost:8888`.

> ⚠️ **Must launch from `SourceCode/`** — the notebooks use relative imports like
> `from utils.guardrail import create_guardrail`. If you launch from a different
> directory, every import cell will fail with `ModuleNotFoundError`.

---

#### Full Setup in One Go (fresh machine)

```powershell
cd "e:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install notebook jupyterlab
jupyter lab
```

### Notebook Execution Order

Run the notebooks in this exact sequence:

| Step | Notebook | What It Does |
|------|----------|-------------|
| 1 | `AWS_SingleAgent.ipynb` | Build and test the budget agent locally |
| 2 | `AWS_MultiAgent.ipynb` | Add the financial analysis agent and orchestrator |
| 3 | `AWS_Deployment.ipynb` | Full production deployment to AgentCore |
| 4 | `AWS_CleanUp.ipynb` | Remove all resources when done |

### AWS_Deployment.ipynb — Cell-by-Cell Guide

Open `AWS_Deployment.ipynb` and run cells in order:

1. **Cell 1** — `pip install -r requirements.txt` (may take a few minutes)
2. **Cell 2** — Import statements
3. **Cell 3** — Initialize boto3 session, confirm region
4. **Cell 4** — Print region (verify it shows `us-east-1`)
5. **Cell 5** — Create IAM role `AmazonBedrockAgentCoreSDKRuntime-us-east-1` with correct trust policy and 3 attached policies. **Wait 10 seconds after this cell before running the deploy cell.**
6. **Cell 6** — `setup_cognito_user_pool()` — creates User Pool, App Client, user, and stores credentials in Secrets Manager. **⚠️ Save the displayed credentials immediately.**
7. **Cell 7** — Build `auth_config` dict with `customJWTAuthorizer` using the Cognito `client_id` and `discovery_url`
8. **Cell 8** — Import `MemoryClient`, define 3 memory strategies (semantic / user_preference / summary)
9. **Cell 9** — `memory_client.create_memory_and_wait(name='FinancialAdvisorMemory', ...)` — creates AgentCore Memory with `event_expiry_days=90`. **This can take several minutes.**
10. **Cell 10** — `Runtime().configure(entrypoint='main.py', ..., authorizer_configuration=auth_config)` — generates/updates `Dockerfile` and `.bedrock_agentcore.yaml`
11. **Cell 11** — `runtime.launch(env_vars={'AGENTCORE_MEMORY_ID': memory_id, 'OTEL_PYTHON_EXCLUDED_URLS': '/ping,/invocations'})` — triggers CodeBuild, builds ARM64 image, deploys runtime. **Takes 3–10 minutes.** Note the `agent_arn` and `agent_id` from the output.
12. **Remaining cells** — Construct the invocation URL, test the endpoint with `requests.post()`, list runtimes/ECR repos

After the deployment notebook completes, proceed with [Phase 9](#phase-9--update-frontend-with-agent-endpoint) and [Phase 10](#phase-10--build-and-deploy-frontend-to-amplify) from Way 1 to deploy the frontend.

### Advantages of Way 2
- Most complete deployment (includes AgentCore Memory + Cognito JWT auth on runtime)
- Interactive — you can inspect each resource as it's created
- Easy to debug individual steps
- Cell output is preserved as a run record

### Disadvantages of Way 2
- Requires Jupyter installed
- Slower than scripted deployment
- Manual — no automation for re-runs

---

## 8. WAY 3 — Shell Scripts via WSL

> **When to use:** Only on the **original developer's machine** where the WSL environment has the `.venv` at the exact path `/mnt/e/GenAi-Project-Cloudage/StrandsMultiAgent/.venv/`. This method will fail with `❌ Windows .venv not found at expected path` on any other machine.

> ⚠️ **Critical limitation:** `setup.sh` and `deploy.sh` hardcode the Python binary path to `/mnt/e/GenAi-Project-Cloudage/StrandsMultiAgent/.venv/Scripts/pip.exe` and `python.exe`. These paths only exist on the original developer machine. Do NOT use Way 3 on a fresh machine.

### Prerequisites for Way 3

- WSL (Windows Subsystem for Linux) with Ubuntu installed
- The Windows `.venv` exists at `E:\GenAi-Project-Cloudage\StrandsMultiAgent\.venv\Scripts\pip.exe`
- AWS CLI configured inside WSL
- Node.js installed inside WSL or on Windows PATH accessible from WSL
- Git Bash or WSL terminal

### Steps

**[WSL / Git Bash]** — Run from `SourceCode/`

```bash
# Navigate to SourceCode (WSL path for E: drive)
cd /mnt/e/GenAi-Project-Cloudage/StrandsMultiAgent/StrandsMultiAgent/SourceCode

# Make scripts executable
chmod +x setup.sh deploy.sh deploy-frontend.sh cleanup.sh

# Step 1: Run setup (Python deps, IAM, Guardrail, Cognito, npm)
./setup.sh

# Step 2: Deploy agent to AgentCore Runtime
./deploy.sh

# Step 3: Deploy frontend to Amplify
./deploy-frontend.sh
```

> ⚠️ **`deploy-frontend.sh` uses `/tmp/amplify-frontend.zip`** — this is a Linux/WSL path that won't be accessible from Windows. The zip will be created inside WSL's `/tmp/` and deleted after the script ends.

> ⚠️ **`cleanup.sh` uses `source .venv/bin/activate`** — this expects a Linux/WSL virtual environment at `SourceCode/.venv/bin/activate`. The Windows `.venv` at the hardcoded path uses `Scripts/` not `bin/`. Cleanup may partially fail on the Python steps.

### Advantages of Way 3
- Single command per phase
- Scripts handle all the logic

### Disadvantages of Way 3
- Only works on the original developer machine (hardcoded paths)
- Cannot be used by anyone else without modifying `setup.sh` and `deploy.sh`
- `cleanup.sh` does not delete AgentCore Memory
- `deploy.sh` does not configure Cognito JWT authorization on the AgentCore Runtime

---

## 9. Deployment Method Comparison

| Criterion | WAY 1 — Manual (Recommended) | WAY 2 — Jupyter Notebook | WAY 3 — Shell Scripts |
|-----------|------------------------------|--------------------------|----------------------|
| **Ease of deployment** | Medium (requires following steps) | Easy (cell by cell) | Easy (single command) |
| **Automation** | Semi-manual | Manual (interactive) | Fully scripted |
| **Portability** | ✅ Works on any machine | ✅ Works on any machine | ❌ Original machine only |
| **Completeness** | Good (no AgentCore Memory) | ✅ Best (Memory + JWT auth) | Limited (no JWT auth on runtime) |
| **Reliability** | ✅ High (no hardcoded paths) | ✅ High | ❌ Low on new machines |
| **Production suitability** | Good for POC | Good for POC | Not suitable |
| **AWS Console usage** | Minimal (model access only) | Minimal (model access only) | Minimal (model access only) |
| **CLI required** | ✅ Yes (AWS CLI) | ✅ Yes (AWS CLI) | ✅ Yes (AWS CLI) |
| **Docker required** | ❌ No (CodeBuild handles it) | ❌ No (CodeBuild handles it) | ❌ No (CodeBuild handles it) |
| **Deployment risk** | Low | Low | Medium |
| **AgentCore Memory** | Not configured | ✅ Yes | Not configured |
| **Cognito JWT on runtime** | Not configured* | ✅ Yes | Not configured* |
| **Time to deploy** | ~15 min | ~20 min | ~15 min |

> \* Without Cognito JWT configured on the AgentCore Runtime, the endpoint will still require a bearer token in the request header (as sent by `agent.ts`), but the runtime itself won't enforce JWT validation. For production use, Way 2 is required to configure proper authorization.

### Best Method

**Way 1 is best** for fresh deployments on any machine. It avoids the hardcoded-path blockers in the shell scripts while executing exactly the same operations. Use **Way 2** when you need the full feature set (AgentCore Memory + JWT runtime authorization) or for demos.

---

## 10. Post-Deployment Verification

### Verify AgentCore Runtime (RECOMMENDED — first check)

**[PowerShell]**

```powershell
aws bedrock-agentcore list-agent-runtimes --region us-east-1 --output table
```

Expected: A runtime named `personal_finance_agent-{id}` with `status: READY`

Also verify:
```powershell
aws bedrock-agentcore get-agent-runtime `
    --agent-runtime-id personal_finance_agent-{id} `
    --region us-east-1
```

### Verify ECR Repository

```powershell
aws ecr describe-repositories --region us-east-1 --output table
```

Expected: Repository `bedrock-agentcore-personal_finance_agent` with at least 1 image.

```powershell
aws ecr list-images `
    --repository-name bedrock-agentcore-personal_finance_agent `
    --region us-east-1
```

### Verify Bedrock Guardrail

```powershell
aws bedrock list-guardrails --region us-east-1 --output table
```

Expected: `guardrail-no-bitcoin-advice` with status `READY`.

### Verify Cognito User Pool

```powershell
aws cognito-idp list-user-pools --max-results 10 --region us-east-1 --output table
```

Expected: A pool named `agentpool`.

### Verify Secrets Manager

```powershell
aws secretsmanager list-secrets `
    --filters Key=name,Values=agentcore-project-credentials `
    --region us-east-1 --output table
```

Expected: At least one active secret (no `DeletedDate`).

### Verify IAM Roles

```powershell
aws iam get-role --role-name AmazonBedrockAgentCoreSDKRuntime-us-east-1
```

### Verify Amplify Frontend

```powershell
aws amplify list-apps --region us-east-1 --output table
```

Note the `appId` and check the deployment URL: `https://main.{appId}.amplifyapp.com`

```powershell
# Check latest deployment job status
$APP_ID = "your-app-id"
aws amplify list-jobs --app-id $APP_ID --branch-name main --max-results 1 --region us-east-1
```

Expected: `status: SUCCEED`

### Verify CloudWatch Logs

```powershell
$AGENT_ID = "personal_finance_agent-XXXXXXXX"
aws logs describe-log-groups `
    --log-group-name-prefix "/aws/bedrock-agentcore/runtimes/$AGENT_ID" `
    --region us-east-1
```

### Verify S3 Bucket (CodeBuild source artifacts)

```powershell
aws s3 ls s3://bedrock-agentcore-codebuild-sources-637423369471-us-east-1 --region us-east-1
```

---

## 11. Testing the Application

### Test 1 — Direct AgentCore Endpoint (Backend Only)

**[PowerShell]** — With venv activated. Replace the ARN, token, and endpoint with your actual values.

```powershell
python -c "
import requests, json, urllib.parse

AGENT_ARN = 'arn:aws:bedrock-agentcore:us-east-1:637423369471:runtime/personal_finance_agent-XXXXXXXX'
REGION = 'us-east-1'
encoded_arn = urllib.parse.quote(AGENT_ARN, safe='')
endpoint = f'https://bedrock-agentcore.{REGION}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT'

# Get a fresh token first
from utils.agentcore_utils import retrieve_credentials_from_secrets_manager
from utils.agentcore_utils import reauthenticate_user

creds = retrieve_credentials_from_secrets_manager()
token = reauthenticate_user(
    client_id=creds['client_id'],
    username=creds['username'],
    password=creds['password']
)

response = requests.post(
    endpoint,
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': 'test-session-12345678901234567890'
    },
    json={'prompt': 'What is the 50/30/20 rule?', 'session_id': 'test-session-12345678901234567890', 'actor_id': 'test_user'},
    stream=True
)

print(f'Status: {response.status_code}')
for chunk in response.iter_content(chunk_size=None):
    print(chunk.decode(), end='', flush=True)
"
```

### Test 2 — Frontend Health Check

Open a browser and navigate to: `https://main.{app_id}.amplifyapp.com`

Expected: NEXT Insurance login page with username/password fields.

### Test 3 — End-to-End Login and Chat

1. Open the Amplify URL
2. Log in with credentials from Phase 11 (retrieved from Secrets Manager)
3. Send test messages and verify responses:

| Test Message | Expected Agent | Expected Response |
|-------------|---------------|------------------|
| `Create a monthly budget for $6,000 income` | Budget Agent | 50/30/20 breakdown with amounts |
| `Analyze AAPL stock` | Financial Analysis Agent | Current price, 52-week range, YTD change |
| `Build a conservative portfolio for $25,000` | Financial Analysis Agent | JNJ, PG, KO, PEP, WMT allocations |
| `What should I invest in Bitcoin?` | Orchestrator (Guardrail) | Blocked — guardrail message about cryptocurrency |
| `Compare NVDA, TSLA, META over 6 months` | Financial Analysis Agent | Performance % for each stock |
| `Budget and invest $5,000 monthly salary with $2,000 savings` | Both Agents | Combined budget + portfolio advice |

### Test 4 — Local Frontend Development Mode

```powershell
cd frontend
npm run dev -- -p 3001
# Open http://localhost:3001
```

---

## 12. Troubleshooting

### Problem: `AccessDenied` when creating IAM role
**Cause:** `mlops-user` lacks `iam:CreateRole` permission.  
**Fix:** Add `IAMFullAccess` policy to `mlops-user`, or ask an admin to run Phase 3 manually.

---

### Problem: `ResourceNotFoundException` — Bedrock model not found
**Cause:** Amazon Nova Pro model access not enabled in Bedrock.  
**Fix:** AWS Console → Bedrock → Model access → Select `Amazon Nova Pro` → Request access → Wait for approval (usually instant for Nova Pro).

---

### Problem: `setup.sh: line X: /mnt/e/GenAi-Project-Cloudage/.../pip.exe: No such file or directory`
**Cause:** `setup.sh` hardcodes the original developer's `.venv` path.  
**Fix:** Do not use `setup.sh`. Follow **Way 1** instead, which creates the `.venv` portably.

---

### Problem: `deploy.sh` fails immediately — `PYTHON_BIN: command not found`
**Cause:** Same hardcoded path issue in `deploy.sh`.  
**Fix:** Do not use `deploy.sh`. Use **Way 1 Phase 8** Python commands directly.

---

### Problem: CodeBuild fails — `DOWNLOAD_SOURCE` phase error
**Cause:** S3 bucket or IAM role not yet propagated.  
**Fix:** Wait 30 seconds and retry. Check CodeBuild logs:
```powershell
aws codebuild list-builds-for-project `
    --project-name bedrock-agentcore-personal_finance_agent-builder `
    --region us-east-1
# Then:
aws codebuild batch-get-builds --ids {build-id} --region us-east-1
```

---

### Problem: CodeBuild fails — `BUILD` phase — pip install error
**Cause:** A package in `requirements.txt` failed to install inside the ARM64 container.  
**Fix:** Check the CodeBuild build logs in AWS Console → CodeBuild → Build projects → select your project → latest build → view logs. Common culprits: network timeouts (retry), binary packages not available for ARM64 (check requirements.txt for any custom packages).

---

### Problem: AgentCore Runtime stuck in `CREATING` or `FAILED` state
**Cause:** Container startup error — usually an import error in `main.py` or missing env var.  
**Fix:** Check CloudWatch logs:
```powershell
$AGENT_ID = "personal_finance_agent-XXXXXXXX"
aws logs tail "/aws/bedrock-agentcore/runtimes/$AGENT_ID-DEFAULT" `
    --log-stream-name-prefix "runtime-logs" `
    --region us-east-1
```
Common causes: `get_guardrail_id()` returns `None` (guardrail not created yet), `region` is `None` (boto3 not configured).

---

### Problem: Frontend login fails — `Authentication failed`
**Cause:** Cognito pool ID or client ID in `.env.local` is wrong, or the token has expired.  
**Fix:**
1. Verify `frontend/.env.local` has the correct `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID`
2. Retrieve credentials from Secrets Manager to confirm the username/password
3. Check that the Cognito pool still exists: `aws cognito-idp list-user-pools --max-results 10 --region us-east-1`

---

### Problem: Chat works locally but fails on Amplify — CORS or 401 error
**Cause:** The `NEXT_PUBLIC_AGENTCORE_ENDPOINT` environment variable is not set in the Amplify app.  
**Fix:** Update Amplify environment variables:
```powershell
$APP_ID = "your-amplify-app-id"
aws amplify update_app --app-id $APP_ID `
    --environment-variables "NEXT_PUBLIC_AGENTCORE_ENDPOINT=https://...invocations" `
    --region us-east-1
# Then redeploy
```

---

### Problem: Agent responds but ignores previous conversation context
**Cause:** AgentCore Memory (`AGENTCORE_MEMORY_ID`) is not configured on the runtime (expected when using Way 1 or Way 3 — memory is only set up via Way 2).  
**Fix:** The agent still works; it just won't have cross-session memory. To add memory, use Way 2 (Jupyter notebook) to redeploy with memory configured.

---

### Problem: Amplify deployment shows `FAILED` status
**Cause:** Often a routing issue with the static export.  
**Fix:** Ensure the custom rewrite rule `/<*>` → `/index.html` (status `404-200`) is set on the Amplify app:
```powershell
$APP_ID = "your-amplify-app-id"
aws amplify update-app --app-id $APP_ID --region us-east-1 `
    --custom-rules '[{"source":"/<*>","target":"/index.html","status":"404-200"}]'
```

---

### Problem: `npx next export` fails — `Error: No static export found`
**Cause:** `npm run build` must complete successfully before `npx next export`.  
**Fix:** Run `npm run build` first, check for TypeScript errors, then run `npx next export`.

---

### Problem: `guardrail.py` — `bedrock_client` uses default region, not `us-east-1`
**Cause:** `guardrail.py` creates `boto3.client("bedrock")` without an explicit `region_name`. If AWS CLI default region is not set, this may target the wrong region.  
**Fix:** Ensure `aws configure get region` returns `us-east-1` before running Python deployment steps.

---

## 13. Cleanup — Before Redeployment

Use this when you want to redeploy from scratch (e.g., after a code change that requires a clean slate).

> ⚠️ These steps delete AWS resources that cost money. Be certain before running them.

### Step 1 — Delete the AgentCore Runtime

**[PowerShell]**

```powershell
# List runtimes to find the ID
aws bedrock-agentcore list-agent-runtimes --region us-east-1 --output table

# Delete it (replace RUNTIME_ID with the actual agentRuntimeId)
$RUNTIME_ID = "personal_finance_agent-XXXXXXXX"
aws bedrock-agentcore delete-agent-runtime `
    --agent-runtime-id $RUNTIME_ID `
    --region us-east-1
```

### Step 2 — Delete Cognito User Pool (if recreating with fresh credentials)

**[PowerShell]** — With venv activated

```powershell
python -c "
from utils.agentcore_utils import delete_cognito_user_pool
delete_cognito_user_pool()
"
```

### Step 3 — Delete Secrets Manager Secret (if recreating Cognito)

```powershell
# List secrets
aws secretsmanager list-secrets `
    --filters Key=name,Values=agentcore-project-credentials `
    --region us-east-1

# Delete (replace SECRET_NAME)
$SECRET_NAME = "agentcore-project-credentials-XXXXXXXX"
aws secretsmanager delete-secret `
    --secret-id $SECRET_NAME `
    --force-delete-without-recovery `
    --region us-east-1
```

### Step 4 — Delete ECR Images (if you want a clean image rebuild)

```powershell
aws ecr batch-delete-image `
    --repository-name bedrock-agentcore-personal_finance_agent `
    --image-ids imageTag=latest `
    --region us-east-1
```

After cleaning, restart from **Phase 3** of Way 1 (or whichever phase is relevant).

---

## 14. Cleanup — Final / Delete Everything

Use this to remove **all project resources** and stop all charges.

> ⚠️ This is irreversible. All data, users, and configurations will be permanently deleted.

### Option A — Use `cleanup.sh` (WSL / Git Bash only)

**[Git Bash]** — Only on the original developer machine

```bash
cd /mnt/e/GenAi-Project-Cloudage/StrandsMultiAgent/StrandsMultiAgent/SourceCode
chmod +x cleanup.sh
./cleanup.sh
```

`cleanup.sh` deletes in this order:
1. AgentCore Runtime (`personal_finance_agent-*`)
2. Bedrock Guardrail (`guardrail-no-bitcoin-advice`)
3. Cognito User Pool (`agentpool`)
4. IAM roles: `AmazonBedrockAgentCoreSDKRuntime-us-east-1`, CodeBuild role, `AmplifyServiceRole`
5. S3 buckets (matching `bedrock-agentcore`)
6. ECR repositories (matching `bedrock-agentcore`)
7. CodeBuild projects (matching `bedrock-agentcore`)
8. Amplify app (`finance-advisor-ui`)
9. CodeCommit repository (if any)
10. Secrets Manager secrets (`agentcore-project-credentials`)

> ⚠️ **Gap:** `cleanup.sh` does NOT delete **AgentCore Memory** (`FinancialAdvisorMemory-{id}`). Delete this manually (see Step B below).

### Option B — Manual Full Cleanup (PowerShell, works on any machine)

**[PowerShell]** — Run with venv activated from `SourceCode/`

```powershell
$REGION = "us-east-1"

# 1. Delete AgentCore Runtime
$RUNTIMES = aws bedrock-agentcore list-agent-runtimes --region $REGION --query "agentRuntimes[?contains(agentRuntimeName,'personal_finance_agent')].agentRuntimeId" --output text
foreach ($ID in $RUNTIMES.Split()) {
    if ($ID) {
        Write-Host "Deleting runtime: $ID"
        aws bedrock-agentcore delete-agent-runtime --agent-runtime-id $ID --region $REGION
    }
}

# 2. Delete AgentCore Memory (IMPORTANT — cleanup.sh misses this)
python -c "
from bedrock_agentcore.memory import MemoryClient
mc = MemoryClient()
memories = mc.list_memories()
for m in memories:
    if 'FinancialAdvisorMemory' in m.get('name','') or 'FinancialAdvisorMemory' in m.get('id',''):
        print(f'Deleting memory: {m[\"id\"]}')
        mc.delete_memory(memory_id=m['id'])
        print('Done')
"

# 3. Delete Bedrock Guardrail
python -c "
from utils.guardrail import delete_guardrail
delete_guardrail()
"

# 4. Delete Cognito User Pool
python -c "
from utils.agentcore_utils import delete_cognito_user_pool
delete_cognito_user_pool()
"

# 5. Delete IAM roles
$ROLE = "AmazonBedrockAgentCoreSDKRuntime-us-east-1"
aws iam detach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess 2>$null
aws iam detach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess 2>$null
aws iam detach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly 2>$null
aws iam delete-role --role-name $ROLE 2>$null

# CodeBuild role (find it first)
$CB_ROLES = aws iam list-roles --query "Roles[?contains(RoleName,'AgentCoreSDKCodeBuild')].RoleName" --output text
foreach ($CBROLE in $CB_ROLES.Split()) {
    if ($CBROLE) {
        $POLICIES = aws iam list-attached-role-policies --role-name $CBROLE --query "AttachedPolicies[].PolicyArn" --output text
        foreach ($P in $POLICIES.Split()) { if ($P) { aws iam detach-role-policy --role-name $CBROLE --policy-arn $P 2>$null } }
        $INLINE = aws iam list-role-policies --role-name $CBROLE --query "PolicyNames[]" --output text
        foreach ($P in $INLINE.Split()) { if ($P) { aws iam delete-role-policy --role-name $CBROLE --policy-name $P 2>$null } }
        aws iam delete-role --role-name $CBROLE 2>$null
        Write-Host "Deleted CodeBuild role: $CBROLE"
    }
}

# 6. Delete S3 bucket
$BUCKET = "bedrock-agentcore-codebuild-sources-637423369471-us-east-1"
aws s3 rb "s3://$BUCKET" --force --region $REGION 2>$null
Write-Host "S3 bucket deleted"

# 7. Delete ECR repository
aws ecr delete-repository `
    --repository-name bedrock-agentcore-personal_finance_agent `
    --force --region $REGION 2>$null
Write-Host "ECR repo deleted"

# 8. Delete CodeBuild project
aws codebuild delete-project `
    --name bedrock-agentcore-personal_finance_agent-builder `
    --region $REGION 2>$null
Write-Host "CodeBuild project deleted"

# 9. Delete Amplify app
$APPS = aws amplify list-apps --region $REGION --query "apps[?name=='finance-advisor-ui'].appId" --output text
foreach ($AID in $APPS.Split()) {
    if ($AID) {
        aws amplify delete-app --app-id $AID --region $REGION
        Write-Host "Amplify app deleted: $AID"
    }
}

# 10. Delete Secrets Manager (force immediate deletion)
$SECRETS = aws secretsmanager list-secrets --filters Key=name,Values=agentcore-project-credentials --region $REGION --query "SecretList[?!DeletedDate].Name" --output text
foreach ($S in $SECRETS.Split()) {
    if ($S) {
        aws secretsmanager delete-secret --secret-id $S --force-delete-without-recovery --region $REGION
        Write-Host "Secret deleted: $S"
    }
}

Write-Host ""
Write-Host "All resources deleted."
```

### Option C — Use AWS_CleanUp.ipynb

Open `AWS_CleanUp.ipynb` in Jupyter and run all cells in order. This notebook handles AgentCore Memory deletion (which `cleanup.sh` misses) and provides detailed output for each step.

---

### Resources That May Remain After Cleanup

| Resource | Why It May Remain | How to Delete |
|----------|------------------|--------------|
| **AgentCore Memory** | `cleanup.sh` does not delete it | Way B Step 2, or `AWS_CleanUp.ipynb` cell 3 |
| **CloudWatch Log Groups** | Not deleted by any script | AWS Console → CloudWatch → Log groups → filter `/aws/bedrock-agentcore` → Delete |
| **Amplify zip file** | `amplify-frontend.zip` left in `SourceCode/` | `Remove-Item SourceCode\amplify-frontend.zip` |
| **Secrets Manager (30-day recovery)** | Secrets have a 30-day recovery window by default | Use `--force-delete-without-recovery` flag (done in Option B above) |
| **IAM roles from partial deploys** | Multiple redeploys may create multiple CodeBuild roles | `aws iam list-roles --query "Roles[?contains(RoleName,'AgentCore')].RoleName"` then delete each |

### Verify Complete Cleanup

```powershell
# Check for any remaining AgentCore runtimes
aws bedrock-agentcore list-agent-runtimes --region us-east-1

# Check ECR
aws ecr describe-repositories --region us-east-1

# Check Cognito pools
aws cognito-idp list-user-pools --max-results 20 --region us-east-1

# Check Amplify apps
aws amplify list-apps --region us-east-1

# Check S3 buckets with agentcore in name
aws s3 ls | Select-String "agentcore"

# Check CodeBuild projects
aws codebuild list-projects --region us-east-1
```

---

## 15. Known Issues and Deployment Blockers

### Blocker 1 — Hardcoded WSL Paths in Shell Scripts (Critical)

**Files affected:** `setup.sh` (line 36), `deploy.sh` (line 23)  
**Issue:** Both scripts hardcode `/mnt/e/GenAi-Project-Cloudage/StrandsMultiAgent/.venv/Scripts/pip.exe` and `.../python.exe`. These paths exist only on the original developer's machine running WSL.  
**Impact:** `setup.sh` and `deploy.sh` will fail with `❌ Windows .venv not found` on any other machine.  
**Workaround:** Use **Way 1** (manual steps) instead of running these scripts.

---

### Blocker 2 — Amazon Nova Pro Model Access Must Be Manually Enabled

**Issue:** The Bedrock model `amazon.nova-pro-v1:0` requires explicit enablement in the AWS Console. No script enables it automatically.  
**Impact:** All agent invocations fail with a model access error if this is skipped.  
**Fix:** AWS Console → `us-east-1` → Bedrock → Model access → Enable `Amazon Nova Pro` before any deployment step.

---

### Blocker 3 — `deploy.sh` Missing Cognito JWT Authorizer Configuration

**File:** `deploy.sh`  
**Issue:** The `Runtime().configure()` call in `deploy.sh` does not pass `authorizer_configuration`. The AgentCore Runtime is deployed without JWT auth enforcement.  
**Impact:** The frontend sends a Bearer token, but the runtime itself does not validate it against Cognito. The endpoint is technically accessible without a valid token.  
**Fix:** Use **Way 2** (Jupyter notebook), which passes `authorizer_configuration=auth_config` with the correct `customJWTAuthorizer` config.

---

### Blocker 4 — `cleanup.sh` Does Not Delete AgentCore Memory

**File:** `cleanup.sh`  
**Issue:** The cleanup script has no step to delete AgentCore Memory (`FinancialAdvisorMemory-{id}`).  
**Impact:** If Memory was created (Way 2), it persists after cleanup and may incur storage charges.  
**Fix:** Run `AWS_CleanUp.ipynb` cell 3 (Step 3: Delete AgentCore Memory) after `cleanup.sh`, or use the manual PowerShell command in Section 14 Option B Step 2.

---

### Blocker 5 — `deploy-frontend.sh` Uses Linux `/tmp/` Path

**File:** `deploy-frontend.sh`  
**Issue:** The script writes the Amplify zip to `/tmp/amplify-frontend.zip`. This is a Unix-only path.  
**Impact:** On native Windows (outside WSL), this path does not exist.  
**Workaround:** Way 1 Phase 10 uses a portable path (`amplify-frontend.zip` in the working directory).

---

### Issue 6 — `redeploy_frontend.py` Contains a Plaintext Password

**File:** `redeploy_frontend.py`  
**Issue:** The script hardcodes `Password: Finance@2026` in a `print()` statement and hardcodes specific Cognito IDs.  
**Impact:** Security risk if this file is committed to a public repository.  
**Recommendation:** Do not use `redeploy_frontend.py` for redeployments. Use Way 1 Phase 10 instead. Remove or redact this file before committing to any shared repository.

---

### Issue 7 — `guardrail.py` Does Not Specify Region Explicitly

**File:** `utils/guardrail.py`  
**Issue:** `boto3.client("bedrock")` and `boto3.client("bedrock-runtime")` are created at module level without `region_name`. They use the default boto3 region from the environment.  
**Impact:** If AWS CLI default region is not `us-east-1`, the guardrail is created in the wrong region.  
**Fix:** Always ensure `aws configure get region` returns `us-east-1` before running deployment steps.

---

### Issue 8 — `.bedrock_agentcore.yaml` Contains Stale Agent ID

**File:** `.bedrock_agentcore.yaml`  
**Issue:** The file contains `agent_id: personal_finance_agent-2swWJl2cyX` from a previous deployment. A new deployment generates a new ID and overwrites this file.  
**Impact:** Minor — the SDK overwrites this on each deploy. No action needed.

---

*Guide created from full analysis of all project files: main.py, budget_agent.py, financial_analysis_agent.py, utils/*, setup.sh, deploy.sh, deploy-frontend.sh, cleanup.sh, Dockerfile, requirements.txt, .bedrock_agentcore.yaml, amplify.yml, frontend/package.json, frontend/next.config.js, frontend/pages/index.tsx, frontend/src/lib/agent.ts, frontend/src/lib/auth.ts, frontend/.env.local, AWS_SingleAgent.ipynb, AWS_MultiAgent.ipynb, AWS_Deployment.ipynb, AWS_CleanUp.ipynb, README.md, Client_Requirements.md, Prerequisites_for_Production.md, check_amplify*.py, fix_amplify*.py, redeploy_frontend.py, list_cognito.py*
