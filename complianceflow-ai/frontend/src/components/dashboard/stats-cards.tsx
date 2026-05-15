"use client";

import { motion } from "framer-motion";
import { DashboardStats } from "@/types";
import { FileCheck, AlertTriangle, Clock, TrendingUp, Shield, Zap } from "lucide-react";

interface StatsCardsProps {
  stats: DashboardStats | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return null;

  const cards = [
    {
      title: "Total Documents",
      value: stats.total_documents,
      icon: FileCheck,
      color: "text-blue-400",
      bg: "bg-blue-950/30",
      border: "border-blue-500/20",
    },
    {
      title: "Compliant",
      value: stats.compliant_count,
      icon: Shield,
      color: "text-emerald-400",
      bg: "bg-emerald-950/30",
      border: "border-emerald-500/20",
    },
    {
      title: "Non-Compliant",
      value: stats.non_compliant_count,
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-950/30",
      border: "border-red-500/20",
    },
    {
      title: "Pending",
      value: stats.pending_count,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-950/30",
      border: "border-amber-500/20",
    },
    {
      title: "Compliance Rate",
      value: `${stats.compliance_rate}%`,
      icon: TrendingUp,
      color: "text-violet-400",
      bg: "bg-violet-950/30",
      border: "border-violet-500/20",
    },
    {
      title: "Critical Issues",
      value: stats.critical_issues_count,
      icon: Zap,
      color: "text-orange-400",
      bg: "bg-orange-950/30",
      border: "border-orange-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`rounded-xl border p-4 ${card.bg} ${card.border}`}
        >
          <div className="flex items-center justify-between mb-2">
            <card.icon className={`w-5 h-5 ${card.color}`} />
            <span className={`text-xs font-medium ${card.color} opacity-70`}>
              {card.title}
            </span>
          </div>
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
