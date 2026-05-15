"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentEvent } from "@/types";
import { getAgentColor, getAgentIcon, formatDate } from "@/lib/utils";
import { Activity, Zap, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface AgentThoughtStreamProps {
  jobId: string;
  events: AgentEvent[];
  isConnected: boolean;
}

export function AgentThoughtStream({ jobId, events, isConnected }: AgentThoughtStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(["Orchestrator"]));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const toggleAgent = (agentName: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentName)) {
        next.delete(agentName);
      } else {
        next.add(agentName);
      }
      return next;
    });
  };

  const agentEvents = events.filter((e) => e.agent_name !== "System");
  const groupedByAgent = agentEvents.reduce((acc, event) => {
    if (!acc[event.agent_name]) acc[event.agent_name] = [];
    acc[event.agent_name].push(event);
    return acc;
  }, {} as Record<string, AgentEvent[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-slate-200">Agent Thought Process</h3>
          <span className="text-xs text-slate-500 font-mono">{jobId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Agent Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        <AnimatePresence>
          {Object.entries(groupedByAgent).map(([agentName, agentEvents]) => (
            <motion.div
              key={agentName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`rounded-lg border bg-slate-900/40 overflow-hidden ${getAgentColor(agentName)}`}
            >
              {/* Agent Header */}
              <button
                onClick={() => toggleAgent(agentName)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getAgentIcon(agentName)}</span>
                  <span className="text-sm font-medium">{agentName} Agent</span>
                  <span className="text-xs text-slate-500">
                    {agentEvents.length} events
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {agentEvents.some((e) => e.event_type === "result") && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                  {agentEvents.some((e) => e.event_type === "error") && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  {!agentEvents.some((e) => e.event_type === "result") && (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  )}
                </div>
              </button>

              {/* Agent Events */}
              <AnimatePresence>
                {expandedAgents.has(agentName) && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-2 space-y-1">
                      {agentEvents.map((event, idx) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-start gap-2 py-1.5 px-2 rounded bg-slate-950/50 text-xs"
                        >
                          <EventTypeIcon type={event.event_type} />
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300 leading-relaxed">
                              {event.payload.message}
                            </p>
                            {event.payload.discrepancy_count !== undefined && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-red-950/50 text-red-400 text-[10px]">
                                {event.payload.discrepancy_count} discrepancies
                              </span>
                            )}
                            {event.payload.confidence !== undefined && (
                              <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 text-[10px]">
                                Confidence: {Math.round(event.payload.confidence * 100)}%
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-600 shrink-0">
                            {formatDate(event.timestamp)}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {agentEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <Zap className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Waiting for agent activity...</p>
            <p className="text-xs mt-1">Upload a document to see the swarm in action</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "thought":
      return <span className="text-slate-500 shrink-0">💭</span>;
    case "action":
      return <span className="text-blue-400 shrink-0">⚡</span>;
    case "result":
      return <span className="text-emerald-400 shrink-0">✓</span>;
    case "error":
      return <span className="text-red-400 shrink-0">✗</span>;
    case "handoff":
      return <span className="text-violet-400 shrink-0">→</span>;
    default:
      return <span className="text-slate-500 shrink-0">•</span>;
  }
}
