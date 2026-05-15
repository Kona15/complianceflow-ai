"use client";

import { useState } from "react";
import { useSupabase } from "@/components/ui/supabase-provider";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          localStorage.setItem("supabase_access_token", data.session.access_token);
          router.push("/");
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          localStorage.setItem("supabase_access_token", data.session.access_token);
          router.push("/");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">ComplianceFlow AI</h1>
          <p className="text-sm text-slate-400">Agentic Document Verification</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="flex mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                isLogin ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-300"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                !isLogin ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-300"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-xs text-red-400"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white font-medium text-sm hover:from-violet-500 hover:to-blue-500 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isLogin ? "Sign In" : "Create Account"}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { icon: "🔍", label: "Auditor Agent" },
            { icon: "📝", label: "Negotiator Agent" },
            { icon: "🏁", label: "Closer Agent" },
          ].map((feature) => (
            <div key={feature.label} className="text-center p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-2xl">{feature.icon}</span>
              <p className="text-[10px] text-slate-400 mt-1">{feature.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
