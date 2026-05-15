"use client";

import { motion } from "framer-motion";

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 space-y-4">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 animate-pulse" />
          <div className="space-y-1">
            <div className="w-32 h-4 rounded bg-slate-800 animate-pulse" />
            <div className="w-24 h-3 rounded bg-slate-800 animate-pulse" />
          </div>
        </div>
        <div className="w-24 h-6 rounded-full bg-slate-800 animate-pulse" />
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-5 h-5 rounded bg-slate-800 animate-pulse" />
              <div className="w-16 h-3 rounded bg-slate-800 animate-pulse" />
            </div>
            <div className="w-12 h-8 rounded bg-slate-800 animate-pulse" />
          </motion.div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 h-64">
            <div className="w-32 h-4 rounded bg-slate-800 animate-pulse mb-4" />
            <div className="w-full h-32 rounded-lg bg-slate-800 animate-pulse" />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 h-80">
            <div className="w-32 h-4 rounded bg-slate-800 animate-pulse mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-full h-12 rounded bg-slate-800 animate-pulse mb-2" />
            ))}
          </div>
        </div>

        {/* Center Column */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="w-40 h-4 rounded bg-slate-800 animate-pulse mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-full h-16 rounded bg-slate-800 animate-pulse mb-3" />
          ))}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="w-32 h-4 rounded bg-slate-800 animate-pulse mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-full h-20 rounded bg-slate-800 animate-pulse mb-3" />
          ))}
        </div>
      </div>
    </div>
  );
}
