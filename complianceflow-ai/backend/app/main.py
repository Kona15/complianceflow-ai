from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import structlog

from app.routers.main import router as main_router
from app.routers.documents import router as docs_router
from app.routers.approvals import router as approval_router
from app.routers.websocket import router as ws_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("complianceflow_startup", message="ComplianceFlow AI starting up...")
    yield
    logger.info("complianceflow_shutdown", message="ComplianceFlow AI shutting down...")

app = FastAPI(
    title="ComplianceFlow AI",
    description="Agentic Orchestrator for Legal & Financial Document Verification using Kimi K2.6 Agent Swarm",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
app.include_router(main_router)
app.include_router(docs_router)
app.include_router(approval_router)
app.include_router(ws_router)

@app.get("/")
async def root():
    return {
        "service": "ComplianceFlow AI",
        "version": "1.0.0",
        "status": "operational",
        "agent_swarm": "Kimi K2.6",
        "max_sub_agents": 300,
        "max_coordinated_steps": 4000
    }
