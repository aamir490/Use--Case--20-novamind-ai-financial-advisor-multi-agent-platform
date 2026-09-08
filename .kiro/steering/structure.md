# Project Structure

```
StrandsMultiAgent/
├── PreSalesTeam/                    # Client-facing documents
│   ├── Client_Requirements.md       # Full requirements spec (3 phases)
│   ├── CloudAge_Enterprise_AI_Success_Story.pdf
│   └── Intelligent Financial Services AI Agent Platform - CloudAge Proposal.pdf
│
├── Solutions_Architect/             # Architecture & deployment docs
│   ├── CloudAge Deployment Guide.pdf
│   ├── Prerequisites_for_Production.md  # POC → Production gap analysis
│   └── StandsAgent_AgentCoreRuntime.png
│
├── SourceCode/                      # All executable code lives here
│   ├── main.py                      # Orchestrator agent + BedrockAgentCoreApp entrypoint
│   ├── budget_agent.py              # Budget specialist agent (50/30/20, charts, Pydantic output)
│   ├── financial_analysis_agent.py  # Investment agent (stocks, portfolios, comparisons)
│   ├── utils/                       # Shared utilities
│   │   ├── __init__.py              # Re-exports utility functions
│   │   ├── agentcore_utils.py       # Cognito setup, credential retrieval
│   │   ├── guardrail.py             # Bedrock Guardrail creation/lookup
│   │   └── message_formatter.py     # Response formatting helpers
│   │
│   ├── frontend/                    # Next.js chat UI
│   │   ├── pages/
│   │   │   ├── index.tsx            # Main chat page (auth + messaging)
│   │   │   └── _app.tsx             # App wrapper
│   │   ├── src/
│   │   │   ├── components/          # ChatInput, ChatMessage, LoginForm
│   │   │   └── lib/                 # agent.ts (SSE client), auth.ts (Cognito)
│   │   ├── styles/globals.css       # All styling (no CSS modules/Tailwind)
│   │   ├── .env.local               # Runtime config (endpoint, Cognito)
│   │   └── package.json
│   │
│   ├── images/                      # Architecture diagrams for README/notebooks
│   ├── Dockerfile                   # Production container (uv + otel)
│   ├── requirements.txt             # Pinned Python deps (uv pip compile output)
│   ├── setup.sh                     # Full project bootstrap
│   ├── deploy.sh                    # Deploy agent to AgentCore
│   ├── deploy-frontend.sh           # Build & deploy frontend to Amplify
│   ├── cleanup.sh                   # Tear down all AWS resources
│   ├── amplify.yml                  # Amplify build spec
│   │
│   ├── AWS_SingleAgent.ipynb        # POC notebook: single budget agent
│   ├── AWS_MultiAgent.ipynb         # POC notebook: multi-agent orchestrator
│   ├── AWS_Deployment.ipynb         # POC notebook: AgentCore deployment
│   └── AWS_CleanUp.ipynb            # POC notebook: resource cleanup
│
└── .kiro/steering/                  # AI assistant steering rules
```

## Conventions

- **Agent pattern**: Each agent is a standalone Python module exporting an `Agent` instance (importable by the orchestrator)
- **Tools as decorated functions**: Use `@tool` decorator from `strands` for agent-callable functions
- **Structured output**: Pydantic models define agent response schemas (e.g., `FinancialReport`)
- **Error handling**: Tools return user-friendly error strings (with emoji indicators) rather than raising exceptions
- **Logging**: Each module configures its own logger via `logging.getLogger(__name__)`
- **Region detection**: Use `boto3.Session().region_name` for dynamic region resolution
- **Notebooks for POC**: Jupyter notebooks demonstrate the progression; production code is in `.py` files
- **Shell scripts for ops**: All deployment/setup automation is in bash scripts (not IaC yet)
