# Tech Stack

## Backend (Python)

- **Runtime**: Python 3.12
- **Agent Framework**: Strands Agents SDK (`strands-agents`)
- **Agent Tools**: `strands-agents-tools` (calculator, etc.)
- **LLM**: Amazon Nova Pro (`amazon.nova-pro-v1:0`) via Amazon Bedrock
- **Deployment SDK**: `bedrock-agentcore` + `bedrock-agentcore-starter-toolkit`
- **Data Validation**: Pydantic v2
- **Financial Data**: yfinance (real-time stock data)
- **Visualization**: matplotlib
- **Data Processing**: pandas, numpy
- **Cloud SDK**: boto3
- **Observability**: OpenTelemetry (`opentelemetry-instrument`)
- **Package Management**: uv (for dependency compilation and Docker builds)

## Frontend (Next.js)

- **Framework**: Next.js 12.3.4
- **Language**: TypeScript
- **UI**: React 18.2 with custom CSS (no component library)
- **Markdown Rendering**: react-markdown
- **Auth**: Custom Cognito integration (SRP-based, no Amplify SDK)
- **Communication**: Fetch API with SSE streaming

## Infrastructure (AWS)

- Amazon Bedrock AgentCore Runtime (container hosting)
- Amazon Cognito (user pool + JWT auth)
- Amazon ECR (container registry)
- AWS CodeBuild (ARM64/Graviton image builds)
- AWS Amplify (frontend static hosting)
- AWS Secrets Manager (credential storage)
- Amazon Bedrock Guardrails (content safety)
- CloudWatch (logging)

## Common Commands

### Backend Setup & Run
```bash
# Full setup (Python env, IAM, Cognito, guardrail, frontend deps)
./setup.sh

# Activate virtual environment
source .venv/bin/activate

# Run locally
python -m main

# Run with observability
opentelemetry-instrument python -m main

# Deploy agent to AgentCore
./deploy.sh

# Clean up all AWS resources
./cleanup.sh
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- -p 3001    # Dev server at http://localhost:3001
npm run build             # Production build (static export)
```

### Deploy Frontend to Amplify
```bash
./deploy-frontend.sh
```

### Docker (local testing)
```bash
docker build -t finance-assistant .
docker run -p 8080:8080 -p 8000:8000 finance-assistant
```

## Key Configuration

- AWS Region: `us-east-1`
- Model temperature: `0.0` (deterministic for financial advice)
- Frontend env: `frontend/.env.local` (AgentCore endpoint, Cognito config)
- Guardrail: blocks crypto/bitcoin investment advice
- Container: `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` base image
