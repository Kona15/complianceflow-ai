"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase } from "@/components/ui/supabase-provider";
import { AgentThoughtStream } from "@/components/agents/agent-thought-stream";
import { DocumentUpload } from "@/components/dashboard/document-upload";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { JobDetailPanel } from "@/components/dashboard/job-detail-panel";
import { LoadingSkeleton } from "@/components/dashboard/loading-skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ComplianceJob, AgentEvent, DashboardStats } from "@/types";
import { getDashboardStats, listJobs, getJobEvents } from "@/lib/api";
import { useToast } from "@/components/ui/toaster";
import { useAgentWebSocket } from "@/hooks/use-agent-websocket";
import {
  Shield,
  FileText,
  Activity,
  LayoutDashboard,
  ChevronRight,
  RefreshCw,
  LogOut,
  User,
} from "lucide-react";

export default function DashboardPage() {
  const supabase = useSupabase();
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobs, setJobs] = useState<ComplianceJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ComplianceJob | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [user, setUser] = useState<any>(null);

  // WebSocket hook for live agent thoughts
  const { events: wsEvents, connected: wsConnected } = useAgentWebSocket(activeJobId);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, [supabase]);

  // Load initial data
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, jobsData] = await Promise.all([
        getDashboardStats(),
        listJobs(undefined, 20, 0),
      ]);
      setStats(statsData);
      setJobs(jobsData.jobs);

      // If a job is currently selected, refresh it from the latest jobs list
      if (selectedJob) {
        const refreshed = jobsData.jobs.find((j) => j.id === selectedJob.id);
        if (refreshed) setSelectedJob(refreshed);
      }
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Merge WebSocket events with historical events
  useEffect(() => {
    if (wsEvents.length > 0) {
      setAgentEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = wsEvents.filter((e) => !existingIds.has(e.id));
        return [...prev, ...newEvents];
      });
    }
  }, [wsEvents]);

  // Load historical events when job selected
  useEffect(() => {
    if (!selectedJob) {
      setAgentEvents([]);
      return;
    }

    const loadEvents = async () => {
      try {
        const data = await getJobEvents(selectedJob.id);
        setAgentEvents(data.events || []);
      } catch (e) {
        console.error("Failed to load events:", e);
      }
    };
    loadEvents();
  }, [selectedJob]);

  const handleUploadComplete = useCallback(async (jobId: string) => {
  setActiveJobId(jobId);
  setShowUpload(false);

  try {
    const [statsData, jobsData] = await Promise.all([
      getDashboardStats(),
      listJobs(undefined, 20, 0),
    ]);

    setStats(statsData);
    setJobs(jobsData.jobs);

    // AUTO-SELECT NEWLY UPLOADED JOB
    const newJob = jobsData.jobs.find((job) => job.id === jobId);

    if (newJob) {
      setSelectedJob(newJob);
    }

    toast({
      title: "Processing Started",
      description: `Job ${jobId.slice(0, 8)} is being analyzed by the Agent Swarm`,
      variant: "success",
    });

  } catch (error: any) {
    toast({
      title: "Upload Error",
      description: error.message,
      variant: "destructive",
    });
  }
}, []);

  const handleJobSelect = (job: ComplianceJob) => {
    setSelectedJob(job);
    setActiveJobId(job.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("supabase_access_token");
    window.location.href = "/auth";
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">ComplianceFlow AI</h1>
              <p className="text-[10px] text-slate-500">Agentic Document Verification</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2 py-1 rounded-full bg-violet-950/50 text-violet-400 border border-violet-500/20">
              Kimi K2.6 Swarm
            </span>
            <button
              onClick={loadData}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto p-4 space-y-4">
        {/* Stats Row */}
        <StatsCards stats={stats} />

        {/* Three-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
          {/* Left: Upload + Job List */}
          <div className="lg:col-span-3 space-y-4">
            {/* Upload Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold">Upload Document</h2>
              </div>
              <DocumentUpload onUploadComplete={handleUploadComplete} />
            </div>

            {/* Job List */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-semibold">Recent Jobs</h2>
                </div>
                <span className="text-[10px] text-slate-500">{jobs.length} total</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                {jobs.length === 0 ? (
                  <div className="p-4">
                    <EmptyState onUploadClick={() => setShowUpload(true)} />
                  </div>
                ) : (
                  jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => handleJobSelect(job)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${
                        selectedJob?.id === job.id
                          ? "bg-slate-800/80 border-l-2 border-l-violet-500"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-300 truncate pr-2">
                          {job.document_name}
                        </p>
                        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={job.status} />
                        <span className="text-[10px] text-slate-600">
                          {formatDate(job.created_at)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Center: Agent Thought Stream */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col">
            <AgentThoughtStream
              jobId={activeJobId || ""}
              events={agentEvents}
              isConnected={wsConnected}
            />
          </div>

          {/* Right: Job Detail Panel */}
          <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col">
            <JobDetailPanel job={selectedJob} />
          </div>
        </div>
      </main>
    </div>
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
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
        colors[status] || colors.pending
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
