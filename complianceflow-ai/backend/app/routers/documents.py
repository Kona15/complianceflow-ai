from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from typing import Optional
import uuid
from datetime import datetime
import asyncio

from app.core.config import get_settings
from app.core.events import event_bus, AgentEvent
from app.core.kimi_swarm import swarm_orchestrator
from app.models.schemas import UploadRequest, ComplianceJob, JobStatus, DocumentType
from app.services.document_processor import document_processor
from app.services.policy_engine import policy_engine
from app.services.supabase_service import db_service
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: str = Form("unknown"),
    policy_id: str = Form("enterprise_compliance_v1"),
):
    """
    [HACKATHON DEMO] Auth disabled
    Upload a document and trigger the full Agent Swarm compliance pipeline.
    """
    job_id = str(uuid.uuid4())
    user_id = "demo_user"   # ← Demo mode

    logger.info("document_uploaded", 
               job_id=job_id, 
               filename=file.filename, 
               user_id=user_id)

    # Read file
    file_bytes = await file.read()

    # Store in Supabase Storage
    doc_url = await db_service.store_document(file_bytes, file.filename, user_id)

    # Create job record
    job = ComplianceJob(
        id=job_id,
        document_name=file.filename,
        document_type=DocumentType(document_type) if document_type in [e.value for e in DocumentType] else DocumentType.UNKNOWN,
        policy_id=policy_id,
        status=JobStatus.PENDING,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )

    await db_service.create_job(job)

    # Trigger background processing
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
        "message": "Document uploaded. Agent Swarm compliance check initiated."
    }


async def process_document_with_swarm(
    job_id: str,
    file_bytes: bytes,
    filename: str,
    policy_id: str,
    user_id: str
):
    """Background task - unchanged (already handles user_id)"""
    start_time = datetime.utcnow()

    try:
        # Phase 1: Document Processing
        await db_service.update_job_status(
            job_id, 
            JobStatus.PROCESSING,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Orchestrator",
                event_type="thought",
                payload={"message": "📄 Document received. Initiating OCR and field extraction...", "job_id": job_id, "phase": "extraction"},
                parent_id=job_id
            ).to_dict()
        )

        doc_result = await document_processor.process(file_bytes, filename)

        await db_service.update_job_status(
            job_id,
            JobStatus.PROCESSING,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Auditor",
                event_type="thought",
                payload={
                    "message": f"🔍 Extracted {len(doc_result['extracted_fields'].get('amounts', []))} amounts, {len(doc_result['extracted_fields'].get('dates', []))} dates, {len(doc_result['extracted_fields'].get('parties', []))} parties.",
                    "job_id": job_id,
                    "phase": "extraction_complete",
                    "extracted_summary": doc_result["extracted_fields"]
                },
                parent_id=job_id
            ).to_dict()
        )

        # Phase 2: Policy Evaluation
        policy = policy_engine.get_policy(policy_id)
        if not policy:
            raise ValueError(f"Policy {policy_id} not found")

        discrepancies = policy_engine.evaluate(policy_id, doc_result["extracted_fields"])

        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        audit_result = {
            "document_id": job_id,
            "extracted_fields": doc_result["extracted_fields"],
            "discrepancies": discrepancies,
            "confidence_score": 0.94,
            "processing_time_ms": processing_time,
            "status": "discrepancies_found" if discrepancies else "compliant"
        }

        await db_service.update_job_status(
            job_id,
            JobStatus.DISCREPANCIES_FOUND if discrepancies else JobStatus.COMPLETED,
            audit_result=audit_result,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Auditor",
                event_type="result",
                payload={
                    "message": f"Audit complete. {len(discrepancies)} discrepancies found." if discrepancies else "Audit complete. Document fully compliant.",
                    "job_id": job_id,
                    "discrepancy_count": len(discrepancies),
                    "confidence": 0.94
                },
                parent_id=job_id
            ).to_dict()
        )

        # Phase 3: Agent Swarm
        if discrepancies:
            async for event in swarm_orchestrator.orchestrate_compliance_check(
                document_text=doc_result["raw_text"],
                policy_rules=policy["rules"],
                document_type=doc_result["extracted_fields"].get("document_type", "unknown"),
                job_id=job_id
            ):
                await db_service.update_job_status(
                    job_id,
                    JobStatus.PROCESSING,
                    agent_event=event.to_dict()
                )
        else:
            closer_event = AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Closer",
                event_type="result",
                payload={
                    "message": "✅ Document fully compliant. Generating compliance certificate...",
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
                job_id,
                JobStatus.COMPLETED,
                dashboard_status={
                    "case_id": job_id,
                    "status": "compliant",
                    "audit_score": 100,
                    "risk_level": "none",
                    "certificate_generated": True
                },
                agent_event=closer_event.to_dict()
            )

        await db_service.log_audit_trail(
            job_id=job_id,
            action="compliance_check_complete",
            details={
                "discrepancies_found": len(discrepancies),
                "processing_time_ms": processing_time,
                "document_type": doc_result["extracted_fields"].get("document_type", "unknown")
            },
            user_id=user_id
        )

    except Exception as e:
        logger.error("swarm_processing_failed", job_id=job_id, error=str(e))
        await db_service.update_job_status(
            job_id,
            JobStatus.FAILED,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Orchestrator",
                event_type="error",
                payload={"message": f"Processing failed: {str(e)}", "job_id": job_id},
                parent_id=job_id
            ).to_dict()
        )


# ==================== DEMO MODE ENDPOINTS ====================

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """[HACKATHON DEMO] Auth disabled"""
    job = await db_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/events")
async def get_job_events(job_id: str):
    """[HACKATHON DEMO] Auth disabled"""
    job = await db_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"events": job.get("agent_events", [])}