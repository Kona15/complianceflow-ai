from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.models.schemas import ApprovalRequest, JobStatus
from app.services.email_service import email_service
from app.services.supabase_service import db_service
from app.core.events import event_bus, AgentEvent
import uuid
from datetime import datetime
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/approvals", tags=["approvals"])


@router.post("/review")
async def review_approval(
    request: ApprovalRequest,
    background_tasks: BackgroundTasks,
):
    """[HACKATHON DEMO] Auth disabled"""
    job = await db_service.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("status") != JobStatus.PENDING_APPROVAL.value:
        raise HTTPException(status_code=400, detail="Job is not pending approval")

    approver_event = AgentEvent(
        id=str(uuid.uuid4()),
        agent_name="Negotiator",
        event_type="thought",
        payload={
            "message": f"👤 Human review received from {request.approver_name or 'Demo User'}. Decision: {'APPROVED' if request.approved else 'REJECTED'}",
            "job_id": request.job_id,
            "approver": request.approver_email or "demo@hackathon.com",
            "notes": request.notes
        },
        parent_id=request.job_id
    )
    await event_bus.publish(approver_event)
    await db_service.update_job_status(
        request.job_id,
        JobStatus.PROCESSING,
        agent_event=approver_event.to_dict()
    )

    if request.approved:
        email_draft = job.get("email_draft", {})
        email_draft["status"] = "approved"
        email_draft["approved_by"] = request.approver_email or "demo@hackathon.com"
        email_draft["approved_at"] = datetime.utcnow().isoformat()

        await db_service.update_job_status(
            request.job_id,
            JobStatus.APPROVED,
            email_draft=email_draft,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Negotiator",
                event_type="action",
                payload={
                    "message": "📧 Email approved. Sending to vendor...",
                    "job_id": request.job_id,
                    "recipient": email_draft.get("recipient")
                },
                parent_id=request.job_id
            ).to_dict()
        )

        background_tasks.add_task(email_service.send_email, email_draft)

        closer_event = AgentEvent(
            id=str(uuid.uuid4()),
            agent_name="Closer",
            event_type="thought",
            payload={
                "message": "📋 Approval granted. Updating dashboard status...",
                "job_id": request.job_id
            },
            parent_id=request.job_id
        )
        await event_bus.publish(closer_event)

        await db_service.update_job_status(
            request.job_id,
            JobStatus.COMPLETED,
            dashboard_status={
                "case_id": request.job_id,
                "status": "awaiting_vendor_response",
                "audit_score": job.get("audit_result", {}).get("confidence_score", 0) * 100,
                "risk_level": "medium",
                "next_action": "Await vendor response (48h SLA)",
                "email_sent": True,
                "approved_by": request.approver_email or "demo@hackathon.com"
            },
            agent_event=closer_event.to_dict()
        )

        return {
            "status": "approved",
            "message": "Email approved and sent.",
            "job_id": request.job_id
        }
    else:
        await db_service.update_job_status(
            request.job_id,
            JobStatus.REJECTED,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Negotiator",
                event_type="result",
                payload={
                    "message": f"❌ Approval rejected. Reason: {request.notes or 'No reason provided'}",
                    "job_id": request.job_id,
                    "requires_revision": True
                },
                parent_id=request.job_id
            ).to_dict()
        )

        return {
            "status": "rejected",
            "message": "Email draft rejected.",
            "job_id": request.job_id
        }


@router.get("/pending")
async def list_pending_approvals():
    """[HACKATHON DEMO] Auth disabled"""
    jobs = await db_service.list_jobs(
        user_id="demo_user",
        status=JobStatus.PENDING_APPROVAL,
        limit=100
    )
    return {"pending_approvals": jobs}