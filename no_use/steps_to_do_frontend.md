# NovaMind AI Financial Advisor — Cleanup Guide

This guide safely removes **all AWS resources** created during this project's deployment.

> ⚠️ Read this entire guide before running any command. Deleting resources in the wrong order can cause errors. Some resources (like Secrets Manager) have recovery windows — understand what each step does before proceeding.

---

## Actual Resources Created by This Deployment

These are the **real, confirmed resource names** from your deployment — not guesses.

| # | AWS Service | Resource Name / ID | Notes |
|---|------------|-------------------|-------|
| 1 | **Bedrock AgentCore Runtime** | `personal_finance_agent-9f7zjs8wVT` | The running agent container |
| 2 | **Bedrock AgentCore Memory** | `FinancialAdvisorMemory-{id}` | Only if created via notebook |
| 3 | **Amazon Bedrock Guardrail** | `guardrail-no-bitcoin-advice` | Content filtering |
| 4 | **Amazon Cognito User Pool** | `us-east-1_K2DyRQfL6` (name: `agentpool`) | Auth pool |
| 5 | **Cognito App Client** | `rave4g2hapjag1j28qbm8v17e` | Inside the pool |
| 6 | **AWS Secrets Manager** | `agentcore-project-credentials-{hex}` | Stores Cognito credentials |
| 7 | **IAM Role — AgentCore Runtime** | `AmazonBedrockAgentCoreSDKRuntime-us-east-1` | Execution role |
| 8 | **IAM Role — CodeBuild** | `AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-5d12c2867b` | Build role |
| 9 | **Amazon ECR Repository** | `bedrock-agentcore-personal_finance_agent` | Docker image storage |
| 10 | **AWS CodeBuild Project** | `bedrock-agentcore-personal_finance_agent-builder` | ARM64 build project |
| 11 | **Amazon S3 Bucket** | `bedrock-agentcore-codebuild-sources-637423369471-us-east-1` | Build source artifacts |
| 12 | **AWS Amplify App** | `d1b8k75dkx4pm5` (name: `finance-advisor-ui`) | Frontend hosting |
| 13 | **CloudWatch Log Groups** | `/aws/bedrock-agentcore/runtimes/personal_finance_agent-9f7zjs8wVT-DEFAULT` | Agent logs |

