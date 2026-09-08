# Product Overview

AI-powered multi-agent financial advisor built for NEXT Insurance, powered by CloudAge. The system provides personalized budget planning, investment analysis, stock research, and portfolio recommendations through a conversational chat interface.

## Architecture

An orchestrator agent routes user queries to specialized sub-agents:

- **Budget Agent** — Personal budgeting (50/30/20 rule), spending analysis, financial health scoring, chart generation
- **Financial Analysis Agent** — Stock research via yfinance, diversified portfolio creation (conservative/moderate/aggressive), multi-stock performance comparison

The orchestrator synthesizes responses from one or both agents into a unified answer.

## Deployment Target

Amazon Bedrock AgentCore Runtime (us-east-1) with:
- Cognito JWT authentication
- AgentCore Memory for cross-session persistence (semantic, preference, summary strategies)
- Bedrock Guardrails (blocks crypto/investment advice from budget agent scope)
- Streaming SSE responses
- ARM64/Graviton containers via CodeBuild

## Client Context

POC for NEXT Insurance (ERGO NEXT Insurance) — a digital-first SMB insurance carrier. The production roadmap envisions replacing financial agents with insurance-domain agents (underwriting, claims, policy, compliance, customer service).
