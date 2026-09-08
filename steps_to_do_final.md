# NovaMind AI Financial Advisor — Deployment Guide

**Region:** `us-east-1` · **Account:** `637423369471` · **IAM User:** `mlops-user`  
**Live URL:** `https://main.d1b8k75dkx4pm5.amplifyapp.com`

---

## Before You Start

### 1. Enable Nova Pro Model Access (AWS Console — do once)

1. Open AWS Console → region **us-east-1**
2. Go to **Amazon Bedrock → Model access**
3. Find **Amazon Nova Pro** → Request access → Save
4. Wait for ✅ **Access granted**

### 2. Create the Python venv at the correct path (PowerShell — do once)

```powershell
python -m venv "E:\GenAi-Project-Cloudage\StrandsMultiAgent\.venv"
```

Verify:
```powershell
Test-Path "E:\GenAi-Project-Cloudage\StrandsMultiAgent\.venv\Scripts\pip.exe"
# Must return: True
```

---

## ⚠️ Why You See "User pool does not exist" and 401 Errors — Root Cause & Permanent Fix

### Root Cause

Every time `setup.sh` runs, it creates a **brand new Cognito pool** with a new Pool ID (e.g. `us-east-1_ffAIrHZJH`, then `us-east-1_o5ytornH0`, etc.). 

The old `deploy.sh` read the Pool ID from `frontend/.env.local` — which still had the old pool ID. So:

1. `setup.sh` → creates new pool `us-east-1_NEW`
2. `deploy.sh` → reads old pool `us-east-1_OLD` from `.env.local` → writes same old ID back
3. Frontend sends JWT signed by new pool → AgentCore runtime still configured for old pool → **401 Claim 'iss' mismatch**
4. Any Python command using the old pool ID → **"User pool does not exist"**

### Permanent Fix (already applied to deploy.sh)

`deploy.sh` now **always reads Cognito values dynamically from AWS** — it never reads from `.env.local`. This means no matter how many times `setup.sh` runs and creates new pools, `deploy.sh` always picks up the correct current pool ID automatically.

**This means after every full deployment (`setup.sh` → `deploy.sh` → `deploy-frontend.sh`), everything is in sync automatically. No manual fixes needed.**

---

Open **Git Bash** and run:

```bash
cd /e/GenAi-Project-Cloudage/StrandsMultiAgent/StrandsMultiAgent/SourceCode
chmod +x setup.sh deploy.sh deploy-frontend.sh cleanup.sh
```

---

### Step 1 — bash setup.sh

```bash
bash setup.sh
```

**What it does:** Python deps → AWS verify → IAM role → Guardrail → Cognito → npm install → writes `.env.local`

**Done when you see:**
```
✅ Setup Complete!
```

**If it fails at Step 1 (venv not found):**  
Go back and create the `.venv` at the correct path (see Before You Start).

---

### Step 2 — bash deploy.sh

```bash
bash deploy.sh
```

**What it does:** Builds ARM64 container via CodeBuild → deploys to AgentCore Runtime → configures Cognito JWT auth automatically → updates `frontend/.env.local`

**Takes 5–10 minutes.** CodeBuild logs will scroll — that is normal.

**Done when you see:**
```
✅ Deployment Complete!
✓ JWT authorizer configured
```

**If it fails — stale agent ID error:**
```powershell
# PowerShell — clear the stale ID
(Get-Content "SourceCode\.bedrock_agentcore.yaml") `
    -replace "agent_id: personal_finance_agent-.*", "agent_id: null" `
    -replace "agent_arn: arn:aws:bedrock-agentcore.*", "agent_arn: null" |
    Set-Content "SourceCode\.bedrock_agentcore.yaml"
```
Then re-run `bash deploy.sh`.

**If it fails — OSError WinError 1920:**
```bash
echo "frontend/node_modules/" >> .dockerignore
```
Then re-run `bash deploy.sh`.

---

### Step 3 — bash deploy-frontend.sh

```bash
bash deploy-frontend.sh
```

**What it does:** npm build → next export → zip → upload to Amplify → deploy

**Done when you see:**
```
✅ Deployment Successful!
   URL: https://main.d1b8k75dkx4pm5.amplifyapp.com
```

