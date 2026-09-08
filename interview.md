# Interview Preparation — NovaMind AI Financial Advisor

> All content below is derived from the actual repository. Items marked **Inferred from implementation** are reasonable conclusions not explicitly stated in requirements. Items marked **Verified from code** are directly supported by source files.

---

## 1. 30-Second Project Introduction

> "The project I worked on was **NovaMind AI Financial Advisor** — an AI-powered multi-agent platform built for a NEXT Insurance and CloudAge proof of concept. It gives users a conversational chat interface where they can ask about budgeting, spending analysis, stock research, and portfolio recommendations.
>
> At a high level, there's a **Next.js frontend** on AWS Amplify, and the backend is a **Python multi-agent system** deployed on **Amazon Bedrock AgentCore Runtime**. An orchestrator agent routes each question to specialist agents — one for budgeting and one for investment analysis — both powered by **Amazon Nova Pro** through the **Strands Agents SDK**.
>
> My role involved building and integrating the full stack — the agent logic, the streaming chat UI, Cognito authentication, guardrails, and the AWS deployment pipeline."

**Technologies to mention:** Python, Strands Agents SDK, Amazon Bedrock (Nova Pro), AgentCore Runtime, Next.js, TypeScript, Cognito, AWS Amplify, yfinance, Pydantic.

---

## 2. Client / Business Requirement

**Verified from `PreSalesTeam/Client_Requirements.md`:**

The client needed to demonstrate a **progressive AI architecture** in three phases:

1. **Phase 1 — Single Budget Agent:** A focused agent for personal budgeting with guardrails, custom tools, structured Pydantic output, streaming, and conversation memory management.
2. **Phase 2 — Multi-Agent System:** Scale to an orchestrator that routes between budget and investment agents using the "Agents as Tools" pattern.
3. **Phase 3 — Production Deployment:** Deploy to Amazon Bedrock AgentCore with Cognito auth, AgentCore Memory, container builds via CodeBuild, and observability.

**Business constraints (from requirements):**
- Temperature must be 0.0 for deterministic financial advice
- Guardrails must block cryptocurrency/investment advice on the budget agent
- ARM64 containers for cost-optimized deployment
- Admin-only user provisioning (no self-registration)
- Financial disclaimers required (POC purposes only)

**Inferred from implementation:** The POC serves as a **technology demonstration** for NEXT Insurance's future AI platform — eventually replacing financial agents with insurance-domain agents (underwriting, claims, policy, compliance).

---

## 3. What We Built

### Main Features
- Conversational chat UI with streaming responses and suggestion prompts
- Budget planning using the 50/30/20 rule with financial health scoring
- Structured budget reports (Pydantic-validated JSON schema)
- Real-time stock analysis via yfinance (price, 52-week range, YTD change, sector)
- Portfolio recommendations (conservative, moderate, aggressive) with input validation
- Multi-stock performance comparison (up to 5 symbols, configurable periods)
- Intelligent multi-agent routing and response synthesis
- Content safety via Bedrock Guardrails (blocks crypto/Bitcoin advice)
- Cross-session memory via AgentCore Memory
- Cognito JWT authentication with admin-provisioned users

### Main Modules
| Module | Purpose |
|--------|---------|
| `main.py` | Orchestrator + AgentCore deployment entrypoint |
| `budget_agent.py` | Budget specialist with tools and structured output |
| `financial_analysis_agent.py` | Investment specialist with yfinance tools |
| `frontend/` | Next.js chat application |
| `utils/` | Cognito setup, guardrails, debug formatters |
| Shell scripts | Setup, deploy, cleanup automation |

### User Experience
1. User lands on login page (NovaMind branding)
2. Signs in with Cognito credentials
3. Sees empty chat with feature cards and suggestion chips
4. Sends a message → streaming response appears incrementally as Markdown
5. Can ask follow-up questions within the same session

---

## 4. My Role

### Responsibilities Evidenced by the Project

Based on code authorship markers and implementation breadth:

- **Multi-agent architecture:** Designed and implemented orchestrator with Agents-as-Tools pattern (`main.py`)
- **Specialist agents:** Built budget agent with Pydantic structured output and financial analysis agent with yfinance integration
- **Frontend development:** Built complete Next.js chat UI with Cognito auth and SSE streaming client
- **AWS deployment:** Created setup/deploy/cleanup shell scripts for AgentCore, Cognito, Amplify, IAM
- **Security:** Integrated Bedrock Guardrails and Cognito JWT authorizer on AgentCore runtime
- **Memory integration:** Wired AgentCore Memory read/write in the invocation handler
- **Documentation:** Jupyter notebooks demonstrating the 3-phase progression

**Verified from code:** Footer credits "Built by Aamir" in `index.tsx` and `LoginForm.tsx`.

### Responsibilities I Can Discuss If They Match My Actual Experience

Personalize based on what you actually did:

