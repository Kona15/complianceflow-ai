"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

const ToastContext = createContext<{
  toast: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setToasts((prev) => prev.slice(1));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${
            toast.variant === "destructive"
              ? "border-red-500/50 bg-red-950/90 text-red-100"
              : toast.variant === "success"
              ? "border-emerald-500/50 bg-emerald-950/90 text-emerald-100"
              : "border-slate-700 bg-slate-900/90 text-slate-100"
          }`}
        >
          <p className="font-medium">{toast.title}</p>
          {toast.description && (
            <p className="text-sm opacity-80">{toast.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  return { toast };
}
