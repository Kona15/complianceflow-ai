from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
    HTTPException
)

from typing import Optional
import uuid
from datetime import datetime

from app.core.events import event_bus, AgentEvent
from app.core.kimi_swarm import swarm_orchestrator
from app.models.schemas import (
    ComplianceJob,
    JobStatus,
    DocumentType
)

from app.services.document_processor import document_processor
from app.services.policy_engine import policy_engine
from app.services.supabase_service import db_service

import structlog

logger = structlog.get_logger()

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["documents"]
)


# =========================================================
# Upload Endpoint
# =========================================================

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: str = Form("unknown"),
    policy_id: str = Form("enterprise_compliance_v1"),
):
    """
    Upload document and trigger compliance workflow
    Hackathon Demo Mode (Auth Disabled)
    """

    try:
        job_id = str(uuid.uuid4())

        # Demo mode
        user_id = "demo_user"

        logger.info(
            "document_uploaded",
            job_id=job_id,
            filename=file.filename,
            user_id=user_id
        )

        # Read uploaded file
        file_bytes = await file.read()

        # Store document
        doc_url = await db_service.store_document(
            file_bytes,
            file.filename,
            user_id
        )

        # Validate document type
        valid_document_types = [
            e.value for e in DocumentType
        ]

        resolved_doc_type = (
            DocumentType(document_type)
            if document_type in valid_document_types
            else DocumentType.UNKNOWN
        )

        # Create job
        job = ComplianceJob(
            id=job_id,
            document_name=file.filename,
            document_type=resolved_doc_type,
            policy_id=policy_id,
            status=JobStatus.PENDING,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )

        await db_service.create_job(job)

        # Background processing
        background_tasks.add_task(
            process_document_with_swarm,
            job_id=job_id,
            file_bytes=file_bytes,
            filename=file.filename,
            policy_id=policy_id,
            user_id=user_id
        )

        return {
            "job_id": job_id,
            "status": "processing",
            "document_url": doc_url,
            "message": (
                "Document uploaded successfully. "
                "Compliance agent swarm initiated."
            )
        }

    except Exception as e:

        logger.exception(
            "document_upload_failed",
            error=str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )


# =========================================================
# Agent Swarm Processing
# =========================================================