| Area | If you worked on it, discuss... |
|------|--------------------------------|
| Agent prompt engineering | System prompts in `main.py`, `budget_agent.py`, `financial_analysis_agent.py` |
| Tool development | `@tool` functions — budget calculator, stock analysis, portfolio creator |
| Frontend UX | Chat components, suggestion chips, streaming indicator, Markdown rendering |
| DevOps / AWS | Shell scripts, Dockerfile, `.bedrock_agentcore.yaml`, Amplify deployment |
| Security | Guardrail word policies, Cognito password policy, JWT authorizer config |
| Requirements | Mapping Client_Requirements.md phases to implemented code |
| Production planning | `Prerequisites_for_Production.md` gap analysis and insurance roadmap |

**Do not claim:** Specific team size, sprint counts, client meetings, or performance metrics unless you have that information.

---

## 5. Architecture Explanation (Spoken)

> "At a high level, the system follows a **multi-agent orchestration pattern** deployed on AWS.
>
> The **frontend** is a Next.js application exported as static files and hosted on **AWS Amplify**. When a user logs in, the frontend calls **Amazon Cognito** directly using the USER_PASSWORD_AUTH flow — no Amplify SDK — and stores the JWT access token in localStorage.
>
> When the user sends a chat message, the frontend makes a POST request to the **Bedrock AgentCore Runtime** endpoint with the Bearer token and the message payload. AgentCore validates the JWT against Cognito's OIDC discovery URL before forwarding to our container.
>
> Inside the container, **`main.py`** defines a `BedrockAgentCoreApp` with an async entrypoint. Before processing, it optionally queries **AgentCore Memory** for relevant user facts. Then the **orchestrator agent** — built with the Strands SDK and powered by **Amazon Nova Pro** — decides which specialist to invoke.
>
> For budget questions, it calls the **budget agent**, which can use tools like a 50/30/20 calculator and returns a **Pydantic-validated FinancialReport**. For investment questions, it calls the **financial analysis agent**, which fetches real-time stock data from **yfinance**.
>
> The orchestrator synthesizes the results and streams the response back as **Server-Sent Events**. The frontend parses the SSE stream, strips internal thinking tags, and renders the response as Markdown.
>
> **Bedrock Guardrails** are applied at the orchestrator model level to block inappropriate content like crypto investment advice. And **OpenTelemetry** instrumentation sends traces to CloudWatch for observability."

---

## 6. One Important End-to-End Flow

**Best flow for interviews: Budget query with structured output**

```text
User clicks "Create a monthly budget for $6,000 income"
    ↓
frontend/pages/index.tsx → handleSend()
    ↓
frontend/src/lib/agent.ts → sendMessage()
    POST https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/{arn}/invocations
    Headers: Authorization: Bearer {jwt}, X-Amzn-Bedrock-AgentCore-Runtime-Session-Id
    Body: { prompt, session_id, actor_id: "default_user" }
    ↓
AgentCore Runtime validates JWT → forwards to container
    ↓
main.py → invoke(payload) async generator
    ↓
MemoryClient.query_records() — optional context from previous sessions
    ↓
orchestrator_agent.stream_async("Create a monthly budget for $6,000 income")
    ↓
Nova Pro LLM decides → call budget_agent_tool
    ↓
main.py → budget_agent_tool(query)
    budget_agent.structured_output(output_model=FinancialReport, prompt=query)
    ↓
Budget agent may invoke calculate_budget(6000) tool
    Returns: "Needs: $3,000 (50%), Wants: $1,800 (30%), Savings: $1,200 (20%)"
    ↓
LLM generates FinancialReport Pydantic object:
    { monthly_income: 6000, budget_categories: [...], recommendations: [...], financial_health_score: 7 }
    ↓
Orchestrator synthesizes natural language response from structured data
    ↓
stream_async yields SSE chunks → AgentCore → frontend
    ↓
agent.ts parses SSE, stripThinkingTags(), onChunk updates React state
    ↓
ChatMessage.tsx renders Markdown response
    ↓
MemoryClient.create_event() stores conversation for future sessions
```

**If interviewer asks "How exactly did you implement structured output?"**

> "In `budget_agent.py`, I defined Pydantic models — `FinancialReport` and `BudgetCategory` — with Field descriptions. The Strands SDK's `structured_output()` method instructs the LLM to generate a response matching that exact schema. The orchestrator wraps this in a `@tool` function called `budget_agent_tool` in `main.py`, so the orchestrator can invoke it like any other tool and get back a typed `FinancialReport` object."

---

## 7. Biggest Technical Challenge

### Problem
Building a **multi-agent system that streams responses in production** while maintaining authentication, memory context, and content safety — all deployed to a managed serverless container runtime (AgentCore) rather than a traditional API server.

### Why It Was Difficult
1. **No traditional HTTP framework** — AgentCore uses an async generator entrypoint, not Flask/FastAPI routes
2. **Multi-agent latency** — Orchestrator may call multiple agents sequentially, each making Bedrock LLM calls
3. **SSE parsing on frontend** — AgentCore streaming format required custom parsing logic with thinking-tag stripping
4. **Auth integration** — JWT authorizer on AgentCore needed Cognito OIDC discovery URL configuration post-deployment
5. **Memory injection** — Dynamically enhancing the orchestrator system prompt with retrieved memory records without breaking agent state

### Options Considered (Inferred)
- **Single monolithic agent** — Simpler but can't specialize tools/prompts per domain
- **Separate microservices per agent** — More complex deployment, unnecessary for POC
- **Agents as Tools (chosen)** — Keeps everything in one container, orchestrator delegates via tool calls

