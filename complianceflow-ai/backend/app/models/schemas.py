from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional, Literal
from datetime import datetime
from enum import Enum

class DocumentType(str, Enum):
    INVOICE = "invoice"
    CONTRACT = "contract"
    COMPLIANCE_CERTIFICATE = "compliance_certificate"
    PURCHASE_ORDER = "purchase_order"
    UNKNOWN = "unknown"

class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DISCREPANCIES_FOUND = "discrepancies_found"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"

class UploadRequest(BaseModel):
    filename: str
    document_type: DocumentType = DocumentType.UNKNOWN
    policy_id: str = "enterprise_compliance_v1"
    metadata: Optional[Dict[str, Any]] = None

class ExtractedField(BaseModel):
    field_type: str
    values: List[Any]
    confidence: float = Field(ge=0.0, le=1.0)

class Discrepancy(BaseModel):
    rule_id: str
    rule_name: str
    severity: Severity
    message: str
    field: str
    expected: Optional[str] = None
    actual: Optional[str] = None
    suggested_fix: Optional[str] = None

class AgentThought(BaseModel):
    id: str
    agent_name: str
    event_type: Literal["thought", "action", "result", "error", "handoff"]
    payload: Dict[str, Any]
    timestamp: str
    parent_id: Optional[str] = None

class AuditResult(BaseModel):
    document_id: str
    extracted_fields: Dict[str, Any]
    discrepancies: List[Discrepancy]
    confidence_score: float = Field(ge=0.0, le=1.0)
    processing_time_ms: int
    status: JobStatus

class EmailDraft(BaseModel):
    subject: str
    html_body: str
    text_body: Optional[str] = None
    recipient: str
    sender: str
    status: Literal["drafted", "pending_approval", "approved", "sent", "failed"]
    requires_approval: bool = True
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None

class ComplianceJob(BaseModel):
    id: str
    document_name: str
    document_type: DocumentType
    policy_id: str
    status: JobStatus
    created_at: str
    updated_at: str
    audit_result: Optional[AuditResult] = None
    email_draft: Optional[EmailDraft] = None
    dashboard_status: Optional[Dict[str, Any]] = None
    agent_events: List[AgentThought] = []
    final_certificate_url: Optional[str] = None

class ApprovalRequest(BaseModel):
    job_id: str
    approved: bool
    approver_email: str
    approver_name: str
    notes: Optional[str] = None

class DashboardStats(BaseModel):
    total_documents: int
    compliant_count: int
    non_compliant_count: int
    pending_count: int
    avg_processing_time_ms: int
    critical_issues_count: int
    compliance_rate: float
