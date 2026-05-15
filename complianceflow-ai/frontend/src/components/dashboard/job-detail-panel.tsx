"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ComplianceJob, Discrepancy } from "@/types";
import { getSeverityColor, formatDate, formatDuration } from "@/lib/utils";
import { approveEmail } from "@/lib/api";
import { useToast } from "@/components/ui/toaster";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Mail,
  Shield,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface JobDetailPanelProps {
  job: ComplianceJob | null;
}

export function JobDetailPanel({ job }: JobDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"discrepancies" | "email" | "status">("discrepancies");
  const [approving, setApproving] = useState(false);
  const [approverEmail, setApproverEmail] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const { toast } = useToast();

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <FileText className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Select a job to view details</p>
      </div>
    );
  }

  const handleApproval = async (approved: boolean) => {
    if (!approverEmail || !approverName) {
      toast({
        title: "Missing Information",
        description: "Please provide your email and name",
        variant: "destructive",
      });
      return;
    }

    setApproving(true);
    try {
      await approveEmail(job.id, approved, approverEmail, approverName, approvalNotes);
      toast({
        title: approved ? "Approved & Sent" : "Rejected",
        description: approved
          ? "Email sent to vendor. Dashboard updated."
          : "Email draft rejected. Negotiator will revise.",
        variant: approved ? "success" : "default",
      });
    } catch (error: any) {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const discrepancies = job.audit_result?.discrepancies || [];
  const emailDraft = job.email_draft;
  const dashboardStatus = job.dashboard_status;

  return (
    <div className="flex flex-col h-full">
      {/* Job Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">{job.document_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={job.status} />
              <span className="text-xs text-slate-500">
                {formatDate(job.created_at)}
              </span>
            </div>
          </div>
          <div className="text-right">
            {job.audit_result && (
              <div className="text-xs text-slate-400">
                Confidence: {Math.round(job.audit_result.confidence_score * 100)}%
              </div>
            )}
            {job.audit_result?.processing_time_ms && (
              <div className="text-xs text-slate-500">
                Processed in {formatDuration(job.audit_result.processing_time_ms)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {[
          { id: "discrepancies", label: "Discrepancies", count: discrepancies.length, icon: AlertTriangle },
          { id: "email", label: "Email Draft", count: emailDraft ? 1 : 0, icon: Mail },
          { id: "status", label: "Status", count: 0, icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-violet-400 border-b-2 border-violet-500 bg-violet-950/20"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        <AnimatePresence mode="wait">
          {activeTab === "discrepancies" && (
            <motion.div
              key="discrepancies"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              {discrepancies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <CheckCircle className="w-10 h-10 mb-2 text-emerald-400" />
                  <p className="text-sm font-medium">No discrepancies found</p>
                  <p className="text-xs mt-1">Document is fully compliant</p>
                </div>
              ) : (
                discrepancies.map((d, idx) => (
                  <DiscrepancyCard key={d.rule_id} discrepancy={d} index={idx} />
                ))
              )}
            </motion.div>
          )}

          {activeTab === "email" && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {!emailDraft ? (
                <div className="text-center py-8 text-slate-500">
                  <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No email draft available</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-slate-500">Subject</p>
                        <p className="text-sm font-medium text-slate-200">{emailDraft.subject}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-medium ${
                          emailDraft.status === "approved"
                            ? "bg-emerald-950/50 text-emerald-400"
                            : emailDraft.status === "sent"
                            ? "bg-blue-950/50 text-blue-400"
                            : "bg-amber-950/50 text-amber-400"
                        }`}
                      >
                        {emailDraft.status.toUpperCase()}
                      </span>
                    </div>
                    <div
                      className="text-xs text-slate-300 prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: emailDraft.html_body }}
                    />
                  </div>

                  {emailDraft.requires_approval && emailDraft.status === "drafted" && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Human Approval Required</span>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="email"
                          placeholder="Your email"
                          value={approverEmail}
                          onChange={(e) => setApproverEmail(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                        <input
                          type="text"
                          placeholder="Your name"
                          value={approverName}
                          onChange={(e) => setApproverName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                        <textarea
                          placeholder="Approval notes (optional)"
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproval(true)}
                          disabled={approving}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {approving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Approve & Send
                        </button>
                        <button
                          onClick={() => handleApproval(false)}
                          disabled={approving}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {activeTab === "status" && (
            <motion.div
              key="status"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {dashboardStatus ? (
                <div className="space-y-3">
                  <StatusCard
                    label="Case Status"
                    value={dashboardStatus.status}
                    color={dashboardStatus.status === "compliant" ? "emerald" : "amber"}
                  />
                  <StatusCard
                    label="Audit Score"
                    value={`${dashboardStatus.audit_score}/100`}
                    color={dashboardStatus.audit_score >= 80 ? "emerald" : dashboardStatus.audit_score >= 50 ? "amber" : "red"}
                  />
                  <StatusCard
                    label="Risk Level"
                    value={dashboardStatus.risk_level}
                    color={
                      dashboardStatus.risk_level === "none"
                        ? "emerald"
                        : dashboardStatus.risk_level === "low"
                        ? "blue"
                        : dashboardStatus.risk_level === "medium"
                        ? "amber"
                        : "red"
                    }
                  />
                  {dashboardStatus.next_action && (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                      <p className="text-xs text-slate-500 mb-1">Next Action</p>
                      <p className="text-sm text-slate-300">{dashboardStatus.next_action}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No dashboard status available</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DiscrepancyCard({ discrepancy, index }: { discrepancy: Discrepancy; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-lg border p-3 ${getSeverityColor(discrepancy.severity)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">{discrepancy.severity}</span>
            <span className="text-xs font-medium">{discrepancy.rule_name}</span>
          </div>
          <p className="text-xs text-slate-300">{discrepancy.message}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-slate-800/50 text-slate-500"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1.5">
              {discrepancy.expected && (
                <div className="text-xs">
                  <span className="text-slate-500">Expected: </span>
                  <span className="text-emerald-400">{discrepancy.expected}</span>
                </div>
              )}
              {discrepancy.actual && (
                <div className="text-xs">
                  <span className="text-slate-500">Actual: </span>
                  <span className="text-red-400">{discrepancy.actual}</span>
                </div>
              )}
              {discrepancy.suggested_fix && (
                <div className="text-xs">
                  <span className="text-slate-500">Suggested Fix: </span>
                  <span className="text-amber-400">{discrepancy.suggested_fix}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-slate-800 text-slate-400",
    processing: "bg-blue-950/50 text-blue-400 animate-pulse",
    discrepancies_found: "bg-red-950/50 text-red-400",
    pending_approval: "bg-amber-950/50 text-amber-400",
    approved: "bg-emerald-950/50 text-emerald-400",
    rejected: "bg-red-950/50 text-red-400",
    completed: "bg-emerald-950/50 text-emerald-400",
    failed: "bg-red-950/50 text-red-400",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${colors[status] || colors.pending}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-950/30 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-950/30 border-blue-500/20",
    amber: "text-amber-400 bg-amber-950/30 border-amber-500/20",
    red: "text-red-400 bg-red-950/30 border-red-500/20",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
