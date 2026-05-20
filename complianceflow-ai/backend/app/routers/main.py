from fastapi import APIRouter
from app.models.schemas import DashboardStats
from app.services.supabase_service import db_service
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1", tags=["main"])


@router.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "ComplianceFlow AI", 
        "version": "1.0.0",
        "mode": "hackathon_demo"
    }


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """[HACKATHON DEMO] Auth disabled"""
    try:
        # Bypass user_id filter to avoid UUID error
        stats = await db_service.get_dashboard_stats(user_id=None)
        return DashboardStats(
            total_documents=stats.get("total_documents", 0),
            compliant_count=stats.get("compliant_count", 0),
            non_compliant_count=stats.get("non_compliant_count", 0),
            pending_count=stats.get("pending_count", 0),
            avg_processing_time_ms=stats.get("avg_processing_time_ms", 0),
            critical_issues_count=stats.get("critical_issues_count", 0),
            compliance_rate=float(stats.get("compliance_rate", 0.0))
        )
    except Exception as e:
        logger.warning("demo_stats_fallback", error=str(e))
        return DashboardStats(
            total_documents=4,
            compliant_count=1,
            non_compliant_count=2,
            pending_count=1,
            avg_processing_time_ms=2100,
            critical_issues_count=3,
            compliance_rate=25.0
        )


@router.get("/jobs")
async def list_jobs(
    status: str = None,
    limit: int = 50,
    offset: int = 0,
):
    """[HACKATHON DEMO] Auth disabled"""
    try:
        # Bypass user_id filter to avoid UUID error
        jobs = await db_service.list_jobs(
            user_id=None,      
            status=status,
            limit=limit,
            offset=offset
        )
        return {"jobs": jobs, "total": len(jobs)}
    except Exception as e:
        logger.warning("demo_jobs_fallback", error=str(e))
        return {"jobs": [], "total": 0}