async def process_document_with_swarm(
    job_id: str,
    file_bytes: bytes,
    filename: str,
    policy_id: str,
    user_id: str
):
    """
    Background compliance processing pipeline
    """

    start_time = datetime.utcnow()

    try:

        # =================================================
        # PHASE 1 — Processing Started
        # =================================================

        await db_service.update_job_status(
            job_id=job_id,
            status=JobStatus.PROCESSING,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Orchestrator",
                event_type="thought",
                payload={
                    "message": (
                        "📄 Document received. "
                        "Initiating OCR and extraction..."
                    ),
                    "job_id": job_id,
                    "phase": "extraction"
                },
                parent_id=job_id
            ).to_dict()
        )

        # =================================================
        # PHASE 2 — OCR + Extraction
        # =================================================

        doc_result = await document_processor.process(
            file_bytes,
            filename
        )

        extracted_fields = doc_result.get(
            "extracted_fields",
            {}
        )

        await db_service.update_job_status(
            job_id=job_id,
            status=JobStatus.PROCESSING,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Auditor",
                event_type="thought",
                payload={
                    "message": (
                        f"🔍 Extracted "
                        f"{len(extracted_fields.get('amounts', []))} amounts, "
                        f"{len(extracted_fields.get('dates', []))} dates, "
                        f"{len(extracted_fields.get('parties', []))} parties."
                    ),
                    "job_id": job_id,
                    "phase": "extraction_complete",
                    "extracted_summary": extracted_fields
                },
                parent_id=job_id
            ).to_dict()
        )

        # =================================================
        # PHASE 3 — Policy Evaluation
        # =================================================

        policy = policy_engine.get_policy(policy_id)

        if not policy:
            raise ValueError(
                f"Policy '{policy_id}' not found"
            )

        discrepancies = policy_engine.evaluate(
            policy_id,
            extracted_fields
        )

        processing_time = int(
            (
                datetime.utcnow() - start_time
            ).total_seconds() * 1000
        )

        audit_result = {
            "document_id": job_id,
            "extracted_fields": extracted_fields,
            "discrepancies": discrepancies,
            "confidence_score": 0.94,
            "processing_time_ms": processing_time,
            "risk_level": (
                "medium" if discrepancies else "none"
            ),
            "status": (
                "discrepancies_found"
                if discrepancies
                else "compliant"
            )
        }

        await db_service.update_job_status(
            job_id=job_id,
            status=(
                JobStatus.DISCREPANCIES_FOUND
                if discrepancies
                else JobStatus.COMPLETED
            ),
            audit_result=audit_result,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Auditor",
                event_type="result",
                payload={
                    "message": (
                        f"Audit complete. "
                        f"{len(discrepancies)} discrepancies found."
                        if discrepancies
                        else "Audit complete. Document compliant."
                    ),
                    "job_id": job_id,
                    "discrepancy_count": len(discrepancies),
                    "confidence": 0.94
                },
                parent_id=job_id
            ).to_dict()
        )

        # =================================================
        # PHASE 4 — Kimi Swarm Orchestration
        # =================================================

        if discrepancies:

            async for event in swarm_orchestrator.orchestrate_compliance_check(
                document_text=doc_result.get("raw_text", ""),
                policy_rules=policy.get("rules", []),
                document_type=extracted_fields.get(
                    "document_type",
                    "unknown"
                ),
                job_id=job_id
            ):

                await db_service.update_job_status(
                    job_id=job_id,
                    status=JobStatus.PROCESSING,
                    agent_event=event.to_dict()
                )

        else:

            closer_event = AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Closer",
                event_type="result",
                payload={
                    "message": (
                        "✅ Document fully compliant. "
                        "Generating certificate..."
                    ),
                    "job_id": job_id,
                    "status": "compliant",
                    "dashboard_update": {
                        "case_id": job_id,
                        "status": "compliant",
                        "audit_score": 100,
                        "risk_level": "none",
                        "certificate_generated": True
                    }
                },
                parent_id=job_id
            )

            await event_bus.publish(closer_event)

            await db_service.update_job_status(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                dashboard_status={
                    "case_id": job_id,
                    "status": "compliant",
                    "audit_score": 100,
                    "risk_level": "none",
                    "certificate_generated": True
                },
                agent_event=closer_event.to_dict()
            )

        # =================================================
        # FINAL STATUS UPDATE
        # IMPORTANT FIX FOR STUCK PROCESSING
        # =================================================

        final_status = (
            JobStatus.DISCREPANCIES_FOUND
            if discrepancies
            else JobStatus.COMPLETED
        )

        await db_service.update_job_status(
            job_id=job_id,
            status=final_status,
            audit_result=audit_result,
            dashboard_status={
                "risk_level": (
                    "medium"
                    if discrepancies
                    else "none"
                ),
                "completed_at": (
                    datetime.utcnow().isoformat()
                ),
                "processing_time_ms": processing_time
            }
        )

        logger.info(
            "document_processing_completed",
            job_id=job_id,
            status=final_status.value
        )

        # =================================================
        # AUDIT TRAIL
        # =================================================

        await db_service.log_audit_trail(
            job_id=job_id,
            action="compliance_check_complete",
            details={
                "discrepancies_found": len(discrepancies),
                "processing_time_ms": processing_time,
                "document_type": extracted_fields.get(
                    "document_type",
                    "unknown"
                )
            },
            user_id=user_id
        )

    except Exception as e:

        logger.exception(
            "swarm_processing_failed",
            job_id=job_id,
            error=str(e)
        )

        try:

            await db_service.update_job_status(
                job_id=job_id,
                status=JobStatus.FAILED,
                agent_event=AgentEvent(
                    id=str(uuid.uuid4()),
                    agent_name="Orchestrator",
                    event_type="error",
                    payload={
                        "message": (
                            f"Processing failed: {str(e)}"
                        ),
                        "job_id": job_id
                    },
                    parent_id=job_id
                ).to_dict()
            )

        except Exception as inner_error:

            logger.error(
                "failed_to_mark_job_failed",
                job_id=job_id,
                error=str(inner_error)
            )


# =========================================================
# Get Job Status
# =========================================================

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """
    Get compliance job details
    """

    job = await db_service.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    return job


# =========================================================
# Get Job Events
# =========================================================

@router.get("/jobs/{job_id}/events")
async def get_job_events(job_id: str):
    """
    Get real-time agent events
    """

    job = await db_service.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    return {
        "events": job.get("agent_events", [])
    }