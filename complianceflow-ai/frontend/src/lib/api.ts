import { ComplianceJob, DashboardStats, UploadResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("supabase_access_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${url}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadDocument(
  file: File,
  documentType: string = "unknown",
  policyId: string = "enterprise_compliance_v1"
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  formData.append("policy_id", policyId);

  const token = localStorage.getItem("supabase_access_token");
  const res = await fetch(`${API_URL}/api/v1/documents/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail);
  }
  return res.json();
}

export async function getJob(jobId: string): Promise<ComplianceJob> {
  return fetchWithAuth(`/api/v1/documents/jobs/${jobId}`);
}

export async function getJobEvents(jobId: string): Promise<{ events: any[] }> {
  return fetchWithAuth(`/api/v1/documents/jobs/${jobId}/events`);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchWithAuth("/api/v1/dashboard/stats");
}

export async function listJobs(status?: string, limit = 50, offset = 0): Promise<{ jobs: ComplianceJob[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());
  return fetchWithAuth(`/api/v1/jobs?${params}`);
}

export async function approveEmail(
  jobId: string,
  approved: boolean,
  approverEmail: string,
  approverName: string,
  notes?: string
) {
  return fetchWithAuth("/api/v1/approvals/review", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      approved,
      approver_email: approverEmail,
      approver_name: approverName,
      notes,
    }),
  });
}

export async function getPendingApprovals(): Promise<{ pending_approvals: ComplianceJob[] }> {
  return fetchWithAuth("/api/v1/approvals/pending");
}
