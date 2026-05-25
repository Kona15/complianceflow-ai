"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ComplianceJob, Discrepancy } from "@/types";
import { formatDate, formatDuration } from "@/lib/utils";
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
  Send,
  User,
  MessageSquare,
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
        description: "Please provide your email and name before updating the status.",
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
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const discrepancies = job.audit_result?.discrepancies || [];
  // Prefer top-level draft, otherwise try to recover from agent events (legacy payloads)
  let emailDraft: any = job.email_draft;
  if (!emailDraft) {
    const events = job.agent_events || [];
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      const evalReport = (ev.payload && ev.payload.evaluation_report) || (ev.payload && ev.payload.evaluation_report);
      const candidate = evalReport && evalReport.email_draft;
      if (candidate) {
        // Normalize if backend sent a plain string
        if (typeof candidate === "string") {
          emailDraft = {
            subject: candidate.split("\n\n")[0]?.replace(/^Subject:\s*/i, "") || "",
            text_body: candidate,
            html_body: candidate,
            recipient: "vendor@unknown.com",
            sender: "compliance@complianceflow.ai",
            status: "drafted",
            requires_approval: true,
          };
        } else {
          emailDraft = candidate;
        }
        break;
      }
    }
  }
  const dashboardStatus = job.dashboard_status;

  // Generate PDF Certificate
  const generateComplianceReport = async (targetJob: ComplianceJob) => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("COMPLIANCE CERTIFICATE", 105, 25, { align: "center" });

      doc.setDrawColor(100, 100, 100);
      doc.line(20, 35, 190, 35);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Document: ${targetJob.document_name}`, 20, 50);
      doc.text(`Job ID: ${targetJob.id.slice(0, 8)}...`, 20, 60);
      doc.text(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 20, 70);
      doc.text(`Policy: ${targetJob.policy_id}`, 20, 80);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const isCompliant = targetJob.status === "completed";
      const statusText = isCompliant ? "FULLY COMPLIANT" : "DISCREPANCIES FOUND";

      doc.setTextColor(isCompliant ? 0 : 220, isCompliant ? 128 : 50, 0);
      doc.text(statusText, 20, 100);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      const confidence = targetJob.audit_result?.confidence_score 
        ? Math.round(targetJob.audit_result.confidence_score * 100) 
        : 0;
      doc.text(`Confidence Score: ${confidence}%`, 20, 115);

      doc.setFontSize(13);
      doc.text("Findings", 20, 135);

      doc.setFontSize(10);
      if (discrepancies.length === 0) {
        doc.text("No discrepancies found. Document meets all compliance requirements.", 25, 150);
      } else {
        doc.text(`Discrepancies Detected: ${discrepancies.length}`, 25, 150);
        let y = 165;
        discrepancies.slice(0, 6).forEach((d) => {
          if (y > 260) return;
          doc.text(`• ${d.rule_name} - ${d.message.substring(0, 60)}${d.message.length > 60 ? "..." : ""}`, 25, y);
          y += 8;
        });
      }

      doc.setFontSize(10);
      doc.text("Generated by ComplianceFlow AI • Powered by Kimi Swarm", 105, 285, { align: "center" });
      doc.text("This is an AI-generated compliance report.", 105, 292, { align: "center" });

      doc.save(`${targetJob.document_name.replace(/\.[^/.]+$/, "")}_Compliance_Report.pdf`);

      toast({
        title: "✅ Certificate Downloaded",
        description: "Professional compliance report saved successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Download Failed",
        description: "Could not generate PDF.",
        variant: "destructive",
      });
    }
  };

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

          <div className="text-right flex flex-col items-end gap-3">
            {job.audit_result && (
              <>
                <div className="text-xs text-slate-400">
                  Confidence: {Math.round((job.audit_result.confidence_score || 0) * 100)}%
                </div>
                {job.audit_result?.processing_time_ms && (
                  <div className="text-xs text-slate-500">
                    Processed in {formatDuration(job.audit_result.processing_time_ms)}
                  </div>
                )}
              </>
            )}

            {(job.status === "completed" || job.status === "discrepancies_found") && (
              <button
                onClick={() => generateComplianceReport(job)}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
              >
                <FileText className="w-4 h-4" />
                Download Certificate
              </button>
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
        ].map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-violet-400 border-b-2 border-violet-500 bg-violet-950/20"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <IconComponent className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px]">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        <AnimatePresence mode="wait">
          {activeTab === "discrepancies" && (
            <motion.div
              key="discrepancies"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Executive AI Summary */}
              <ExecutiveSummary job={job} discrepancies={discrepancies} />

              {discrepancies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-2xl">
                  <CheckCircle className="w-12 h-12 mb-3 text-emerald-400" />
                  <p className="text-lg font-medium text-emerald-400">Fully Compliant</p>
                  <p className="text-sm mt-1">All policy rules passed successfully.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500 px-1">
                    Detected Issues ({discrepancies.length})
                  </p>
                  {discrepancies.map((d, idx) => (
                    <DiscrepancyCard key={d.rule_id || idx} discrepancy={d} index={idx} />
                  ))}
                </div>
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
                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No remediation email draft needed for fully compliant workflows.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Left Form: Sign-off Info */}
                  <div className="lg:col-span-2 space-y-4 bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-violet-400" /> Approver Credentials
                    </p>
                    
                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={approverName}
                          onChange={(e) => setApproverName(e.target.value)}
                          placeholder="e.g., Femi-Makinsun Praise"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500/50 rounded-xl px-3 py-2 text-slate-200 focus:outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Corporate Email</label>
                        <input
                          type="email"
                          value={approverEmail}
                          onChange={(e) => setApproverEmail(e.target.value)}
                          placeholder="praisefemi1501@gmail.com"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500/50 rounded-xl px-3 py-2 text-slate-200 focus:outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Negotiator Routing Notes (Optional)</label>
                        <textarea
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          placeholder="Add special execution requests or compliance directives here..."
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500/50 rounded-xl p-3 text-slate-200 focus:outline-none resize-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={() => handleApproval(true)}
                        disabled={approving}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Approve & Send Draft
                      </button>
                      <button
                        onClick={() => handleApproval(false)}
                        disabled={approving}
                        className="w-full py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition-colors"
                      >
                        Reject & Request Revision
                      </button>
                    </div>
                  </div>

                  {/* Right Window: Live Mail Body Markup Rendering */}
                  <div className="lg:col-span-3 flex flex-col border border-slate-800 bg-slate-950/80 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 font-medium text-violet-400">
                        <MessageSquare className="w-3.5 h-3.5" /> Negotiator Engine output
                      </span>
                      <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded">STABLE_V2</span>
                    </div>
                    {/* Fixed: Extracting string values explicitly from emailDraft instead of rendering raw object */}
                    <div className="p-4 flex-1 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text overflow-y-auto max-h-[360px] space-y-2">
                      {typeof emailDraft === "object" && emailDraft !== null ? (
                        <>
                          <div><span className="text-slate-500">To:</span> {emailDraft.recipient || "N/A"}</div>
                          <div><span className="text-slate-500">Subject:</span> {emailDraft.subject || "N/A"}</div>
                          <hr className="border-slate-800 my-2" />
                          <div className="text-slate-200">{emailDraft.html_body || emailDraft.text_body || ""}</div>
                        </>
                      ) : (
                        String(emailDraft)
                      )}
                    </div>
                  </div>
                </div>
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
              <div className="grid grid-cols-2 gap-3">
                <StatusCard label="Current Workflow Node" value={job.status.replace(/_/g, " ")} color="blue" />
                <StatusCard 
                  label="Risk Evaluation Score" 
                  value={job.audit_result?.confidence_score !== undefined ? `${100 - Math.round(job.audit_result.confidence_score * 100)}/100` : "N/A"} 
                  color={discrepancies.length > 0 ? "red" : "emerald"} 
                />
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-400" /> Pipeline Processing Logs
                </h4>
                <div className="space-y-2.5 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Task Initialized:</span>
                    <span className="text-slate-300">{formatDate(job.created_at)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Target Policy Profile:</span>
                    <span className="text-violet-400 font-bold">{job.policy_id}</span>
                  </div>
                  {dashboardStatus && Object.entries(dashboardStatus).map(([key, val]: any) => (
                    <div key={key} className="flex justify-between border-b border-slate-900 pb-1">
                      <span className="capitalize">{key.replace(/_/g, " ")}:</span>
                      <span className="text-slate-200">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ====================== EXECUTIVE SUMMARY ====================== */
function ExecutiveSummary({ 
  job, 
  discrepancies 
}: { 
  job: ComplianceJob; 
  discrepancies: Discrepancy[] 
}) {
  // Fixed: Inline type-cast to access the extended backend field without interface compiler breakage
  const backendSummary = (job.audit_result as any)?.executive_summary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="font-semibold text-violet-300">AI Executive Summary</p>
          <p className="text-[10px] text-slate-500">Kimi Swarm • Auditor Agent</p>
        </div>
      </div>
      
      {backendSummary ? (
        <div 
          className="leading-relaxed text-[15px] text-slate-200 whitespace-pre-wrap"
          style={{ fontFamily: "inherit" }}
        >
          {backendSummary}
        </div>
      ) : (
        <p className="text-amber-400">
          Moderate compliance issues found. The document can likely proceed with the minor corrections suggested by the Auditor agent.
        </p>
      )}

      {discrepancies.length > 0 && (
        <div className="mt-4 flex gap-3 text-xs">
          <div className="bg-slate-800 rounded-lg px-3 py-1">
            Total Issues: <span className="font-semibold">{discrepancies.length}</span>
          </div>
          {discrepancies.filter(d => d.severity?.toLowerCase() === "critical").length > 0 && (
            <div className="bg-red-950 text-red-400 rounded-lg px-3 py-1">
              Critical: {discrepancies.filter(d => d.severity?.toLowerCase() === "critical").length}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ====================== HELPER COMPONENTS ====================== */
function DiscrepancyCard({ discrepancy, index }: { discrepancy: Discrepancy; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const severityConfig: Record<string, { color: string; icon: string; bg: string }> = {
    critical: { color: "red", icon: "🔴", bg: "bg-red-950/40 border-red-500/30" },
    high: { color: "orange", icon: "🟠", bg: "bg-orange-950/40 border-orange-500/30" },
    medium: { color: "amber", icon: "🟡", bg: "bg-amber-950/40 border-amber-500/30" },
    low: { color: "emerald", icon: "🟢", bg: "bg-emerald-950/30 border-emerald-500/20" },
  };

  const config = severityConfig[discrepancy.severity?.toLowerCase() || "medium"] || severityConfig.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className={`rounded-2xl border p-5 ${config.bg} backdrop-blur-sm`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-1 text-2xl">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full bg-slate-900/80 border border-slate-700">
                {discrepancy.severity || "MEDIUM"}
              </span>
              <span className="font-semibold text-slate-100">{discrepancy.rule_name}</span>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          <p className="text-slate-200 leading-relaxed text-[15px]">
            {discrepancy.message}
          </p>
          {discrepancy.field && (
            <p className="text-xs text-slate-500 mt-1">
              Field: <span className="text-violet-400">{discrepancy.field}</span>
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-slate-700 space-y-4 text-sm"
          >
            {(discrepancy.expected || discrepancy.actual) && (
              <div className="grid grid-cols-2 gap-4">
                {discrepancy.expected && (
                  <div>
                    <p className="text-emerald-400 text-xs font-medium mb-1">✅ EXPECTED</p>
                    <p className="text-slate-300 font-mono text-sm">{discrepancy.expected}</p>
                  </div>
                )}
                {discrepancy.actual && (
                  <div>
                    <p className="text-red-400 text-xs font-medium mb-1">❌ DETECTED</p>
                    <p className="text-slate-300 font-mono text-sm">{discrepancy.actual}</p>
                  </div>
                )}
              </div>
            )}
            {discrepancy.suggested_fix && (
              <div className="bg-slate-900/70 border border-amber-500/30 rounded-xl p-4">
                <p className="text-amber-400 text-xs font-medium mb-2 flex items-center gap-2">
                  💡 RECOMMENDED ACTION
                </p>
                <p className="text-slate-200 leading-relaxed">{discrepancy.suggested_fix}</p>
              </div>
            )}
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