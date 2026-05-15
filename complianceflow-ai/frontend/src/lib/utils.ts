import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-400 bg-red-950/50 border-red-500/30";
    case "high": return "text-orange-400 bg-orange-950/50 border-orange-500/30";
    case "medium": return "text-yellow-400 bg-yellow-950/50 border-yellow-500/30";
    case "low": return "text-blue-400 bg-blue-950/50 border-blue-500/30";
    default: return "text-slate-400 bg-slate-800 border-slate-600";
  }
}

export function getAgentColor(agentName: string): string {
  switch (agentName) {
    case "Auditor": return "text-blue-400 border-blue-500";
    case "Negotiator": return "text-amber-400 border-amber-500";
    case "Closer": return "text-emerald-400 border-emerald-500";
    case "Orchestrator": return "text-violet-400 border-violet-500";
    default: return "text-slate-400 border-slate-500";
  }
}

export function getAgentIcon(agentName: string): string {
  switch (agentName) {
    case "Auditor": return "🔍";
    case "Negotiator": return "📝";
    case "Closer": return "🏁";
    case "Orchestrator": return "🧠";
    default: return "⚡";
  }
}