### Solution
The **Agents as Tools pattern** in `main.py`:
- Specialist agents are wrapped as `@tool` functions
- Orchestrator agent has both tools available and uses LLM reasoning to select the right one(s)
- Single `stream_async()` call on the orchestrator handles the entire multi-agent flow
- Memory is queried before streaming and stored after completion

### Trade-offs
| Pro | Con |
|-----|-----|
| Single container deployment | All agents share one process — no independent scaling |
| Simple tool-based delegation | Sequential agent calls increase latency |
| Unified streaming response | Harder to debug which agent contributed what |
| Minimal infrastructure | Orchestrator system prompt modified at runtime for memory (side effect) |

### Result
A working POC that demonstrates intelligent routing between budget and investment agents with streaming UX, deployable to AgentCore with a single `deploy.sh` command.

**Not identifiable from the repository:** Specific latency measurements or user satisfaction metrics.

---

## 8. Important Design Decisions

### Decision 1: Agents as Tools vs. Microservices

**Decision:** Wrap specialist agents as `@tool` functions callable by the orchestrator.

**Why:** Keeps the entire multi-agent system in a single AgentCore container. No inter-service HTTP calls, no service discovery.

**Alternative:** Deploy each agent as a separate AgentCore runtime with HTTP communication.

**Trade-off:** Simpler deployment and lower latency between agents, but cannot scale agents independently.

**Why this makes sense:** POC scope — prove multi-agent coordination without infrastructure complexity.

---

### Decision 2: Amazon Nova Pro at Temperature 0.0

**Decision:** All agents use `amazon.nova-pro-v1:0` with `temperature=0.0`.

**Why:** Client requirement (NFR-1) for deterministic, consistent financial advice.

**Alternative:** Higher temperature for more conversational responses, or model tiering (Nova Lite for simple queries).

**Trade-off:** More predictable outputs but potentially less natural language variation.

**Why this makes sense:** Financial advice requires consistency; non-deterministic responses are risky for advisory content.

---

### Decision 3: Pydantic Structured Output for Budget Agent

**Decision:** `FinancialReport` Pydantic model with `structured_output()` for budget queries.

**Why:** Requirement R1.6 — consistent, schema-validated financial reports every time.

**Alternative:** Free-form text responses parsed with regex or post-processing.

**Trade-off:** Schema constraints may limit LLM flexibility but guarantee parseable output.

**Why this makes sense:** Downstream systems (or UI) can reliably consume structured budget data.

---

### Decision 4: Custom Cognito Auth (No Amplify SDK)

**Decision:** Direct `InitiateAuth` API call from `auth.ts` instead of AWS Amplify JavaScript library.

**Why:** Minimal frontend dependencies — only Next.js, React, and react-markdown in `package.json`.

**Alternative:** AWS Amplify Auth SDK with built-in session management and token refresh.

**Trade-off:** Less code but no automatic token refresh, no SRP support.

**Why this makes sense:** Static export POC with admin-provisioned users — simplicity over enterprise auth features.

---

### Decision 5: Static Next.js Export on Amplify

**Decision:** Build as static export (`next export`) deployed to Amplify via zip upload.

**Why:** No Node.js server needed — frontend is purely client-side calling AgentCore directly.

**Alternative:** SSR with Next.js API routes as a BFF (Backend for Frontend) proxy.

**Trade-off:** AgentCore endpoint and Cognito config exposed in client env vars; no server-side secret handling.

**Why this makes sense:** AgentCore handles auth via JWT — no need for a backend proxy layer in the POC.

---

### Decision 6: Shell Scripts vs. Infrastructure as Code

**Decision:** Bash scripts with embedded Python boto3 calls for all AWS provisioning.

**Why:** Fast iteration for POC demonstration and notebook-aligned workflow.

**Alternative:** CDK/Terraform CloudFormation templates.

**Trade-off:** Not reproducible across environments; no state management; harder to review in PRs.

**Why this makes sense:** POC timeline — production roadmap explicitly calls for IaC migration.

---

## 9. Performance & Scalability Interview Discussion

### "What happens if traffic increases 10x?"

> "The **AgentCore Runtime** is serverless and should auto-scale container instances, so the backend can handle more concurrent invocations. The **Amplify static frontend** scales via CDN automatically.
>
> However, the bottlenecks would be:
> 1. **Bedrock model quotas** — Nova Pro has account-level rate limits on tokens per minute
> 2. **Multi-agent latency** — Each query may trigger 2-3 sequential LLM calls (orchestrator → specialist → tool execution)
> 3. **yfinance API** — External dependency with no caching; rate limits could hit under load
> 4. **AgentCore Memory** — Every request reads and writes memory records
> 5. **Cost** — 10x traffic means 10x LLM token consumption with no caching layer
>
> At 10x, I'd first monitor Bedrock throttling and p99 latency in CloudWatch, then add response caching for common queries."

### "How would you scale this application?"

