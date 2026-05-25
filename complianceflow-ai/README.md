# ComplianceFlow AI

ComplianceFlow AI is an agentic document compliance platform that connects a Next.js dashboard with a FastAPI backend. The system supports PDF/image upload, OCR-based extraction, rule-driven policy evaluation, approval workflows, and live Agent Thought Stream updates.

---

## 🚀 What This Repo Contains
- `frontend/` — Next.js 15 frontend with React 19, Supabase auth, document upload, jobs dashboard, and live WebSocket agent stream
- `backend/` — FastAPI backend with document processing, compliance policy engine, Supabase storage/DB integration, and a background job pipeline
- `supabase/migrations/` — database migration SQL files for Supabase
- `backend/policies/` — JSON compliance policy definitions
- `pitch-deck/` — presentation materials

---

## 🔧 Key Features
- Document upload: PDF, PNG, JPG
- OCR + extraction: `pdfplumber`, `pytesseract`, `Pillow`
- Policy evaluation using JSON rule engine
- Agent swarm orchestration showcasing Auditor / Negotiator / Closer events
- Approvals workflow with review/reject API
- Live WebSocket agent thought streaming
- Supabase storage + database integration with demo-safe fallback behavior

---

## 🧪 Supported Document Types
- `invoice`
- `contract`
- `purchase_order`
- `compliance_certificate`
- `unknown` (auto-detect fallback)

---

## 📦 Quick Start

### 1) Backend setup
```bash
cd backend
python -m venv venv
# macOS/Linux
source venv/bin/activate
# Windows PowerShell
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy the backend environment template and configure your Supabase and SMTP values:
```bash
copy .env.example .env
```

Then start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend setup
```bash
cd frontend
npm install
```

Create a frontend environment file:
```bash
# manually create .env.local
```

Start the frontend:
```bash
npm run dev
```

Open the app in your browser at `http://localhost:3000`.

---

## 🌐 Environment Variables

### Backend (`backend/.env`)
Use `backend/.env.example` as the source of truth.
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
KIMI_API_KEY=sk-your-kimi-api-key
KIMI_BASE_URL=https://api.moonshot.cn/v1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
APP_ENV=development
APP_PORT=8000
LOG_LEVEL=INFO
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Note: `frontend/.env.local` is not included in the repo, so you need to create it manually.

---

## 🧠 Backend Architecture
- `backend/app/main.py` starts the FastAPI app, includes CORS + GZip middleware, and registers routers
- `backend/app/routers/` contains endpoints for health, jobs, document upload, approvals, and WebSocket streaming
- `backend/app/services/` contains core business logic:
  - `document_processor.py` for PDF/image parsing and extraction
  - `policy_engine.py` for JSON policy evaluation
  - `supabase_service.py` for Supabase storage, job records, and audit logging
  - `email_service.py` for SMTP sending
- `backend/app/core/kimi_swarm.py` simulates the Kimi agent swarm orchestration, with fallback local extraction if OpenAI is not configured
- `backend/app/core/events.py` implements an in-memory event bus used to broadcast agent events to WebSocket clients

---

## 🔌 Frontend Architecture
- `frontend/src/app/page.tsx` is the dashboard entry point
- `frontend/src/app/auth/page.tsx` provides Supabase sign-in and sign-up flows
- `frontend/src/components/dashboard/` contains upload, jobs list, and detail panel UI
- `frontend/src/components/agents/` renders the Agent Thought Stream
- `frontend/src/hooks/use-agent-websocket.ts` connects to `/ws/agents/{job_id}` for live streaming
- `frontend/src/lib/api.ts` calls backend REST endpoints and approval APIs
- `frontend/src/components/ui/supabase-provider.tsx` creates the Supabase client from environment variables

---

## 🔌 API Endpoints
### Backend REST
- `GET /` — service metadata
- `GET /api/v1/health` — health check
- `GET /api/v1/dashboard/stats` — dashboard metrics
- `GET /api/v1/jobs` — list jobs
- `POST /api/v1/documents/upload` — upload and process documents
- `GET /api/v1/documents/jobs/{job_id}` — job details
- `GET /api/v1/documents/jobs/{job_id}/events` — job event history
- `POST /api/v1/approvals/review` — approve or reject remediation drafts
- `GET /api/v1/approvals/pending` — list pending approvals

### WebSocket
- `GET /ws/agents/{job_id}` — live Agent Thought Stream connection

---

## ✅ Notes on Current Behavior
- The frontend uses Supabase auth, but the backend currently operates in demo mode and bypasses strict auth checks for document processing and job listing
- The backend writes to Supabase tables and storage, but it contains fallback handling for failed Supabase operations so the demo remains functional
- `supabase/config.toml` is not present in this repo, so Supabase CLI migration commands require custom project setup if you want to use them
- The backend can run without a local Redis instance; `docker-compose.yml` includes Redis as optional scaling support for WebSockets

---

## 🧪 Running Tests
### Backend
```bash
cd backend
pytest -xvs
```

### Frontend
```bash
cd frontend
npm run dev
npm run lint
```

> Note: There is no dedicated frontend test suite configured in this repo today.

---

## 🐳 Docker
Run the full stack with Docker Compose:
```bash
docker compose up --build
```

Services:
- `backend` — FastAPI API server
- `frontend` — Next.js app
- `redis` — optional Redis for websocket/pubsub scaling

---

## 📂 Repository Layout
```
complianceflow-ai/
├── backend/
├── frontend/
├── pitch-deck/
└── supabase/
```

---

## 📜 License
MIT
""" , encoding='utf-8')
