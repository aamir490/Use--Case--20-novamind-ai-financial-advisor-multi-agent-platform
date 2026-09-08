# Client Requirements — AI-Powered Multi-Agent Financial Advisor

## Project Overview

Build and deploy a production-ready, AI-powered personal financial advisory system using Amazon Bedrock and the Strands Agents SDK. The system must demonstrate a progressive architecture — starting from a single-purpose agent, scaling to a coordinated multi-agent system, and culminating in a fully managed cloud deployment on AWS.

---

## Phase 1: Single Agent — Personal Budget Assistant

### Objective
Develop a focused AI agent that provides personal budgeting guidance, spending analysis, and actionable financial recommendations.

### Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| R1.1 | Responsible AI Guardrails | Integrate Amazon Bedrock Guardrails to block cryptocurrency and investment advice. The agent must refuse out-of-scope queries gracefully. |
| R1.2 | Agent Persona (System Prompt) | Define a system prompt that constrains the agent to budgeting and spending analysis only. Responses must be concise, actionable, and include 2–3 specific steps. |
| R1.3 | Conversation Memory Management | Implement a Summarizing Conversation Manager to handle long conversations without exceeding model token limits. Must summarize older messages while preserving the most recent context. |
| R1.4 | Real-Time Streaming | Support streaming responses so users see output as it's generated, improving perceived performance in interactive applications. |
| R1.5 | Custom Financial Tools | Provide the agent with callable tools: |
|      | — Budget Calculator | Calculate a 50/30/20 budget breakdown (Needs/Wants/Savings) for any given monthly income. |
|      | — Financial Chart Generator | Generate pie chart visualizations of spending and budget categories. |
|      | — General Calculator | Perform arbitrary financial math operations on demand. |
| R1.6 | Structured Output (Pydantic) | Return financial reports in a consistent, schema-validated format (monthly income, budget categories with amounts/percentages, recommendations, and a financial health score 1–10). |
| R1.7 | Exportable Module | Export the final agent as a standalone Python module (`budget_agent.py`) for reuse in subsequent phases. |

### Acceptance Criteria
- Agent correctly refuses investment/crypto queries via guardrail.
- Budget calculations are accurate and follow the 50/30/20 rule.
- Structured output conforms to the defined Pydantic schema every time.
- Streaming output displays incrementally in a notebook environment.

---

## Phase 2: Multi-Agent System — Financial Advisory Orchestrator

### Objective
Scale from a single agent to a coordinated multi-agent architecture using the "Agents as Tools" pattern, where specialized agents collaborate under an intelligent orchestrator.

### Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| R2.1 | Budget Agent as Tool | Wrap the Phase 1 budget agent as a callable tool so the orchestrator can invoke it for budgeting queries. Must return structured `FinancialReport` output. |
| R2.2 | Financial Analysis Agent | Create a second specialized agent focused on investment research with three tools: |
|      | — Stock Analysis | Retrieve real-time stock data (price, 52-week range, YTD change, volume, sector) using yfinance. |
|      | — Portfolio Creator | Generate diversified portfolio recommendations based on risk level (conservative, moderate, aggressive) and investment amount. Include input validation. |
|      | — Stock Comparison | Compare performance of up to 5 stocks over configurable time periods (1m, 3m, 6m, 1y). |
| R2.3 | Orchestrator Agent | Build a top-level coordinator that: |
|      | — Intelligent Routing | Determines which specialist agent(s) to consult based on user query. |
|      | — Multi-Agent Coordination | Can invoke both agents for complex queries (e.g., "budget and invest"). |
|      | — Response Synthesis | Combines outputs from multiple agents into a cohesive answer. |
|      | — Context Management | Maintains conversation flow across agent interactions. |
| R2.4 | Guardrails on Orchestrator | Apply the same Bedrock content guardrail to the orchestrator layer for consistent safety filtering. |
| R2.5 | Exportable Modules | Export the financial analysis agent as `financial_analysis_agent.py` and the orchestrator as `main.py` for deployment. |

### Acceptance Criteria
- Budget queries route to budget agent; investment queries route to financial analysis agent.
- Combined queries (budget + investment) invoke both agents and return a unified response.
- Stock data is fetched in real-time and presented with accurate metrics.
- Portfolio recommendations include proper disclaimers and input validation (min $100, max $100M, valid risk levels).
- Guardrail blocks inappropriate content at the orchestrator level.

---

## Phase 3: Production Deployment — Amazon Bedrock AgentCore