1. **Caching layer** — Redis/ElastiCache for common FAQ responses and stock data with TTL
2. **Model tiering** — Nova Lite for simple budget calculations, Nova Pro for complex multi-agent queries
3. **Per-user memory namespaces** — Replace hardcoded `default_user` with JWT `sub` claim
4. **Token budgets** — Per-user monthly limits to control LLM costs
5. **Multi-region** — Deploy AgentCore runtimes in us-west-2, eu-west-1 with Route 53 latency routing
6. **Async tool execution** — Parallelize independent agent tool calls where possible

### "What could become a bottleneck?"

- Bedrock Nova Pro inference (dominant latency factor)
- Sequential multi-agent tool invocations
- yfinance synchronous HTTP calls inside agent tools
- No connection pooling or caching anywhere in the stack

### "Where would you add caching?"

- Stock data from yfinance (5-minute TTL)
- Common budget calculations (deterministic — cache by input)
- Guardrail-safe FAQ responses
- Cognito JWKS/discovery URL (frontend and AgentCore)

### "How would you optimize the database?"

> "There's no traditional database. The persistent layer is **AgentCore Memory**. I'd optimize by:
> - Using per-user namespaces instead of shared `default_user`
> - Setting retention policies (90 days per requirements)
> - Limiting `max_results` in memory queries (currently 5)
> - Not injecting memory into system prompt on every request — use RAG selectively"

### "How would you handle millions of users?"

> "That's a production architecture question. The current POC isn't designed for that scale. The production roadmap in `Prerequisites_for_Production.md` outlines: multi-tenancy, WAF, rate limiting, SSO, multi-region DR, auto-scaling AgentCore, and replacing shell scripts with IaC and CI/CD. Realistically, you'd also need a service layer (API Gateway) between the frontend and AgentCore for rate limiting, and domain-specific agents backed by real data systems."

---

## 10. Security Interview Discussion

### How authentication works

1. Admin creates user in Cognito via `setup_cognito_user_pool()` (admin-only, no self-registration)
2. User enters credentials in `LoginForm.tsx`
3. Frontend calls Cognito `InitiateAuth` with USER_PASSWORD_AUTH (`auth.ts`)
4. Access token (JWT) stored in browser localStorage
5. Every AgentCore request includes `Authorization: Bearer {token}`
6. AgentCore JWT authorizer validates against Cognito OIDC discovery URL (configured in `deploy.sh`)

### How authorization works

- **Binary model:** Valid JWT = access granted; missing/invalid JWT = rejected
- No roles, permissions, or resource-level access control
- All authenticated users share the same agent capabilities

### How sensitive data is protected

**Implemented:**
- Cognito credentials stored in AWS Secrets Manager (not in source code)
- Strong password policy (12+ chars, complexity requirements)
- Bedrock Guardrails filter harmful/inappropriate content
- Non-root container user in Dockerfile

**Gaps:**
- JWT in localStorage (XSS risk)
- No encryption of data at rest in AgentCore Memory (managed by AWS)
- No PII tokenization (not needed for POC — no real financial data stored)

### Input validation

- Pydantic schema validation on structured budget output
- Tool-level validation on portfolio amounts and risk levels
- Tool-level validation on stock comparison inputs
- Bedrock Guardrails on model input/output

### Common vulnerabilities

| Vulnerability | Status |
|---------------|--------|
| SQL injection | N/A — no SQL database |
| XSS | Risk — react-markdown renders assistant output; user input displayed as plain text |
| CSRF | Low risk — Bearer token auth, no cookies |
| Prompt injection | Partial — Guardrail has PROMPT_ATTACK filter on input |
| Token theft | Risk — localStorage storage, no httpOnly cookies |

### Security improvements

1. Move tokens to httpOnly secure cookies
2. Implement token refresh and expiry validation
3. Use unique actor_id from JWT claims
4. Enable Cognito MFA
5. Add AWS WAF
6. Least-privilege IAM policies
7. Rate limiting per user

---

## 11. Testing Interview Discussion

### How the project is tested

**Verified from code:** No automated test suite exists. Testing is manual via:
- Jupyter notebooks (`AWS_SingleAgent.ipynb`, `AWS_MultiAgent.ipynb`, `AWS_Deployment.ipynb`)
- Chat UI with suggestion prompts
- `if __name__ == "__main__"` blocks in agent modules

### What should be unit tested

- `calculate_budget()` — verify 50/30/20 math
- `create_diversified_portfolio()` — validation rules (min $100, max $100M, risk levels)
- `compare_stock_performance()` — input validation (max 5 symbols, valid periods)
- `stripThinkingTags()` in `agent.ts` — SSE content cleaning
- Pydantic model validation — invalid scores, missing fields

### What should be integration tested

- Orchestrator routing — budget query triggers budget_agent_tool
- Orchestrator routing — investment query triggers financial_analysis_agent_tool
- Combined query invokes both tools
- Guardrail blocks crypto queries
- Memory read/write in invoke handler

### What should be E2E tested

- Login flow → chat → streaming response
- Unauthenticated request rejected by AgentCore
- Session persistence across page reload (localStorage)
- Error display when AgentCore is unreachable

### How mocks should be used

- Mock Bedrock model responses to avoid API costs in CI
- Mock yfinance to return deterministic stock data
- Mock Cognito InitiateAuth for frontend auth tests
- Mock MemoryClient for memory integration tests

### What tests are missing

