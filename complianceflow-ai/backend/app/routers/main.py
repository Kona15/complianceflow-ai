from fastapi import APIRouter
from app.models.schemas import DashboardStats
from app.services.supabase_service import db_service
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1", tags=["main"])


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ComplianceFlow AI", "version": "1.0.0"}


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """[HACKATHON DEMO MODE] Authentication disabled for presentation"""
    try:
        stats = await db_service.get_dashboard_stats(user_id=None)
        return DashboardStats(**stats)
    except Exception as e:
        logger.warning("demo_stats_fallback", error=str(e))
        return DashboardStats(
            total_jobs=0,
            processing=0,
            completed=0,
            discrepancies_found=0,
            avg_processing_time=0
        )


@router.get("/jobs")
async def list_jobs(
    status: str = None,
    limit: int = 50,
    offset: int = 0,
):
    """[DEMO MODE] Authentication disabled for presentation"""
    try:
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