**If it fails — last job not finished:**
```powershell
aws amplify stop-job --app-id d1b8k75dkx4pm5 --branch-name main --job-id X --region us-east-1
```
Replace `X` with the job number from the error. Then retry.

---

## Get Login Credentials

After `bash deploy-frontend.sh` completes, your credentials were already printed at the end of `bash deploy.sh`. Scroll up in your terminal and look for:

```
━━━ Login Credentials ━━━
Username: cloudageuser-xxxxxxxx
Password: xxxxxxxxxxxxxxxx
```

**If you missed them or need them again**, run this in **PowerShell:**

```powershell
cd "E:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode"
.\.venv\Scripts\Activate.ps1
$env:PYTHONUTF8 = "1"

python -c "
import boto3, json

cognito = boto3.client('cognito-idp', region_name='us-east-1')

# Find current agentpool
pools = cognito.list_user_pools(MaxResults=20)
pool_id = None
for pool in pools['UserPools']:
    if pool['Name'] == 'agentpool':
        pool_id = pool['Id']
        break

if not pool_id:
    print('No agentpool found. Run setup.sh first.')
    exit()

# Get username
users = cognito.list_users(UserPoolId=pool_id)
username = users['Users'][0]['Username']

# Try Secrets Manager for password
try:
    sm = boto3.client('secretsmanager', region_name='us-east-1')
    secrets = sm.list_secrets(Filters=[{'Key':'name','Values':['agentcore-project-credentials']}])
    for s in secrets['SecretList']:
        if not s.get('DeletedDate'):
            val = sm.get_secret_value(SecretId=s['Name'])
            data = json.loads(val['SecretString'])
            if data.get('password') and data.get('pool_id') == pool_id:
                print('Username:', username)
                print('Password:', data['password'])
                exit()
except Exception:
    pass

# Reset password if not found
new_pw = 'NovaMind@2026!AI'
cognito.admin_set_user_password(
    UserPoolId=pool_id,
    Username=username,
    Password=new_pw,
    Permanent=True
)
print('Username:', username)
print('Password:', new_pw)
print('(Password was reset to NovaMind@2026!AI)')
"
```

This always works — it finds the current pool dynamically, tries Secrets Manager first, and resets the password if needed.



---

## Open the App

```
https://main.d1b8k75dkx4pm5.amplifyapp.com
```

Log in with the credentials above. Test:

| Message | Expected |
|---------|---------|
| `Create a budget for $5,000 income` | Needs/Wants/Savings breakdown |
| `Analyze AAPL stock` | Price, 52-week range, YTD change |
| `Build a conservative portfolio for $10,000` | JNJ, PG, KO, PEP, WMT |
| `What about Bitcoin?` | Guardrail blocks it |

---

## If Chat Returns 403 — Fix JWT Auth

This happens when Cognito was recreated but the runtime JWT authorizer wasn't updated.

```powershell
$env:PYTHONUTF8 = "1"
python -c "
import boto3, json, time, yaml

# Get runtime ID from config
with open('.bedrock_agentcore.yaml') as f:
    config = yaml.safe_load(f)
runtime_id = config['agents']['personal_finance_agent']['bedrock_agentcore']['agent_id']

# Get current Cognito pool
cognito = boto3.client('cognito-idp', region_name='us-east-1')
pools = cognito.list_user_pools(MaxResults=20)
for pool in pools['UserPools']:
    if pool['Name'] == 'agentpool':
        pool_id = pool['Id']
        clients = cognito.list_user_pool_clients(UserPoolId=pool_id, MaxResults=10)
        client_id = clients['UserPoolClients'][0]['ClientId']
        break

# Update runtime
agentcore = boto3.client('bedrock-agentcore-control', region_name='us-east-1')
r = agentcore.get_agent_runtime(agentRuntimeId=runtime_id)
agentcore.update_agent_runtime(
    agentRuntimeId=runtime_id,
    agentRuntimeArtifact=r['agentRuntimeArtifact'],
    roleArn=r['roleArn'],
    networkConfiguration=r['networkConfiguration'],
    authorizerConfiguration={
        'customJWTAuthorizer': {
            'allowedClients': [client_id],
            'discoveryUrl': f'https://cognito-idp.us-east-1.amazonaws.com/{pool_id}/.well-known/openid-configuration'
        }
    }
)
time.sleep(10)
print('JWT authorizer updated. Refresh browser and try again.')
"
```

