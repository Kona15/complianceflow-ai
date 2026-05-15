# ComplianceFlow AI — Project Manifest
## Complete File Navigation Guide

---

## 🏗️ Architecture Overview

```
complianceflow-ai/
├── 📁 backend/              # FastAPI + Python 3.11
│   ├── app/
│   │   ├── core/            # Config, Events, Kimi Swarm
│   │   ├── models/          # Pydantic schemas
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   └── agents/          # Agent implementations
│   ├── policies/            # JSON policy rules
│   └── tests/               # Pytest suite
├── 📁 frontend/             # Next.js 15 + Tailwind
│   ├── src/app/             # Routes (page.tsx, auth/page.tsx)
│   ├── src/components/      # React components
│   ├── src/hooks/           # Custom hooks
│   ├── src/lib/             # Utilities & API client
│   └── src/types/           # TypeScript definitions
├── 📁 supabase/             # Database migrations
│   └── migrations/
├── 📁 pitch-deck/           # Hackathon presentation
└── 📁 docs/                 # Architecture documentation
```

---

## 🔗 File Connections & Data Flow

### 1. Document Upload Flow
```
User Uploads PDF
    ↓
frontend/src/components/dashboard/document-upload.tsx
    ↓ POST /api/v1/documents/upload
backend/app/routers/documents.py → upload_document()
    ↓
backend/app/services/document_processor.py → process()
    ↓ OCR/Extraction
backend/app/services/policy_engine.py → evaluate()
    ↓ Policy Rules
backend/app/core/kimi_swarm.py → orchestrate_compliance_check()
    ↓ 3 Agents in Parallel
backend/app/core/events.py → EventBus
    ↓ WebSocket
frontend/src/components/agents/agent-thought-stream.tsx
    ↓ Real-time streaming
backend/app/services/supabase_service.py → create_job/update_job_status
    ↓ Persist to DB
supabase/migrations/001_initial_schema.sql
```

### 2. Agent Swarm Orchestration Flow
```
Kimi K2.6 Agent Swarm (backend/app/core/kimi_swarm.py)
    ├── Auditor Agent
    │   ├── Extract: amounts, dates, parties, clauses
    │   ├── Compare: against JSON policy rules
    │   └── Output: discrepancies[] + confidence_score
    ├── Negotiator Agent (parallel)
    │   ├── Draft: professional email
    │   ├── Suggest: specific fixes
    │   └── Output: email_draft (pending approval)
    └── Closer Agent (parallel)
        ├── Update: dashboard status
        ├── Classify: risk level
        └── Output: compliance trail
```

### 3. Human-in-the-Loop Approval Flow
```
Negotiator completes email draft
    ↓
backend/app/routers/approvals.py → review_approval()
    ↓
frontend/src/components/dashboard/job-detail-panel.tsx
    ├── Tab: Email Draft
    ├── Action: Approve / Reject
    └── Input: approver email, name, notes
    ↓ POST /api/v1/approvals/review
backend/app/services/email_service.py → send_email()
    ↓ SMTP
Vendor receives email
    ↓
Closer updates dashboard status
```

### 4. Real-Time WebSocket Flow
```
Agent Event Generated
    ↓
backend/app/core/events.py → EventBus.publish()
    ↓
backend/app/routers/websocket.py → websocket_event_handler()
    ↓ Broadcast
frontend/src/hooks/use-agent-websocket.ts
    ↓
frontend/src/components/agents/agent-thought-stream.tsx
    ↓ Live UI Update
User sees step-by-step agent reasoning
```

---

## 📋 Key Files Reference

### Backend (FastAPI)
| File | Purpose | Key Classes/Functions |
|------|---------|----------------------|
| `app/main.py` | FastAPI app entry | `app = FastAPI()` |
| `app/core/config.py` | Environment settings | `Settings`, `get_settings()` |
| `app/core/events.py` | Event bus for agents | `EventBus`, `AgentEvent` |
| `app/core/kimi_swarm.py` | **K2.6 Agent Swarm** | `KimiAgentSwarm`, `orchestrate_compliance_check()` |
| `app/models/schemas.py` | Pydantic models | `ComplianceJob`, `Discrepancy`, `AgentThought` |
| `app/routers/main.py` | Health, stats, auth | `get_current_user()`, `get_dashboard_stats()` |
| `app/routers/documents.py` | Upload & process | `upload_document()`, `process_document_with_swarm()` |
| `app/routers/approvals.py` | Human approval | `review_approval()` |
| `app/routers/websocket.py` | Real-time streaming | `agent_websocket()`, `dashboard_websocket()` |
| `app/services/document_processor.py` | OCR & extraction | `DocumentProcessor.process()` |
| `app/services/policy_engine.py` | Rule evaluation | `PolicyEngine.evaluate()` |
| `app/services/email_service.py` | Email drafting | `EmailService.draft_discrepancy_email()` |
| `app/services/supabase_service.py` | Database ops | `SupabaseService.create_job()`, `update_job_status()` |

