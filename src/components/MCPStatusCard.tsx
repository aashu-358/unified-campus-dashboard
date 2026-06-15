"use client";

import React, { useEffect, useState } from "react";
import { 
  Server, 
  Terminal, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert,
  ListCollapse
} from "lucide-react";

export function MCPStatusCard() {
  const [statuses, setStatuses] = useState<any>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "";
      const res = await fetch(`${gatewayUrl}/api/mcp-status`);
      const json = await res.json();
      if (json.success) {
        setStatuses(json.statuses);
        setLogs(json.logs);
      }
    } catch (err) {
      console.error("Failed to fetch status/logs:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll status/logs every 4 seconds
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedServer === id) {
      setExpandedServer(null);
    } else {
      setExpandedServer(id);
    }
  };

  return (
    <div className="left-column glass-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Profile Header */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid var(--border-color)",
        background: "rgba(255, 255, 255, 0.01)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            background: "var(--gradient-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1rem"
          }}>
            JD
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>John Doe</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Student ID: stud-101</div>
          </div>
        </div>
      </div>

      {/* MCP Servers Section */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>
        <h3 style={{
          fontSize: "0.8rem",
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <Server style={{ width: "14px", height: "14px", color: "var(--color-secondary)" }} />
          Local MCP Nodes
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {["library", "cafeteria", "events", "academics", "websearch"].map((serverKey) => {
            const stat = statuses[serverKey] || { online: false };
            const isExpanded = expandedServer === serverKey;

            return (
              <div key={serverKey} style={{
                background: "rgba(255, 255, 255, 0.01)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                overflow: "hidden"
              }}>
                <div 
                  onClick={() => toggleExpand(serverKey)}
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`status-indicator ${stat.online ? "status-online" : "status-offline"}`} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "capitalize" }}>
                      {serverKey} Node
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isExpanded ? <ChevronUp style={{ width: "14px", height: "14px" }} /> : <ChevronDown style={{ width: "14px", height: "14px" }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: "8px 12px 12px 12px",
                    borderTop: "1px solid var(--border-color)",
                    background: "rgba(0,0,0,0.1)",
                    fontSize: "0.75rem"
                  }}>
                    {stat.online ? (
                      <div>
                        <div style={{ color: "var(--text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <ListCollapse style={{ width: "12px", height: "12px" }} />
                          <span>Exposed Tools:</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {(stat.tools || []).map((t: any) => (
                            <div key={t.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}>
                              <span style={{ color: "var(--color-secondary)", fontFamily: "monospace" }}>{t.name}()</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: "var(--color-danger)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                        <ShieldAlert style={{ width: "14px", height: "14px", flexShrink: 0, marginTop: "2px" }} />
                        <span>Offline: {stat.error || "Child process initialization failed"}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Developer Log Console */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          background: "rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <Terminal style={{ width: "14px", height: "14px", color: "var(--color-primary)" }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>Observer Terminal</span>
        </div>

        <div style={{
          flex: 1,
          background: "#02040a",
          padding: "12px",
          fontFamily: "monospace",
          fontSize: "0.68rem",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
          {logs.length === 0 ? (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>No logs registered yet. Start chatting to trigger events.</div>
          ) : (
            logs.map((log, index) => {
              let color = "var(--text-secondary)";
              if (log.includes("[ERROR]")) color = "var(--color-danger)";
              else if (log.includes("[WARN]")) color = "var(--color-warning)";
              else if (log.includes("[DEBUG]")) color = "var(--color-secondary)";
              else if (log.includes("Successfully connected")) color = "var(--color-success)";

              return (
                <div key={index} style={{ color, lineBreak: "anywhere" }}>
                  {log}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
