"use client";

import { motion } from "framer-motion";
import { Upload, FileText, ArrowUp } from "lucide-react";

interface EmptyStateProps {
  onUploadClick: () => void;
}

export function EmptyState({ onUploadClick }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8"
    >
      <div className="relative mb-6">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/30 flex items-center justify-center"
        >
          <FileText className="w-10 h-10 text-violet-400" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
        >
          <ArrowUp className="w-4 h-4 text-emerald-400" />
        </motion.div>
      </div>

      <h3 className="text-lg font-semibold text-slate-200 mb-2">
        No Documents Yet
      </h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        Upload your first invoice, contract, or compliance certificate to see the Agent Swarm in action.
      </p>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onUploadClick}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-medium text-sm hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/20"
      >
        <Upload className="w-4 h-4" />
        Upload Document
      </motion.button>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        {[
          { icon: "🔍", label: "Auditor", desc: "Extract & Verify" },
          { icon: "📝", label: "Negotiator", desc: "Draft & Approve" },
          { icon: "🏁", label: "Closer", desc: "Update & Close" },
        ].map((agent) => (
          <div key={agent.label} className="space-y-1">
            <span className="text-2xl">{agent.icon}</span>
            <p className="text-xs font-medium text-slate-300">{agent.label}</p>
            <p className="text-[10px] text-slate-500">{agent.desc}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
