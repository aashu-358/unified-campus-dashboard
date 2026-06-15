"use client";

import React from "react";
import { MCPStatusCard } from "@/components/MCPStatusCard";
import { AssistantPanel } from "@/components/AssistantPanel";
import { Widgets } from "@/components/Widgets";
import { Sparkles, CalendarRange, Bell, Search } from "lucide-react";

export default function Home() {
  const systemTime = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Brand Header */}
      <header style={{
        height: "64px",
        padding: "0 24px",
        borderBottom: "1px solid var(--border-color)",
        background: "rgba(10, 15, 32, 0.5)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0
      }}>
        {/* Logo and Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "var(--gradient-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px -2px rgba(139, 92, 246, 0.4)"
          }}>
            <Sparkles style={{ width: "16px", height: "16px", color: "#fff" }} />
          </div>
          <div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.05rem",
              fontWeight: 700,
              letterSpacing: "-0.01em"
            }}>
              Unified Campus Intelligence Hub
            </h1>
            <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: "1px" }}>
              Dynamic MCP AI Orchestration Platform
            </div>
          </div>
        </div>

        {/* System Time and Center Details */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Time Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-color)",
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "0.75rem",
            color: "var(--text-secondary)"
          }}>
            <CalendarRange style={{ width: "12px", height: "12px", color: "var(--color-secondary)" }} />
            <span>{systemTime}</span>
          </div>

          {/* Quick Notification Bell */}
          <button style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-color)",
            padding: "8px",
            borderRadius: "6px",
            cursor: "pointer",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center"
          }}>
            <Bell style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </header>

      {/* Grid Dashboard Workspace */}
      <main className="dashboard-grid">
        <MCPStatusCard />
        <AssistantPanel />
        <Widgets />
      </main>
    </div>
  );
}
