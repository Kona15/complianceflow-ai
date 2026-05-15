"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AgentEvent } from "@/types";

export function useAgentWebSocket(jobId: string | null) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws")}/ws/agents/${jobId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[WS] Connected to agent stream:", jobId);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event_type === "connection") return;

      setEvents((prev) => {
        if (prev.some((e) => e.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("[WS] Disconnected");
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      setConnected(false);
    };

    // Ping every 30s
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
  }, [jobId]);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (jobId) {
      connect();
      return () => disconnect();
    }
  }, [jobId, connect, disconnect]);

  return { events, connected, clearEvents, disconnect };
}