### Objective
Deploy the multi-agent system to a fully managed, enterprise-grade production environment using Amazon Bedrock AgentCore Runtime with authentication, memory, and observability.

### Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| R3.1 | AgentCore Runtime Packaging | Package the orchestrator as a `BedrockAgentCoreApp` exposing `/invocations` (agent logic) and `/ping` (health check) endpoints. Deploy as a serverless container. |
| R3.2 | Authentication (Amazon Cognito) | Set up Amazon Cognito user pool with JWT-based authentication. Only authenticated users with valid bearer tokens can invoke the agent endpoint. Credentials stored securely in AWS Secrets Manager. |
| R3.3 | AgentCore Memory Integration | Configure persistent memory with three strategies: |
|      | — Semantic Strategy | Extracts and stores user financial facts (income, expenses, goals) across sessions. |
|      | — User Preference Strategy | Captures and recalls user preferences (risk tolerance, budget priorities). |
|      | — Summary Strategy | Creates conversation summaries for long-term context retention. |
| R3.4 | Container Build & Deploy | Use AWS CodeBuild to build ARM64 (Graviton) container images, push to Amazon ECR, and deploy to AgentCore Runtime. No local Docker required. |
| R3.5 | Environment Configuration | Pass environment variables for memory integration (`AGENTCORE_MEMORY_ID`) and observability (`OTEL_PYTHON_EXCLUDED_URLS`). |
| R3.6 | Streaming Invocation | Production endpoint must support streaming responses over HTTPS with proper session management. |
| R3.7 | Observability & Logging | Enable AgentCore Observability for tracing, debugging, and monitoring agent performance. Logs accessible via CloudWatch. |
| R3.8 | IAM & Security | Use a dedicated IAM execution role (`AmazonBedrockAgentCoreSDKRuntime`) with least-privilege permissions. |

### Acceptance Criteria
- Agent deploys successfully with status `READY`.
- Authenticated invocations return streaming responses from the production endpoint.
- Memory persists user financial facts across separate sessions.
- Unauthenticated requests are rejected.
- Deployment completes via CodeBuild without requiring local container tooling.
- Agent logs are visible in CloudWatch under the AgentCore log group.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    Amazon Bedrock AgentCore                       │
│                     (Production Runtime)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌───────────────────────────────────────────────────────┐     │
│   │              Orchestrator Agent                         │     │
│   │   (Routing · Coordination · Synthesis)                 │     │
│   └────────────┬──────────────────────┬────────────────────┘     │
│                │                      │                           │
│   ┌────────────▼──────────┐  ┌───────▼────────────────────┐     │
│   │   Budget Agent        │  │  Financial Analysis Agent   │     │
│   │   • Budget Calculator │  │  • Stock Analysis           │     │
│   │   • Chart Generator   │  │  • Portfolio Creator        │     │
│   │   • Math Calculator   │  │  • Stock Comparison         │     │
│   └───────────────────────┘  └─────────────────────────────┘     │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Bedrock Guardrails │ Cognito Auth │ AgentCore Memory │ Logging  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Agent Framework | Strands Agents SDK |
| LLM | Amazon Nova Pro (via Bedrock) |
| Hosting | Amazon Bedrock AgentCore Runtime |
| Authentication | Amazon Cognito (JWT) |
| Memory | AgentCore Memory (Semantic, Preference, Summary) |
| Content Safety | Amazon Bedrock Guardrails |
| Container Registry | Amazon ECR |
| Build Pipeline | AWS CodeBuild (ARM64/Graviton) |
| Financial Data | yfinance (real-time stock data) |
| Structured Output | Pydantic |
| Observability | AgentCore Observability + CloudWatch |

---

## Delivery Milestones

| Milestone | Deliverable | Phase |
|-----------|-------------|-------|
| M1 | Working single budget agent with tools, guardrails, structured output | Phase 1 |
| M2 | Multi-agent orchestrator routing between budget and investment agents | Phase 2 |
| M3 | Production deployment on AgentCore with auth, memory, and streaming | Phase 3 |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Agent responses must be deterministic (temperature = 0.0) for financial advice consistency. |
| NFR-2 | System must handle errors gracefully — return structured error responses, never crash. |
| NFR-3 | All financial disclaimers must be included (POC purposes only, consult a financial advisor). |
| NFR-4 | Memory data retained for 90 days per user session. |
| NFR-5 | Container images must target ARM64 architecture for cost-optimized Graviton deployment. |
| NFR-6 | Agent endpoint must respond within 100 seconds timeout for complex multi-agent queries. |
