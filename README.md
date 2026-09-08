# NovaMind AI Financial Advisor

AI-powered multi-agent financial assistant built on **Amazon Bedrock AgentCore** with a **Next.js** streaming chat frontend.

NEXT Insurance branding · Powered by NovaMind Ai · Built by Aamir

---

## Screenshots

### Login

![NovaMind AI — Login](../project-pic/login_page1.png)

### Chat Dashboard

![NovaMind AI — Dashboard](../project-pic/dashboard2.png)

### Budget Planning (Streaming Response)

![NovaMind AI — Budget breakdown](../project-pic/dashboard3.png)

### Multi-Agent Chat Output

![NovaMind AI — Chat output](../project-pic/NovaMind%20AI%20Financial%20Advisor_output.png)

---

## Architecture

### Multi-Agent Design (Local / Development)

![Multi-agent architecture](../project-pic/AWS_strands_MultiAgent.png)

### Production Deployment on AWS

![Multi-agent deployment on AgentCore](../project-pic/AWS_strands_MultiAgent_deploy.png)

### Single Agent (Phase 1)

![Single agent architecture](../project-pic/AWS_strands_singleAgent.png)

### AWS Infrastructure

| Component | Screenshot |
|-----------|------------|
| Amazon Bedrock Guardrails | ![Bedrock Guardrail](../project-pic/AWS_bedrock_guardrail.png) |
| Amazon Cognito User Pool | ![Cognito User Pool](../project-pic/AWS_cognito-userpoool.png) |
| Cognito User | ![Cognito User](../project-pic/AWS_COGNITO_USER.png) |
| Amazon ECR Repository | ![ECR Repository](../project-pic/AWS_ecr_repo.png) |

### Request Flow

```
User → Frontend (Next.js / Amplify)
         ↓ Bearer token + SSE
       AgentCore Runtime (us-east-1)
         ↓
       Orchestrator Agent (main.py)
         ├── Budget Agent (budget_agent.py)
         └── Financial Analysis Agent (financial_analysis_agent.py)
```

- **Model:** Amazon Nova Pro (`amazon.nova-pro-v1:0`)
- **Auth:** Cognito USER_PASSWORD_AUTH
- **Guardrail:** Blocks Bitcoin/crypto investment advice
- **Memory:** AgentCore Memory for conversation persistence

For full technical documentation, see [`architecture.md`](../architecture.md) and [`interview.md`](../interview.md) in the repo root.

---

## Backend (Python)

### Prerequisites
- Python 3.12 (`brew install python@3.12` on macOS)
- AWS CLI v2 configured with `us-east-1` region (`aws configure set region us-east-1`)
- AWS account with the following enabled:
  - Amazon Nova Pro model access in Bedrock (us-east-1) — enable via AWS Console → Bedrock → Model access
  - Permissions to create: IAM roles, Cognito user pools, ECR repos, CodeBuild projects, Secrets Manager secrets, Amplify apps, Bedrock AgentCore runtimes
- Node.js v18+ (for frontend)
- No Docker required (CodeBuild handles container builds in the cloud)

### Quick Start (Fresh Account)

```bash
chmod +x setup.sh deploy.sh deploy-frontend.sh
./setup.sh            # Sets up Python env, IAM roles, Cognito, guardrail, frontend deps
./deploy.sh           # Deploys agent to AgentCore Runtime (~5 min first time)
./deploy-frontend.sh  # Builds frontend & deploys to Amplify
```

### Retrieve Login Credentials

```bash
source .venv/bin/activate
python -c "from utils import retrieve_credentials_from_secrets_manager; print(retrieve_credentials_from_secrets_manager())"
```

### Run locally

```bash
source .venv/bin/activate
python -m main
```

### Run with OpenTelemetry (production mode)

```bash
opentelemetry-instrument python -m main
```

### Deploy to AgentCore

```bash
./deploy.sh
```

### Create Cognito user pool & credentials

```python
from utils import setup_cognito_user_pool
result = setup_cognito_user_pool()
```

### Retrieve stored credentials

```python
from utils import retrieve_credentials_from_secrets_manager
creds = retrieve_credentials_from_secrets_manager()  # Auto-discovers the secret
print(f"Username: {creds['username']}")
print(f"Password: {creds['password']}")
```

### Build Docker image

```bash
docker build -t novamind-financial-advisor .
docker run -p 8080:8080 -p 8000:8000 novamind-financial-advisor
```

---

## Frontend (Next.js)

### Prerequisites
- Node.js (any recent version)
- Backend deployed to AgentCore (or running locally)

### Setup

```bash
cd frontend
npm install
```

### Configure environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_AGENTCORE_ENDPOINT=https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/YOUR_ENCODED_ARN/invocations
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_COGNITO_REGION=us-east-1
```

### Run development server

```bash
npm run dev -- -p 3001
```

Open http://localhost:3001

### Build for production

```bash
npm run build
npm run start
```

### Deploy to AWS Amplify

```bash
cd ..
./deploy-frontend.sh
```

This builds the frontend as a static export, creates an Amplify app, and deploys automatically (no Docker or CodeCommit push required).

---

## Scripts

| Script | Description |
|--------|-------------|
| `./setup.sh` | Full project setup (Python env, IAM roles, Cognito, guardrail, frontend deps) |
| `./deploy.sh` | Deploy backend agent to AgentCore Runtime via CodeBuild |
| `./deploy-frontend.sh` | Build & deploy frontend to AWS Amplify (static export) |
| `./cleanup.sh` | Remove all AWS resources (AgentCore, Cognito, ECR, IAM, Amplify) |

## Jupyter Notebooks (POC Demo)

Run these in order for a step-by-step walkthrough:

| Notebook | Description |
|----------|-------------|
| `AWS_SingleAgent.ipynb` | Build a single Strands agent with budget analysis |
| `AWS_MultiAgent.ipynb` | Build multi-agent orchestrator with investment analysis |
| `AWS_Deployment.ipynb` | Deploy to AgentCore Runtime with Cognito, Memory & Guardrails |
| `AWS_CleanUp.ipynb` | Tear down all AWS resources |

---

## Features

- **Budget Planning** — 50/30/20 rule, spending analysis, financial health score
- **Stock Research** — Real-time data via yfinance, 52-week range, YTD performance
- **Portfolio Builder** — Conservative, moderate, or aggressive allocations
- **Multi-Agent Routing** — Orchestrator delegates to budget and investment specialists
- **Streaming Chat** — Real-time SSE responses in the NovaMind UI
- **Safe & Guardrailed** — Bedrock Guardrails block crypto/investment advice on budget scope
