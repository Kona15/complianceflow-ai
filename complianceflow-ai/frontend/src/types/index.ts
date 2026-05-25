export interface AgentEvent {
  id: string;
  agent_name: "Auditor" | "Negotiator" | "Closer" | "Orchestrator" | "System";
  event_type: "thought" | "action" | "result" | "error" | "handoff" | "connection";
  payload: {
    message: string;
    job_id?: string;
    step?: number;
    phase?: string;
    [key: string]: any;
  };
  timestamp: string;
  parent_id?: string;
}

export interface Discrepancy {
  rule_id: string;
  rule_name: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  field: string;
  expected?: string;
  actual?: string;
  suggested_fix?: string;
}

export interface ComplianceJob {
  id: string;
  document_name: string;
  document_type: string;
  policy_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  audit_result?: {
    extracted_fields: Record<string, any>;
    discrepancies: Discrepancy[];
    confidence_score: number;
    processing_time_ms: number;
    status: string;
  };
  email_draft?: {
    subject: string;
    html_body: string;
    text_body?: string;
    recipient: string;
    sender: string;
    status: string;
    requires_approval: boolean;
    approved_by?: string;
    approved_at?: string;
  };
  dashboard_status?: {
    case_id: string;
    status: string;
    audit_score: number;
    risk_level: string;
    next_action?: string;
  };
  agent_events: AgentEvent[];
  final_certificate_url?: string;
}

export interface DashboardStats {
  total_documents: number;
  compliant_count: number;
  non_compliant_count: number;
  pending_count: number;
  avg_processing_time_ms: number;
  critical_issues_count: number;
  compliance_rate: number;
}

export interface UploadResponse {
  job_id: string;
  status: string;
  document_url: string;
  message: string;
}
