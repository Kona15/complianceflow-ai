from supabase import create_client, Client
from typing import Dict, List, Any, Optional
from app.core.config import get_settings
from app.models.schemas import ComplianceJob, JobStatus, AgentThought
import structlog
from datetime import datetime

logger = structlog.get_logger()

class SupabaseService:
    """
    Database operations for ComplianceFlow AI.
    Handles jobs, documents, audit trails, and user data.
    """

    def __init__(self):
        self.settings = get_settings()
        self.client: Client = create_client(
            self.settings.supabase_url,
            self.settings.supabase_key
        )

    async def create_job(self, job: ComplianceJob) -> Dict[str, Any]:
        """Create a new compliance job in the database."""
        data = {
            "id": job.id,
            "document_name": job.document_name,
            "document_type": job.document_type.value,
            "policy_id": job.policy_id,
            "status": job.status.value,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "audit_result": job.audit_result.dict() if job.audit_result else None,
            "email_draft": job.email_draft.dict() if job.email_draft else None,
            "dashboard_status": job.dashboard_status,
            "agent_events": [e.dict() for e in job.agent_events],
            "final_certificate_url": job.final_certificate_url
        }

        result = self.client.table("compliance_jobs").insert(data).execute()
        logger.info("job_created", job_id=job.id, status=job.status.value)
        return result.data[0] if result.data else data

    async def update_job_status(
        self, 
        job_id: str, 
        status: JobStatus,
        audit_result: Optional[Dict] = None,
        email_draft: Optional[Dict] = None,
        dashboard_status: Optional[Dict] = None,
        agent_event: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Update job status and append agent events."""

        update_data = {
            "status": status.value,
            "updated_at": datetime.utcnow().isoformat()
        }

        if audit_result:
            update_data["audit_result"] = audit_result
        if email_draft:
            update_data["email_draft"] = email_draft
        if dashboard_status:
            update_data["dashboard_status"] = dashboard_status

        # Append agent event to array
        if agent_event:
            # Get existing events
            existing = self.client.table("compliance_jobs").select("agent_events").eq("id", job_id).execute()
            events = existing.data[0]["agent_events"] if existing.data and existing.data[0]["agent_events"] else []
            events.append(agent_event)
            update_data["agent_events"] = events

        result = self.client.table("compliance_jobs").update(update_data).eq("id", job_id).execute()
        logger.info("job_updated", job_id=job_id, status=status.value)
        return result.data[0] if result.data else update_data

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a compliance job by ID."""
        result = self.client.table("compliance_jobs").select("*").eq("id", job_id).execute()
        return result.data[0] if result.data else None

    async def list_jobs(
        self, 
        user_id: Optional[str] = None,
        status: Optional[JobStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List compliance jobs with optional filters."""
        query = self.client.table("compliance_jobs").select("*")

        if user_id:
            query = query.eq("user_id", user_id)
        if status:
            query = query.eq("status", status.value)

        query = query.order("created_at", desc=True).limit(limit).offset(offset)
        result = query.execute()
        return result.data or []

    async def store_document(self, file_bytes: bytes, filename: str, user_id: str) -> str:
        """Store document in Supabase Storage."""
        bucket = "compliance-documents"
        path = f"{user_id}/{datetime.utcnow().isoformat()}_{filename}"

        # Ensure bucket exists
        try:
            self.client.storage.get_bucket(bucket)
        except Exception:
            self.client.storage.create_bucket(bucket, {"public": False})

        result = self.client.storage.from_(bucket).upload(path, file_bytes)
        public_url = self.client.storage.from_(bucket).get_public_url(path)

        logger.info("document_stored", path=path, size=len(file_bytes))
        return public_url

    async def get_dashboard_stats(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get aggregated dashboard statistics."""
        query = self.client.table("compliance_jobs").select("*")
        if user_id:
            query = query.eq("user_id", user_id)

        result = query.execute()
        jobs = result.data or []

        total = len(jobs)
        compliant = sum(1 for j in jobs if j.get("status") == "completed")
        non_compliant = sum(1 for j in jobs if j.get("status") in ["discrepancies_found", "non_compliant_pending"])
        pending = sum(1 for j in jobs if j.get("status") in ["pending", "processing", "pending_approval"])
        critical = sum(
            1 for j in jobs 
            if j.get("audit_result", {}).get("discrepancies") 
            and any(d.get("severity") == "critical" for d in j["audit_result"]["discrepancies"])
        )

        processing_times = [
            j.get("audit_result", {}).get("processing_time_ms", 0) 
            for j in jobs if j.get("audit_result")
        ]
        avg_time = sum(processing_times) // len(processing_times) if processing_times else 0

        compliance_rate = (compliant / total * 100) if total > 0 else 0

        return {
            "total_documents": total,
            "compliant_count": compliant,
            "non_compliant_count": non_compliant,
            "pending_count": pending,
            "avg_processing_time_ms": avg_time,
            "critical_issues_count": critical,
            "compliance_rate": round(compliance_rate, 2)
        }

    async def log_audit_trail(self, job_id: str, action: str, details: Dict[str, Any], user_id: Optional[str] = None):
        """Log an immutable audit trail entry."""
        data = {
            "job_id": job_id,
            "action": action,
            "details": details,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "ip_address": None,  # Set by middleware
            "user_agent": None   # Set by middleware
        }

        self.client.table("audit_trail").insert(data).execute()
        logger.info("audit_logged", job_id=job_id, action=action)

# Singleton
db_service = SupabaseService()