### Frontend (Next.js)
| File | Purpose | Key Components/Hooks |
|------|---------|---------------------|
| `src/app/page.tsx` | **Main Dashboard** | `DashboardPage` — 3-column layout |
| `src/app/auth/page.tsx` | Login/Signup | `AuthPage` — Supabase auth |
| `src/app/layout.tsx` | Root layout | `SupabaseProvider`, `Toaster` |
| `src/components/agents/agent-thought-stream.tsx` | **Live Agent Thoughts** | `AgentThoughtStream` — WebSocket events |
| `src/components/dashboard/document-upload.tsx` | Upload UI | `DocumentUpload` — react-dropzone |
| `src/components/dashboard/stats-cards.tsx` | Dashboard stats | `StatsCards` — 6 metric cards |
| `src/components/dashboard/job-detail-panel.tsx` | Job details | `JobDetailPanel` — discrepancies/email/status |
| `src/components/dashboard/loading-skeleton.tsx` | Loading UI | `LoadingSkeleton` — shimmer effect |
| `src/components/dashboard/empty-state.tsx` | Empty state | `EmptyState` — call to action |
| `src/hooks/use-agent-websocket.ts` | WebSocket hook | `useAgentWebSocket` — live connection |
| `src/lib/api.ts` | API client | `uploadDocument()`, `getJob()`, `approveEmail()` |
| `src/lib/utils.ts` | Utilities | `cn()`, `formatDate()`, `getSeverityColor()` |
| `src/types/index.ts` | TypeScript types | `AgentEvent`, `ComplianceJob`, `Discrepancy` |

### Database (Supabase)
| File | Purpose | Tables Created |
|------|---------|---------------|
| `migrations/001_initial_schema.sql` | Core schema | `compliance_jobs`, `audit_trail`, `policies` |
| `migrations/002_storage_setup.sql` | File storage | `compliance-documents` bucket |

---

## 🚀 Quick Start Commands

```bash
# 1. Clone & setup
git clone https://github.com/your-org/complianceflow-ai.git
cd complianceflow-ai

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev

# 4. Supabase (setup via CLI)
supabase login
supabase link --project-ref your-project-ref
supabase db push

# 5. Docker (alternative)
docker-compose up --build
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest -xvs

# Frontend build
cd frontend
npm run build

# Docker healthcheck
curl http://localhost:8000/api/v1/health
```

---

## 📡 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/health` | Health check | No |
| GET | `/api/v1/dashboard/stats` | Dashboard statistics | JWT |
| GET | `/api/v1/jobs` | List compliance jobs | JWT |
| POST | `/api/v1/documents/upload` | Upload & process document | JWT |
| GET | `/api/v1/documents/jobs/{id}` | Get job status | JWT |
| GET | `/api/v1/documents/jobs/{id}/events` | Get agent events | JWT |
| POST | `/api/v1/approvals/review` | Approve/reject email | JWT |
| GET | `/api/v1/approvals/pending` | List pending approvals | JWT |
| WS | `/ws/agents/{job_id}` | Real-time agent stream | No |
| WS | `/ws/dashboard` | Global dashboard updates | No |

---

## 🎯 Agent Swarm Configuration

**Kimi K2.6 Settings:**
- Model: `kimi-k2.6`
- Base URL: `https://api.moonshot.ai/v1`
- Context Window: 262,144 tokens
- Max Output: 98,304 tokens
- Temperature: 0.2 (deterministic for compliance)
- Thinking Mode: Enabled (for agentic reasoning)
- Parallel Tool Calls: True

**Swarm Parameters:**
- Max Sub-Agents: 300
- Max Coordinated Steps: 4,000
- Active Agents: 3 (Auditor, Negotiator, Closer)
- Architecture: 1T MoE, 32B active, 384 experts

---

*Generated for International AI Agents Hackathon 2026*
*Built with Kimi K2.6 Agent Swarm | Next.js 15 | FastAPI | Supabase*