---

## Redeploy After Changes

| What changed | Command |
|-------------|---------|
| Backend code (`main.py`, agents, utils) | `bash deploy.sh` then `bash deploy-frontend.sh` |
| Frontend only (UI, styles, components) | `bash deploy-frontend.sh` |
| Both | `bash deploy.sh` then `bash deploy-frontend.sh` |

---

## Cleanup — Delete All AWS Resources

### Option A — cleanup.sh (easiest)

```bash
# Git Bash
cd /e/GenAi-Project-Cloudage/StrandsMultiAgent/StrandsMultiAgent/SourceCode
bash cleanup.sh
```

Type `yes` when prompted. Takes ~2 minutes.

**What cleanup.sh deletes:**
- ✅ AgentCore Runtime
- ✅ Bedrock Guardrail
- ✅ Cognito User Pool
- ✅ IAM Roles (Runtime + CodeBuild)
- ✅ S3 Bucket
- ✅ ECR Repository
- ✅ CodeBuild Project
- ✅ Amplify App
- ✅ Secrets Manager secret

**After cleanup.sh — delete these two manually:**

**AgentCore Memory** (if created via notebook):
```powershell
$env:PYTHONUTF8 = "1"
python -c "
from bedrock_agentcore.memory import MemoryClient
mc = MemoryClient()
for m in mc.list_memories():
    if 'FinancialAdvisor' in m.get('name','') or 'FinancialAdvisor' in m.get('id',''):
        mc.delete_memory(memory_id=m['id'])
        print('Memory deleted:', m['id'])
"
```

**CloudWatch Log Groups:**
```powershell
aws logs describe-log-groups `
    --log-group-name-prefix "/aws/bedrock-agentcore" `
    --region us-east-1 `
    --query "logGroups[].logGroupName" `
    --output text | ForEach-Object {
        aws logs delete-log-group --log-group-name $_ --region us-east-1
        Write-Host "Deleted: $_"
    }
```

### After cleanup — reset config for next deployment

```powershell
(Get-Content "SourceCode\.bedrock_agentcore.yaml") `
    -replace "agent_id: personal_finance_agent-.*", "agent_id: null" `
    -replace "agent_arn: arn:aws:bedrock-agentcore.*", "agent_arn: null" |
    Set-Content "SourceCode\.bedrock_agentcore.yaml"
Write-Host "Config reset — ready for next deployment"
```

### Option B — Manual PowerShell cleanup (any machine)

See `steps_to_do_frontend.md` for the full step-by-step PowerShell cleanup with verification.

---

## Verify Cleanup Complete

```powershell
Write-Host "Checking remaining resources..."
aws bedrock-agentcore list-agent-runtimes --region us-east-1 --query "agentRuntimes[].agentRuntimeId" --output text
aws cognito-idp list-user-pools --max-results 20 --region us-east-1 --query "UserPools[?Name=='agentpool'].Id" --output text
aws amplify list-apps --region us-east-1 --query "apps[?name=='finance-advisor-ui'].appId" --output text
aws ecr describe-repositories --region us-east-1 --query "repositories[?contains(repositoryName,'bedrock-agentcore')].repositoryName" --output text
aws s3 ls | Select-String "bedrock-agentcore"
Write-Host "All lines above should be empty"
```

---

## Current Resource IDs (this deployment)

| Resource | ID |
|---------|---|
| AgentCore Runtime | `personal_finance_agent-9f7zjs8wVT` |
| Cognito User Pool | `us-east-1_ffAIrHZJH` |
| Cognito Client ID | `3bv3u7u179qp0kfk3sj54kopgp` |
| Cognito Username | `cloudageuser-a9885084` |
| Amplify App | `d1b8k75dkx4pm5` |
| ECR Repo | `bedrock-agentcore-personal_finance_agent` |
| S3 Bucket | `bedrock-agentcore-codebuild-sources-637423369471-us-east-1` |
| Live URL | `https://main.d1b8k75dkx4pm5.amplifyapp.com` |