**Resources NOT automatically deleted by cleanup.sh:**
- AgentCore Memory (#2) — must be deleted manually
- CloudWatch Log Groups (#13) — must be deleted manually

---

## Pre-Cleanup Checks

Before deleting anything, run these verification commands to confirm what exists.

**Open PowerShell (Kiro terminal) and activate the venv:**

```powershell
cd "E:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode"
.\.venv\Scripts\Activate.ps1
$env:PYTHONUTF8 = "1"
```

**Check AgentCore Runtime:**
```powershell
aws bedrock-agentcore list-agent-runtimes --region us-east-1 --output table
```
Expected: `personal_finance_agent-9f7zjs8wVT` with status `READY`

**Check Cognito Pool:**
```powershell
aws cognito-idp list-user-pools --max-results 20 --region us-east-1 --output table
```
Expected: pool named `agentpool` with ID `us-east-1_K2DyRQfL6`

**Check Amplify App:**
```powershell
aws amplify list-apps --region us-east-1 --output table
```
Expected: app named `finance-advisor-ui` with ID `d1b8k75dkx4pm5`

**Check ECR:**
```powershell
aws ecr describe-repositories --region us-east-1 --output table
```
Expected: `bedrock-agentcore-personal_finance_agent`

**Check S3:**
```powershell
aws s3 ls | Select-String "bedrock-agentcore"
```
Expected: `bedrock-agentcore-codebuild-sources-637423369471-us-east-1`

**Check Secrets Manager:**
```powershell
aws secretsmanager list-secrets --filters Key=name,Values=agentcore-project-credentials --region us-east-1 --output table
```

**Check AgentCore Memory (if you used the notebook):**
```powershell
python -c "
from bedrock_agentcore.memory import MemoryClient
mc = MemoryClient()
memories = mc.list_memories()
for m in memories:
    print('Memory:', m.get('name'), '| ID:', m.get('id'))
if not memories:
    print('No memories found')
"
```

---

## Cleanup Order — Why Order Matters

Delete in this exact sequence. Some resources depend on others:

```
1. AgentCore Runtime      ← must go first (uses ECR image, IAM role)
2. AgentCore Memory       ← independent, but delete before Cognito
3. Bedrock Guardrail      ← independent
4. Cognito User Pool      ← delete before Secrets Manager
5. Secrets Manager        ← stores Cognito credentials
6. IAM Roles              ← policies must be detached before deletion
7. S3 Bucket              ← must be emptied before deletion
8. ECR Repository         ← delete images first, then repo
9. CodeBuild Project      ← depends on nothing
10. Amplify App           ← delete branches first
11. CloudWatch Log Groups ← last, just logs
```

---

## Step-by-Step Cleanup

### STEP 1 — Delete AgentCore Runtime

**PowerShell:**

```powershell
aws bedrock-agentcore delete-agent-runtime `
    --agent-runtime-id personal_finance_agent-9f7zjs8wVT `
    --region us-east-1

Write-Host "AgentCore Runtime deletion initiated"
```

Verify it's gone (may take 30–60 seconds):
```powershell
aws bedrock-agentcore list-agent-runtimes --region us-east-1 --output table
# Should show empty list or no personal_finance_agent entry
```

> ⚠️ If you get `ResourceInUseException` — the runtime is still processing a request. Wait 60 seconds and retry.

---

### STEP 2 — Delete AgentCore Memory (if it exists)

**PowerShell:**

```powershell
python -c "
from bedrock_agentcore.memory import MemoryClient
mc = MemoryClient()
memories = mc.list_memories()
deleted = 0
for m in memories:
    name = m.get('name', '')
    mid = m.get('id', '')
    if 'FinancialAdvisor' in name or 'FinancialAdvisor' in mid:
        print(f'Deleting memory: {mid}')
        mc.delete_memory(memory_id=mid)
        print('Deleted')
        deleted += 1
if deleted == 0:
    print('No FinancialAdvisor memory found - skipping')
"
```

> If no memory was created (you only used `deploy.sh`, not the notebook), this step prints "No FinancialAdvisor memory found" — that is fine.

---

### STEP 3 — Delete Bedrock Guardrail

**PowerShell:**

```powershell
python -c "
from utils.guardrail import delete_guardrail
delete_guardrail()
"
```

Verify:
```powershell
aws bedrock list-guardrails --region us-east-1 --output table
# guardrail-no-bitcoin-advice should no longer appear
```

---

### STEP 4 — Delete Cognito User Pool

**PowerShell:**

```powershell
python -c "
from utils.agentcore_utils import delete_cognito_user_pool
delete_cognito_user_pool()
"
```

Verify:
```powershell
aws cognito-idp list-user-pools --max-results 20 --region us-east-1 --output table
# agentpool should no longer appear
```

> ⚠️ If you see `NotAuthorizedException` — the pool may already be deleted. Check the list first.

---

### STEP 5 — Delete Secrets Manager Secret

```powershell
# Find the secret name first
$SECRET_NAME = (aws secretsmanager list-secrets `
    --filters Key=name,Values=agentcore-project-credentials `
    --region us-east-1 `
    --query "SecretList[?!DeletedDate].Name" `
    --output text)

Write-Host "Secret to delete: $SECRET_NAME"

# Delete it immediately (no 30-day recovery window)
if ($SECRET_NAME -and $SECRET_NAME -ne "None") {
    aws secretsmanager delete-secret `
        --secret-id $SECRET_NAME `
        --force-delete-without-recovery `
        --region us-east-1
    Write-Host "Secret deleted: $SECRET_NAME"
} else {
    Write-Host "No active secret found - skipping"
}
```

Verify:
```powershell
aws secretsmanager list-secrets --filters Key=name,Values=agentcore-project-credentials --region us-east-1 --output table
# Should show empty or DeletedDate set
```

---

### STEP 6 — Delete IAM Roles

Two roles were created. Delete them in this order (CodeBuild role first, then Runtime role).

**Delete CodeBuild IAM Role:**

```powershell
$CB_ROLE = "AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-5d12c2867b"

# Detach all managed policies
$POLICIES = (aws iam list-attached-role-policies `
    --role-name $CB_ROLE `
    --query "AttachedPolicies[].PolicyArn" `
    --output text) -split "\s+"

foreach ($P in $POLICIES) {
    if ($P) {
        aws iam detach-role-policy --role-name $CB_ROLE --policy-arn $P
        Write-Host "Detached: $P"
    }
}

# Delete inline policies
$INLINE = (aws iam list-role-policies `
    --role-name $CB_ROLE `
    --query "PolicyNames[]" `
    --output text) -split "\s+"

foreach ($P in $INLINE) {
    if ($P) {
        aws iam delete-role-policy --role-name $CB_ROLE --policy-name $P
        Write-Host "Deleted inline: $P"
    }
}

# Delete the role
aws iam delete-role --role-name $CB_ROLE
Write-Host "CodeBuild IAM role deleted"
```

**Delete AgentCore Runtime IAM Role:**

```powershell
$RT_ROLE = "AmazonBedrockAgentCoreSDKRuntime-us-east-1"

# Detach managed policies
aws iam detach-role-policy --role-name $RT_ROLE --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess 2>$null
aws iam detach-role-policy --role-name $RT_ROLE --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess 2>$null
aws iam detach-role-policy --role-name $RT_ROLE --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly 2>$null

# Delete the role
aws iam delete-role --role-name $RT_ROLE
Write-Host "Runtime IAM role deleted"
```

Verify both roles are gone:
```powershell
aws iam get-role --role-name AmazonBedrockAgentCoreSDKRuntime-us-east-1 2>&1
aws iam get-role --role-name AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-5d12c2867b 2>&1
# Both should return NoSuchEntity error
```

---

### STEP 7 — Delete S3 Bucket

The bucket must be emptied before it can be deleted.

```powershell
$BUCKET = "bedrock-agentcore-codebuild-sources-637423369471-us-east-1"

# Empty the bucket (delete all objects and versions)
aws s3 rm s3://$BUCKET --recursive --region us-east-1
Write-Host "Bucket emptied"

# Delete the bucket
aws s3 rb s3://$BUCKET --region us-east-1
Write-Host "Bucket deleted"
```

Verify:
```powershell
aws s3 ls | Select-String "bedrock-agentcore"
# Should return nothing
```

> ⚠️ If you get `BucketNotEmpty` — the bucket has versioned objects. Use this instead:
> ```powershell
> aws s3api delete-objects --bucket $BUCKET --region us-east-1 `
>     --delete (aws s3api list-object-versions --bucket $BUCKET `
>     --query "{Objects: Versions[].{Key:Key,VersionId:VersionId}}" `
>     --output json)
> aws s3 rb s3://$BUCKET --region us-east-1
> ```

---

### STEP 8 — Delete ECR Repository

```powershell
# Force delete (removes all images inside it too)
aws ecr delete-repository `
    --repository-name bedrock-agentcore-personal_finance_agent `
    --force `
    --region us-east-1

Write-Host "ECR repository deleted"
```

Verify:
```powershell
aws ecr describe-repositories --region us-east-1 --output table
# bedrock-agentcore-personal_finance_agent should not appear
```

---

### STEP 9 — Delete CodeBuild Project

```powershell
aws codebuild delete-project `
    --name bedrock-agentcore-personal_finance_agent-builder `
    --region us-east-1

Write-Host "CodeBuild project deleted"
```

Verify:
```powershell
aws codebuild list-projects --region us-east-1 --output table
# bedrock-agentcore-personal_finance_agent-builder should not appear
```

---

### STEP 10 — Delete Amplify App

```powershell
# Delete the app (this also deletes all branches and deployments)
aws amplify delete-app --app-id d1b8k75dkx4pm5 --region us-east-1
Write-Host "Amplify app deleted"
```

Verify:
```powershell
aws amplify list-apps --region us-east-1 --output table
# finance-advisor-ui / d1b8k75dkx4pm5 should not appear
```

> After deletion, `https://main.d1b8k75dkx4pm5.amplifyapp.com` will return 404.

---

### STEP 11 — Delete CloudWatch Log Groups

**PowerShell:**

```powershell
# Delete the AgentCore runtime log group
$LOG_GROUP = "/aws/bedrock-agentcore/runtimes/personal_finance_agent-9f7zjs8wVT-DEFAULT"

aws logs delete-log-group --log-group-name $LOG_GROUP --region us-east-1 2>$null
Write-Host "Log group deleted (or did not exist)"

# Also check for any related log groups
aws logs describe-log-groups `
    --log-group-name-prefix "/aws/bedrock-agentcore" `
    --region us-east-1 `
    --query "logGroups[].logGroupName" `
    --output table
```

Delete any remaining ones listed:
```powershell
# Replace LOG_GROUP_NAME with each one listed above
aws logs delete-log-group --log-group-name "LOG_GROUP_NAME" --region us-east-1
```

---

## Local Project Cleanup

After all AWS resources are deleted, clean up local build artifacts:

**PowerShell:**

```powershell
cd "E:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode"

# Remove the Amplify zip if it exists
Remove-Item -Force amplify-frontend.zip -ErrorAction SilentlyContinue

# Remove the Next.js build output and static export
Remove-Item -Recurse -Force frontend\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\out -ErrorAction SilentlyContinue

# Optional: remove node_modules to free disk space
Remove-Item -Recurse -Force frontend\node_modules -ErrorAction SilentlyContinue

# Optional: remove the Python venv
Remove-Item -Recurse -Force .venv -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "E:\GenAi-Project-Cloudage\StrandsMultiAgent\.venv" -ErrorAction SilentlyContinue

Write-Host "Local cleanup done"
```

> Keep `frontend/.env.local` and `.bedrock_agentcore.yaml` if you plan to redeploy later. Delete them if this is a final cleanup.

**Clear the AgentCore config (prevents stale ID errors on next deploy):**

```powershell
# Reset stale agent ID in .bedrock_agentcore.yaml
(Get-Content ".bedrock_agentcore.yaml") `
    -replace "agent_id: personal_finance_agent-9f7zjs8wVT", "agent_id: null" `
    -replace "agent_arn: arn:aws:bedrock-agentcore.*", "agent_arn: null" |
    Set-Content ".bedrock_agentcore.yaml"

Write-Host ".bedrock_agentcore.yaml reset"
```

---

## Common Cleanup Errors and Fixes

### Error: `ResourceNotFoundException` on delete-agent-runtime
```
Agent 'personal_finance_agent-9f7zjs8wVT' was not found
```
**Cause:** Already deleted, or the ID changed after a redeployment.  
**Fix:** Check `aws bedrock-agentcore list-agent-runtimes --region us-east-1` — use the actual ID shown there.

---

### Error: `DeleteConflictException` on IAM role
```
Cannot delete entity, must detach all policies first
```
**Cause:** Role still has attached policies.  
**Fix:** List and detach all policies first:
```powershell
aws iam list-attached-role-policies --role-name ROLE_NAME --output table
# Then detach each one with:
aws iam detach-role-policy --role-name ROLE_NAME --policy-arn POLICY_ARN
```

---

### Error: `BucketNotEmpty` on S3 delete
**Cause:** Bucket has versioned objects.  
**Fix:** Use `aws s3 rb s3://BUCKET_NAME --force` which handles versioned objects automatically.

---

### Error: `InvalidParameterException` on Cognito delete
```
You cannot delete a user pool that has been updated within the last 7 days
```
**Cause:** AWS sometimes enforces a cooldown.  
**Fix:** Wait and retry, or delete from AWS Console: Cognito → User Pools → `agentpool` → Delete.

---

### Error: `ResourceInUseException` on AgentCore Runtime delete
**Cause:** An active invocation is running.  
**Fix:** Wait 60 seconds and retry. If persistent, check CloudWatch logs for stuck requests.

---

### Error: Secrets Manager secret still showing after deletion
**Cause:** Default 30-day recovery window. Always use `--force-delete-without-recovery` for immediate deletion (already included in Step 5 above).

---

### Error: `cleanup.sh` Python steps fail
**Cause:** `cleanup.sh` uses `source .venv/bin/activate` expecting a Linux venv. Your `.venv` is at `SourceCode\.venv\Scripts\` (Windows).  
**Fix:** Use the PowerShell steps in this guide instead of `cleanup.sh`.

---

## Final Post-Cleanup Verification Checklist

Run all of these after completing every step above. Every command should return empty or a "not found" error.

```powershell
$env:PYTHONUTF8 = "1"

Write-Host "=== FINAL CLEANUP VERIFICATION ===" -ForegroundColor Cyan

Write-Host "`n1. AgentCore Runtime:" -ForegroundColor Yellow
aws bedrock-agentcore list-agent-runtimes --region us-east-1 --query "agentRuntimes[].agentRuntimeId" --output text

Write-Host "`n2. Bedrock Guardrails:" -ForegroundColor Yellow
aws bedrock list-guardrails --region us-east-1 --query "guardrails[?name=='guardrail-no-bitcoin-advice'].name" --output text

Write-Host "`n3. Cognito User Pools:" -ForegroundColor Yellow
aws cognito-idp list-user-pools --max-results 20 --region us-east-1 --query "UserPools[?Name=='agentpool'].Id" --output text

Write-Host "`n4. Secrets Manager:" -ForegroundColor Yellow
aws secretsmanager list-secrets --filters Key=name,Values=agentcore-project-credentials --region us-east-1 --query "SecretList[?!DeletedDate].Name" --output text

Write-Host "`n5. IAM Runtime Role:" -ForegroundColor Yellow
aws iam get-role --role-name AmazonBedrockAgentCoreSDKRuntime-us-east-1 2>&1 | Select-String "NoSuchEntity|RoleId"

Write-Host "`n6. IAM CodeBuild Role:" -ForegroundColor Yellow
aws iam get-role --role-name AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-5d12c2867b 2>&1 | Select-String "NoSuchEntity|RoleId"

Write-Host "`n7. S3 Bucket:" -ForegroundColor Yellow
aws s3 ls | Select-String "bedrock-agentcore"

Write-Host "`n8. ECR Repository:" -ForegroundColor Yellow
aws ecr describe-repositories --region us-east-1 --query "repositories[?repositoryName=='bedrock-agentcore-personal_finance_agent'].repositoryName" --output text 2>&1

Write-Host "`n9. CodeBuild Project:" -ForegroundColor Yellow
aws codebuild list-projects --region us-east-1 --query "projects[?contains(@,'bedrock-agentcore')]" --output text

Write-Host "`n10. Amplify App:" -ForegroundColor Yellow
aws amplify list-apps --region us-east-1 --query "apps[?appId=='d1b8k75dkx4pm5'].name" --output text

Write-Host "`n11. CloudWatch Log Groups:" -ForegroundColor Yellow
aws logs describe-log-groups --log-group-name-prefix "/aws/bedrock-agentcore" --region us-east-1 --query "logGroups[].logGroupName" --output text

Write-Host "`n=== All items above should be empty ===" -ForegroundColor Cyan
```

**Expected result for each:** empty output (no resource names printed).

---

## Quick Cleanup — Using cleanup.sh (Git Bash)

The easiest way to clean up is to run the existing `cleanup.sh` script from **Git Bash**.

```bash
cd /e/GenAi-Project-Cloudage/StrandsMultiAgent/StrandsMultiAgent/SourceCode
bash cleanup.sh
```

It will ask:
```
Are you sure? (yes/no):
```
Type `yes` and press Enter.

**What cleanup.sh deletes automatically:**
- ✅ AgentCore Runtime
- ✅ Bedrock Guardrail
- ✅ Cognito User Pool
- ✅ IAM Roles (Runtime + CodeBuild + Amplify)
- ✅ S3 Bucket
- ✅ ECR Repository
- ✅ CodeBuild Project
- ✅ Amplify App
- ✅ Secrets Manager secret

**What cleanup.sh does NOT delete — do these manually after:**
- ❌ AgentCore Memory — see Step 2 below
- ❌ CloudWatch Log Groups — see Step 11 below

After `bash cleanup.sh` finishes, continue from [STEP 2 — Delete AgentCore Memory](#step-2--delete-agentcore-memory-if-it-exists) below.

---

## Quick Cleanup — All Steps in One Block

If you want to run everything at once (after reading and understanding the steps above):

```powershell
cd "E:\GenAi-Project-Cloudage\StrandsMultiAgent\StrandsMultiAgent\SourceCode"
.\.venv\Scripts\Activate.ps1
$env:PYTHONUTF8 = "1"

# 1. AgentCore Runtime
aws bedrock-agentcore delete-agent-runtime --agent-runtime-id personal_finance_agent-9f7zjs8wVT --region us-east-1
Write-Host "1. Runtime deleted"

# 2. AgentCore Memory
python -c "
from bedrock_agentcore.memory import MemoryClient
mc = MemoryClient()
for m in mc.list_memories():
    if 'FinancialAdvisor' in m.get('name','') or 'FinancialAdvisor' in m.get('id',''):
        mc.delete_memory(memory_id=m['id'])
        print('Memory deleted:', m['id'])
"
Write-Host "2. Memory deleted (if existed)"

# 3. Guardrail
python -c "from utils.guardrail import delete_guardrail; delete_guardrail()"
Write-Host "3. Guardrail deleted"

# 4. Cognito
python -c "from utils.agentcore_utils import delete_cognito_user_pool; delete_cognito_user_pool()"
Write-Host "4. Cognito deleted"

# 5. Secrets Manager
$SECRET = (aws secretsmanager list-secrets --filters Key=name,Values=agentcore-project-credentials --region us-east-1 --query "SecretList[?!DeletedDate].Name" --output text)
if ($SECRET -and $SECRET -ne "None") {
    aws secretsmanager delete-secret --secret-id $SECRET --force-delete-without-recovery --region us-east-1
    Write-Host "5. Secret deleted: $SECRET"
}

# 6. IAM Roles
$CB_ROLE = "AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-5d12c2867b"
$INLINE = (aws iam list-role-policies --role-name $CB_ROLE --query "PolicyNames[]" --output text 2>$null) -split "\s+"
foreach ($P in $INLINE) { if ($P) { aws iam delete-role-policy --role-name $CB_ROLE --policy-name $P 2>$null } }
aws iam delete-role --role-name $CB_ROLE 2>$null

$RT_ROLE = "AmazonBedrockAgentCoreSDKRuntime-us-east-1"
aws iam detach-role-policy --role-name $RT_ROLE --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess 2>$null
aws iam detach-role-policy --role-name $RT_ROLE --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess 2>$null
aws iam detach-role-policy --role-name $RT_ROLE --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly 2>$null
aws iam delete-role --role-name $RT_ROLE 2>$null
Write-Host "6. IAM roles deleted"

# 7. S3 Bucket
aws s3 rb s3://bedrock-agentcore-codebuild-sources-637423369471-us-east-1 --force --region us-east-1 2>$null
Write-Host "7. S3 bucket deleted"

# 8. ECR Repository
aws ecr delete-repository --repository-name bedrock-agentcore-personal_finance_agent --force --region us-east-1 2>$null
Write-Host "8. ECR repository deleted"

# 9. CodeBuild Project
aws codebuild delete-project --name bedrock-agentcore-personal_finance_agent-builder --region us-east-1 2>$null
Write-Host "9. CodeBuild project deleted"

# 10. Amplify App
aws amplify delete-app --app-id d1b8k75dkx4pm5 --region us-east-1 2>$null
Write-Host "10. Amplify app deleted"

# 11. CloudWatch Log Groups
aws logs delete-log-group --log-group-name "/aws/bedrock-agentcore/runtimes/personal_finance_agent-9f7zjs8wVT-DEFAULT" --region us-east-1 2>$null
Write-Host "11. Log groups deleted"

# 12. Local cleanup
Remove-Item -Force amplify-frontend.zip -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\out -ErrorAction SilentlyContinue
Write-Host "12. Local artifacts cleaned"

Write-Host ""
Write-Host "All cleanup steps completed." -ForegroundColor Green
Write-Host "Run the verification block above to confirm everything is deleted." -ForegroundColor Yellow
```

---

## Cost Impact After Cleanup

Once all resources are deleted, charges stop immediately for:
- AgentCore Runtime (container compute)
- ECR (image storage)
- Cognito (MAU billing)
- Amplify (hosting)
- CodeBuild (build minutes)

**Note:** S3 storage costs cents per GB-month. Deleting the bucket stops all storage charges.

CloudWatch log retention may still accrue minor charges until log groups are deleted.
