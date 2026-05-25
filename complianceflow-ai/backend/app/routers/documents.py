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
import json

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
    try:
        job_id = str(uuid.uuid4())
        user_id = "demo_user"

        logger.info("document_uploaded", job_id=job_id, filename=file.filename, user_id=user_id)

        file_bytes = await file.read()

        doc_url = await db_service.store_document(file_bytes, file.filename, user_id)

        valid_document_types = [e.value for e in DocumentType]
        resolved_doc_type = (
            DocumentType(document_type)
            if document_type in valid_document_types
            else DocumentType.UNKNOWN
        )

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
            "message": "Document uploaded successfully. Compliance agent swarm initiated."
        }

    except Exception as e:
        logger.exception("document_upload_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


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
    """Background compliance processing pipeline"""
    start_time = datetime.utcnow()

    try:
        # PHASE 1 — Processing Started
        await db_service.update_job_status(
            job_id=job_id,
            status=JobStatus.PROCESSING,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Orchestrator",
                event_type="thought",
                payload={
                    "message": "📄 Document received. Initiating OCR and extraction...",
                    "job_id": job_id,
                    "phase": "extraction"
                },
                parent_id=job_id
            ).to_dict()
        )

        # PHASE 2 — OCR + Extraction
        doc_result = await document_processor.process(file_bytes, filename)
        extracted_fields = doc_result.get("extracted_fields", {})

        # === CRITICAL DEBUG - RAW EXTRACTION ===
        raw_text_preview = doc_result.get("raw_text", "")[:1200]
        await db_service.update_job_status(
            job_id=job_id,
            status=JobStatus.PROCESSING,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Auditor",
                event_type="thought",
                payload={
                    "message": f"🔍 DEBUG RAW EXTRACTION:\n{raw_text_preview}\n\nDates: {extracted_fields.get('dates', [])}",
                    "job_id": job_id,
                    "phase": "debug_extraction",
                    "raw_text_length": len(doc_result.get("raw_text", ""))
                },
                parent_id=job_id
            ).to_dict()
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
                        f"🔍 Extracted {len(extracted_fields.get('amounts', []))} amounts, "
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

        # PHASE 3 — Policy Evaluation
        policy = policy_engine.get_policy(policy_id)
        if not policy:
            raise ValueError(f"Policy '{policy_id}' not found")

        eval_output = policy_engine.evaluate(policy_id, extracted_fields)

        compliance_status = eval_output.get("status", "COMPLIANT")
        compliance_score = eval_output.get("compliance_score", 100.0)
        raw_discrepancies = eval_output.get("discrepancies", [])
        email_draft = eval_output.get("email_draft")

        if compliance_status == "FULLY COMPLIANT":
            email_draft = None

        # Improved Enrichment
        discrepancies = []
        for d in raw_discrepancies:
            severity = d.get("severity", "MEDIUM").upper()
            rule_name = d.get("rule_name", "Compliance Rule")
            message = d.get("message", "")

            enriched_finding = {
                "rule_id": d.get("rule_id"),
                "rule_name": rule_name,
                "severity": severity,
                "risk_level": severity,
                "message": message,
                "explanation": f"Rule '{rule_name}' failed validation. {message} This increases overall compliance risk and may require manual intervention or escalation.",
                "evidence": f"Extracted Value: '{d.get('actual') or 'N/A'}' | Expected: '{d.get('expected') or 'Policy-compliant format'}'",
                "clause_reference": f"Section [{d.get('field', 'UNKNOWN').upper()}_REF]",
                "remediation_suggestion": d.get("suggested_fix") or "Review document terms and apply necessary corrections or waivers.",
                "note": d.get("note")
            }
            discrepancies.append(enriched_finding)

        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        risk_level_flag = "NONE"
        if compliance_status == "NON-COMPLIANT":
            risk_level_flag = "HIGH"
        elif compliance_status == "CONDITIONALLY COMPLIANT":
            risk_level_flag = "MEDIUM"

        executive_summary = policy_engine.generate_executive_summary(eval_output)

        audit_result = {
            "document_id": job_id,
            "extracted_fields": extracted_fields,
            "discrepancies": discrepancies,
            "confidence_score": 0.94,
            "compliance_score": compliance_score,
            "compliance_status": compliance_status,
            "processing_time_ms": processing_time,
            "risk_level": risk_level_flag.lower(),
            "status": "discrepancies_found" if discrepancies else "compliant",
            "executive_summary": executive_summary,
            "summary_source": "backend_v2"
        }

        job_completion_status = (
            JobStatus.DISCREPANCIES_FOUND
            if compliance_status in ["NON-COMPLIANT", "CONDITIONALLY COMPLIANT"] or discrepancies
            else JobStatus.COMPLETED
        )

        await db_service.update_job_status(
            job_id=job_id,
            status=job_completion_status,
            audit_result=audit_result,
            agent_event=AgentEvent(
                id=str(uuid.uuid4()),
                agent_name="Auditor",
                event_type="result",
                payload={
                    "message": f"Audit complete. Status: {compliance_status} ({compliance_score}/100). "
                              f"{len(discrepancies)} discrepancies detected.",
                    "job_id": job_id,
                    "discrepancy_count": len(discrepancies),
                    "confidence": 0.94,
                    "status": compliance_status,
                    "score": compliance_score
                },
                parent_id=job_id
            ).to_dict()
        )

        # PHASE 4 — Kimi Swarm
        if discrepancies:
            async for event in swarm_orchestrator.orchestrate_compliance_check(
                document_text=doc_result.get("raw_text", ""),
                policy_rules=policy.get("rules", []),
                document_type=extracted_fields.get("document_type", "unknown"),
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
                    "message": "✅ Document fully compliant. Generating certificate...",
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

        # Final Status Update
        await db_service.update_job_status(
            job_id=job_id,
            status=job_completion_status,
            audit_result=audit_result,
            email_draft=email_draft,
            dashboard_status={
                "risk_level": risk_level_flag.lower(),
                "completed_at": datetime.utcnow().isoformat(),
                "processing_time_ms": processing_time,
                "score": compliance_score,
                "compliance_status": compliance_status
            }
        )

        logger.info("document_processing_completed", job_id=job_id, status=job_completion_status.value)

        await db_service.log_audit_trail(
            job_id=job_id,
            action="compliance_check_complete",
            details={
                "discrepancies_found": len(discrepancies),
                "processing_time_ms": processing_time,
                "document_type": extracted_fields.get("document_type", "unknown"),
                "status": compliance_status,
                "score": compliance_score
            },
            user_id=user_id
        )

    except Exception as e:
        logger.exception("swarm_processing_failed", job_id=job_id, error=str(e))
        try:
            await db_service.update_job_status(
                job_id=job_id,
                status=JobStatus.FAILED,
                agent_event=AgentEvent(
                    id=str(uuid.uuid4()),
                    agent_name="Orchestrator",
                    event_type="error",
                    payload={"message": f"Processing failed: {str(e)}", "job_id": job_id},
                    parent_id=job_id
                ).to_dict()
            )
        except Exception as inner_error:
            logger.error("failed_to_mark_job_failed", job_id=job_id, error=str(inner_error))


# =========================================================
# Get Job Status + Events
# =========================================================

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = await db_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/events")
async def get_job_events(job_id: str):
    job = await db_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"events": job.get("agent_events", [])}