Everything — no pytest, no Jest, no Playwright, no CI test stage. This is documented as a production gap.

---

## 12. Failure Scenarios

### "What happens if the database goes down?"

> "There's no traditional database. If **AgentCore Memory** is unavailable, the `invoke()` handler catches the exception, logs a warning, and continues without memory context. The agent still responds — it just won't have cross-session context. Conversation history within a session is managed by the `SummarizingConversationManager` in memory."

### "What happens if a third-party API fails?"

> "If **yfinance** fails inside a tool like `get_stock_analysis`, the tool catches the exception and returns a user-friendly error string like '❌ Error: Unable to retrieve stock data.' The agent doesn't crash — it returns the error message to the orchestrator, which can explain the failure to the user."

### "What happens if the same request is submitted twice?"

> "There's no idempotency mechanism. Each submission creates a new AgentCore invocation with full LLM processing. The user would see two responses and be charged twice for tokens. In production, I'd add a client-side debounce (already partially done — send button disabled while streaming) and server-side idempotency keys."

### "How do you prevent inconsistent data?"

> "Budget reports use Pydantic structured output with schema validation — the LLM must conform to `FinancialReport`. Portfolio tools use deterministic allocation logic (fixed stock lists and weights per risk level). Temperature is 0.0 for deterministic LLM behavior. However, stock data from yfinance is point-in-time and can change between requests."

### "How do you handle partial failures?"

> "Each layer returns error strings rather than throwing. If the budget agent fails, `budget_agent_tool` returns a default `FinancialReport` with an error recommendation. If memory write fails, it's logged but doesn't affect the response. If streaming fails mid-response, the frontend shows whatever content was received plus an error message."

---

## 13. Questions Interviewer May Ask

### Architecture

**Q1: Why multi-agent instead of a single agent with all tools?**
A: Separation of concerns — budget agent has a constrained persona (no investment advice) with structured Pydantic output, while the investment agent has different tools and disclaimers. The orchestrator can combine them for complex queries. This matches the client's phased requirements (Phase 1 → Phase 2).

**Q2: Why Agents as Tools instead of separate services?**
A: Single AgentCore container deployment — no inter-service communication overhead. Each specialist agent is wrapped as a `@tool` function in `main.py`, keeping everything in one process.

**Q3: How does the orchestrator decide which agent to call?**
A: The orchestrator's system prompt (`ORCHESTRATOR_PROMPT` in `main.py`) instructs it to use budget_agent for budgeting questions and financial_analysis_agent_tool for investment questions. The Nova Pro LLM makes the routing decision based on this prompt and the user's query.

**Q4: Why no traditional REST API?**
A: AgentCore Runtime replaces the API layer — it exposes `/invocations` (streaming) and `/ping` (health). The frontend communicates directly with AgentCore.

**Q5: Why static export instead of SSR?**
A: The frontend is a pure client-side chat app. All intelligence is in AgentCore. No server-side rendering needed — Amplify CDN serves static files.

### Backend

**Q6: How does streaming work in the backend?**
A: `invoke()` in `main.py` is an async generator. It calls `orchestrator_agent.stream_async()` and yields each chunk from the event data. AgentCore forwards these as SSE to the client.

**Q7: What is SummarizingConversationManager?**
A: A Strands SDK component that summarizes older messages when context grows too large (summary_ratio=0.3, preserves 5 recent messages). Prevents token limit overflow in long conversations.

**Q8: How does structured output work?**
A: `budget_agent.structured_output(output_model=FinancialReport, prompt=query)` instructs the LLM to generate JSON matching the Pydantic schema. The SDK validates the response against the model.

**Q9: Why temperature 0.0?**
A: Client requirement for deterministic financial advice. Reduces response variability for consistent recommendations.

**Q10: How are agent tools defined?**
A: Using the `@tool` decorator from Strands SDK. Each tool is a Python function with typed parameters and a docstring that the LLM uses to decide when to call it.

### Frontend

**Q11: How does the frontend handle streaming?**
A: `agent.ts` uses Fetch API with `response.body.getReader()`, parses SSE `data:` lines, accumulates the full response, strips `<thinking>` tags, and calls `onChunk` to update React state incrementally.

**Q12: Why custom Cognito auth instead of Amplify SDK?**
A: Minimal dependencies — the entire frontend has only 4 runtime dependencies. Direct InitiateAuth API call is sufficient for admin-provisioned POC users.

**Q13: How is session management handled?**
A: `session_id` is a 36-char random string generated once per page load. `actor_id` is hardcoded to `"default_user"`. JWT token persists in localStorage across page reloads.

### Database / Data

**Q14: Where is data persisted?**
A: AgentCore Memory (when `AGENTCORE_MEMORY_ID` is set). No SQL/NoSQL database. Stock data is fetched live from yfinance and not stored.

**Q15: What data models exist?**
A: Pydantic models only — `FinancialReport` and `BudgetCategory` in `budget_agent.py`. These are LLM output schemas, not database tables.

### Security

**Q16: How are guardrails implemented?**
A: Bedrock Guardrail created in `utils/guardrail.py` with content filters (sexual, violence, hate, etc.) and a word blocklist for Bitcoin/crypto terms. Applied to the orchestrator's `BedrockModel` via `guardrail_id` parameter.

**Q17: How is the AgentCore endpoint protected?**
A: JWT authorizer configured in `deploy.sh` — validates Bearer tokens against Cognito OIDC discovery URL. Unauthenticated requests are rejected.

**Q18: Where are credentials stored?**
A: Cognito user credentials in AWS Secrets Manager. Frontend env vars contain only public Cognito pool/client IDs and the AgentCore endpoint URL.

### Performance

**Q19: What is the main latency bottleneck?**
A: Bedrock Nova Pro LLM inference, especially when the orchestrator calls multiple agents sequentially.

**Q20: Is there any caching?**
A: No. Every request triggers fresh LLM inference and yfinance API calls.

### Deployment

**Q21: How is the backend deployed?**
A: `deploy.sh` uses the Bedrock AgentCore Starter Toolkit to configure and launch the runtime. CodeBuild builds an ARM64 Docker image, pushes to ECR, and deploys to AgentCore.

**Q22: How is the frontend deployed?**
A: `deploy-frontend.sh` runs `npm run build` + `next export`, zips the `out/` directory, and uploads to AWS Amplify via manual deployment API.

**Q23: Why ARM64 containers?**
A: Cost optimization on AWS Graviton processors — client requirement NFR-5.

### Design / Business

**Q24: How would this translate to insurance?**
A: Replace budget/investment agents with insurance-domain agents (underwriting, claims, policy, compliance, customer service). Add RAG over policy documents, integrate with policy admin and claims systems. Documented in `Prerequisites_for_Production.md`.

**Q25: What is the POC vs. production gap?**
A: No IaC, no automated tests, no RBAC/MFA, no real data integrations, no multi-tenancy, no WAF, single region, admin-only users, broad IAM policies. Production target is 5-7 months with 4-6 engineers.

---

## 14. Rapid-Fire Technical Questions

**Q: Why did you use Strands Agents SDK?**
A: Client requirement. It provides agent definition, tool decorators, streaming, structured output, and conversation management — all integrated with Amazon Bedrock.

**Q: Why not LangChain?**
A: Project spec required Strands Agents SDK, which is AWS-native and integrates directly with Bedrock AgentCore deployment tooling.

**Q: Where does the business logic live?**
A: In agent system prompts and `@tool` functions. Budget logic in `budget_agent.py` tools, investment logic in `financial_analysis_agent.py` tools, routing logic in the orchestrator prompt in `main.py`.

**Q: How does authentication work?**
A: Cognito USER_PASSWORD_AUTH → JWT access token → Bearer header on AgentCore requests → JWT authorizer validates.

**Q: How does the frontend communicate with the backend?**
A: Direct HTTPS POST to AgentCore Runtime endpoint with SSE streaming response. No intermediary API server.

**Q: How is data validated?**
A: Pydantic models for structured output, tool-level input checks for portfolio/comparison tools, Bedrock Guardrails for content safety.

**Q: How would you scale this?**
A: AgentCore auto-scales containers, Amplify CDN scales frontend. Add caching, model tiering, per-user memory, rate limiting, and multi-region for production scale.

**Q: Why Nova Pro and not Claude/GPT?**
A: Client/AWS stack requirement — Amazon Nova Pro via Bedrock, keeping everything in the AWS ecosystem.

**Q: What happens when the guardrail blocks a request?**
A: Bedrock returns configured blocked messages: "I apologize, but I am not able to provide Bitcoin investment advice..."

**Q: Why no Docker locally?**
A: CodeBuild handles ARM64 container builds in the cloud — client requirement R3.4.

**Q: What is the 50/30/20 rule?**
A: Budget allocation guideline: 50% needs, 30% wants, 20% savings. Implemented in the `calculate_budget` tool.

**Q: How do you handle long conversations?**
A: `SummarizingConversationManager` summarizes older messages while preserving the 5 most recent.

---

## 15. 4–5 Minute Interview Script

> **[Introduction — 30 seconds]**
>
> "I'd like to tell you about a project called NovaMind AI Financial Advisor. It's an AI-powered multi-agent platform I built as a proof of concept for NEXT Insurance, in partnership with CloudAge. The product gives users a conversational chat interface where they can get help with budgeting, stock research, and portfolio recommendations — all powered by Amazon Bedrock and the Strands Agents SDK."
>
> **[Business Problem — 45 seconds]**
>
> "The client wanted to demonstrate a progressive AI architecture — starting from a single budget agent, scaling to a multi-agent system, and deploying it to production on AWS. The business need was to prove that Amazon Bedrock and AgentCore could support enterprise-grade AI agents with authentication, memory, guardrails, and streaming — as a foundation for future insurance-domain agents like underwriting and claims processing."
>
> **[What We Built — 45 seconds]**
>
> "We built three things: a budget agent that calculates 50/30/20 budgets and returns structured financial reports, an investment agent that analyzes stocks in real-time and creates portfolio recommendations, and an orchestrator that intelligently routes user questions to the right specialist — or both, for complex queries. On top of that, we built a Next.js chat frontend with Cognito authentication and real-time streaming responses, all deployed on AWS — AgentCore for the backend, Amplify for the frontend."
>
> **[Architecture — 45 seconds]**
>
> "Architecturally, it's a multi-agent orchestration pattern. The user talks to a Next.js app on Amplify, which authenticates via Cognito and sends messages directly to the Bedrock AgentCore Runtime. Inside the container, an orchestrator agent powered by Amazon Nova Pro decides whether to invoke the budget agent or the investment agent — each wrapped as a tool. Responses stream back as Server-Sent Events, and the frontend renders them as Markdown in real time. We also integrated Bedrock Guardrails for content safety and AgentCore Memory for cross-session persistence."
>
> **[Important Workflow — 30 seconds]**
>
> "For example, when a user asks 'Create a budget for six thousand dollars a month' — the orchestrator routes to the budget agent, which calls a calculator tool for the 50/30/20 breakdown, generates a Pydantic-validated financial report with categories and a health score, and the orchestrator synthesizes that into a natural language response that streams to the user."
>
> **[Technical Challenge — 30 seconds]**
>
> "The biggest challenge was getting multi-agent streaming working in a production serverless container. Unlike a traditional API where you'd have REST endpoints, AgentCore uses an async generator entrypoint. We solved this with the Agents-as-Tools pattern — wrapping each specialist as a tool function so the orchestrator handles routing, execution, and streaming in a single flow."
>
> **[Result / Closing — 15 seconds]**
>
> "The result is a working POC that deploys with a single script, demonstrates intelligent multi-agent coordination, and provides a clear roadmap to production insurance agents. It showcases how AWS Bedrock AgentCore can host enterprise AI agents with proper auth, safety, and observability."

---

## 16. How to Showcase the Project on a Whiteboard

Draw in this order:

```text
1. Draw "User" (stick figure) on the left

2. Draw "Next.js App" box — label "AWS Amplify (Static CDN)"
   Arrow from User → Next.js App

3. Draw "Cognito" box below the frontend
   Arrow: User → Cognito (login) → JWT token → Next.js App

4. Draw "AgentCore Runtime" box in the center-right — label "Container (ARM64)"
   Arrow from Next.js App → AgentCore: "POST + Bearer JWT + SSE"

5. Inside AgentCore box, draw "Orchestrator Agent"
   Label: "Nova Pro + Guardrails + Memory"

6. Draw two boxes below Orchestrator:
   - "Budget Agent" (tools: calculator, chart, Pydantic output)
   - "Financial Analysis Agent" (tools: yfinance, portfolio, comparison)
   Arrows from Orchestrator → each specialist

7. Draw "Amazon Bedrock" cloud below both agents
   Label: "Nova Pro LLM"

8. Draw "AgentCore Memory" on the side
   Arrow: Orchestrator ↔ Memory (read before, write after)

9. Draw "yfinance" external box
   Arrow: Financial Analysis Agent → yfinance

10. Walk through one request:
    "User asks budget question → JWT validated → Orchestrator routes to
     Budget Agent → 50/30/20 calculation → Structured report →
     Stream back to user as Markdown"
```

---

## 17. Interview Presentation Strategy

### What to explain first
1. What the product does (30-second pitch)
2. High-level architecture diagram (frontend → AgentCore → agents → Bedrock)
3. One concrete workflow (budget query with structured output)

### What to avoid explaining initially
- Shell script deployment details
- Individual Pydantic field definitions
- Guardrail word blocklist specifics
- Notebook POC progression (unless asked about development process)

### Most impressive technical areas
- Multi-agent orchestration with intelligent routing
- Production AWS deployment (AgentCore, Cognito JWT, Guardrails, Memory)
- Streaming SSE from serverless container to React UI
- Structured Pydantic output from LLM

### Areas likely to trigger follow-up questions
- "Why no database?" → AgentCore Memory explanation
- "How do you test this?" → Honest answer: manual/notebooks, no automated tests
- "How does auth work exactly?" → Cognito flow + JWT authorizer
- "What about security?" → Guardrails yes, but localStorage tokens and no MFA
- "How would you scale?" → AgentCore auto-scaling + caching + model tiering

### Implementation details to prepare
- `@tool` decorator and Agents-as-Tools pattern
- `structured_output()` with Pydantic models
- SSE parsing in `agent.ts`
- JWT authorizer configuration in `deploy.sh`
- Memory query/inject pattern in `invoke()`

### Questions to proactively answer
- "This is a POC, not production" — acknowledge and explain the production roadmap
- "I used AWS-native tools intentionally" — Bedrock, AgentCore, Cognito ecosystem
- "Multi-agent was a requirement, not over-engineering" — phased client spec

### Mistakes to avoid
- Don't claim production scale or user metrics
- Don't say "microservices" — it's a modular monolith in one container
- Don't claim automated test coverage
- Don't overstate security (be honest about localStorage tokens and no MFA)
- Don't confuse Bedrock AgentCore with Bedrock Agents (different services)

---

## 18. How to Discuss This Project Like a Senior Engineer

### Trade-offs
> "We chose Agents-as-Tools over microservices because the POC needed to deploy as a single container to AgentCore. The trade-off is we can't scale budget and investment agents independently, but for a demonstration platform, the operational simplicity was the right call."

### Maintainability
> "Each agent is a standalone Python module with its own system prompt and tools — the orchestrator imports them. Adding a third agent means creating a new module and adding a `@tool` wrapper in `main.py`. The production roadmap replaces shell scripts with IaC, which would significantly improve maintainability."

### Scalability
> "AgentCore handles container scaling, but the real bottleneck is Bedrock token throughput and sequential multi-agent calls. For production, I'd add caching, model tiering, and parallel tool execution."

### Reliability
> "Tools fail gracefully with user-friendly error strings. Memory failures don't crash the agent. But there's no circuit breaker for yfinance, no retry logic, and no health-check-based routing."

### Security
> "We have guardrails and JWT auth, which is appropriate for a POC. For production, I'd move to SSO with MFA, per-user memory isolation, WAF, and least-privilege IAM."

### Observability
> "OpenTelemetry instrumentation is built into the Docker container, and AgentCore observability is enabled. But there are no custom dashboards, alerts, or business KPIs."

### Technical debt
> "The biggest items are: no automated tests, shell-script infrastructure, hardcoded actor_id, no token refresh, and broad IAM policies. All documented in the production gap analysis."

### Future architecture
> "The path forward is insurance-domain agents with RAG over policy documents, real data integrations, multi-tenancy, and CI/CD with canary deployments — all outlined in the production prerequisites document."

### Business impact
> "This POC de-risks the client's decision to adopt Amazon Bedrock AgentCore for their AI platform. It proves multi-agent coordination, production deployment, and responsible AI controls work end-to-end."

---

## 19. Resume-Friendly Project Summary

### 2-line version
Built an AI-powered multi-agent financial advisor on Amazon Bedrock AgentCore with a Next.js streaming chat UI, Cognito authentication, and Bedrock Guardrails. Orchestrator agent routes queries to specialist budget and investment agents using the Strands Agents SDK.

### 4-line version
Developed NovaMind AI Financial Advisor — a multi-agent conversational AI platform for NEXT Insurance/CloudAge POC. Built Python orchestrator and specialist agents (budget analysis, stock research, portfolio recommendations) on Amazon Bedrock AgentCore Runtime with streaming SSE responses. Created Next.js frontend with Cognito JWT auth deployed to AWS Amplify. Integrated Bedrock Guardrails, AgentCore Memory, OpenTelemetry observability, and automated AWS deployment pipeline.

### Resume bullet points

- Architected and deployed a multi-agent AI platform on **Amazon Bedrock AgentCore Runtime** with an orchestrator routing to specialist budget and investment agents using the **Strands Agents SDK** and **Amazon Nova Pro**
- Built specialist agents with custom tools: 50/30/20 budget calculator with **Pydantic structured output**, real-time stock analysis via **yfinance**, and portfolio recommendation engine with input validation
- Developed a **Next.js/TypeScript** streaming chat frontend with **Amazon Cognito** JWT authentication, SSE response parsing, and Markdown rendering, deployed as static export on **AWS Amplify**
- Implemented **Bedrock Guardrails** for content safety, **AgentCore Memory** for cross-session persistence, and **OpenTelemetry** observability with **CloudWatch** logging
- Created automated deployment pipeline: **AWS CodeBuild** ARM64 container builds → **ECR** → AgentCore Runtime, with Cognito JWT authorizer configuration and **Secrets Manager** credential storage

---

## 20. Final Cheat Sheet

```text
Project:           NovaMind AI Financial Advisor (NEXT Insurance / CloudAge POC)
Problem:           Demonstrate progressive multi-agent AI architecture on AWS Bedrock
Users:             End users (financial guidance), stakeholders (architecture evaluation)
My Role:           Full-stack: agents, frontend, AWS deployment (evidenced by codebase)
Frontend:          Next.js 12, TypeScript, React, static export on AWS Amplify
Backend:           Python 3.12, Strands Agents SDK, BedrockAgentCoreApp
Database:          None — AgentCore Memory for persistence (no SQL/NoSQL)
Architecture:      Multi-agent orchestration (Agents as Tools) in single AgentCore container
Authentication:    Amazon Cognito JWT (USER_PASSWORD_AUTH) + AgentCore JWT authorizer
Key Features:      Budget 50/30/20, structured reports, stock analysis, portfolios, streaming chat
Most Important Workflow: User chat → Cognito JWT → AgentCore → Orchestrator routes → Specialist agent → SSE stream → Markdown UI
Biggest Challenge: Multi-agent streaming in serverless AgentCore container (Agents-as-Tools pattern)
Main Technical Decision: Agents as Tools over microservices (single container, simpler POC deployment)
Biggest Trade-off:    No independent agent scaling vs. operational simplicity
Security:          Guardrails + JWT auth (gaps: localStorage tokens, no MFA, no RBAC)
Testing:            Manual/notebooks only — no automated tests
Deployment:        Shell scripts → CodeBuild → ECR → AgentCore; Amplify for frontend
Scalability:       AgentCore serverless scaling; bottlenecks: Bedrock quotas, sequential agent calls, no caching
Future Improvements: Insurance-domain agents, IaC, CI/CD, SSO/MFA, RAG, multi-tenancy, automated tests
```

---

*Good luck with your interview. Personalize the "My Role" sections based on what you actually implemented, and be transparent that this is a POC — interviewers respect honesty about maturity level.*
