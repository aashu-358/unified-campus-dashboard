"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, ArrowRight, Sparkles, AlertCircle, PlayCircle, CheckCircle, RefreshCw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ToolLog {
  id: string;
  serverId: string;
  toolName: string;
  args: any;
  status: "running" | "completed" | "failed";
  result?: any;
}

export function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am your Unified Campus Assistant. I can dynamically pull information from our Campus Library, Cafeteria menu feeds, Club events, or Academic directories.\n\nAsk me questions like:\n- *What is for lunch on Monday at the Dining Hall?*\n- *Is the book Clean Code available to reserve?*\n- *When is the final exam for CS-101 and who teaches it?*" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, toolLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setToolLogs([]);

    // Initialize blank assistant response to stream into
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "";
      const response = await fetch(`${gatewayUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(1), // Exclude the initial assistant welcome greeting
        }),
      });

      if (!response.body) {
        throw new Error("No response body stream found.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.trim() === "") continue;
          
          const lines = part.split("\n");
          let eventName = "";
          let eventData = null;

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7);
            } else if (line.startsWith("data: ")) {
              try {
                eventData = JSON.parse(line.slice(6));
              } catch (e) {
                // Ignore invalid parses
              }
            }
          }

          if (eventName === "text" && eventData) {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") {
                last.content += eventData;
              }
              return updated;
            });
          } else if (eventName === "tool-start" && eventData) {
            const newLog: ToolLog = {
              id: `${eventData.toolName}-${Date.now()}`,
              serverId: eventData.serverId,
              toolName: eventData.toolName,
              args: eventData.args,
              status: "running"
            };
            setToolLogs(prev => [...prev, newLog]);
          } else if (eventName === "tool-end" && eventData) {
            setToolLogs(prev => {
              return prev.map(log => {
                if (log.toolName === eventData.toolName && log.status === "running") {
                  return { ...log, status: "completed", result: eventData.result };
                }
                return log;
              });
            });
          } else if (eventName === "error" && eventData) {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") {
                last.content += `\n\n*(Error: ${eventData})*`;
              }
              return updated;
            });
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          last.content = `Sorry, I encountered an error linking to the campus services: ${err.message}`;
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const formatMessageContent = (content: string) => {
    if (!content) return <span style={{ color: "var(--text-muted)" }}>Thinking...</span>;

    const paragraphs = content.split("\n\n");
    return paragraphs.map((p, pIdx) => {
      // JSON or Code blocks
      if (p.startsWith("```")) {
        const lines = p.split("\n");
        const code = lines.slice(1).filter(l => !l.startsWith("```")).join("\n");
        return (
          <pre key={pIdx} style={{
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid var(--border-color)",
            padding: "12px",
            borderRadius: "6px",
            fontFamily: "monospace",
            fontSize: "0.78rem",
            overflowX: "auto",
            margin: "10px 0"
          }}>
            <code>{code}</code>
          </pre>
        );
      }

      // Unordered lists
      if (p.startsWith("- ") || p.startsWith("* ")) {
        const items = p.split("\n").map(li => li.replace(/^[-*]\s+/, ""));
        return (
          <ul key={pIdx} style={{ paddingLeft: "18px", margin: "8px 0" }}>
            {items.map((item, idx) => (
              <li key={idx} style={{ fontSize: "0.85rem", marginBottom: "4px", lineHeight: "1.4" }}>
                {formatInline(item)}
              </li>
            ))}
          </ul>
        );
      }

      return (
        <p key={pIdx} style={{ fontSize: "0.85rem", lineHeight: "1.5", marginBottom: "8px" }}>
          {formatInline(p)}
        </p>
      );
    });
  };

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} style={{ color: "#fff" }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={idx} style={{
          background: "rgba(255, 255, 255, 0.08)",
          padding: "2px 6px",
          borderRadius: "4px",
          fontFamily: "monospace",
          fontSize: "0.85em",
          color: "var(--color-secondary)"
        }}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "rgba(10, 15, 32, 0.4)",
      border: "1px solid var(--border-color)",
      borderRadius: "12px",
      overflow: "hidden",
      boxShadow: "var(--shadow-lg)"
    }}>
      {/* Assistant Title Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border-color)",
        background: "rgba(255, 255, 255, 0.01)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles style={{ width: "18px", height: "18px", color: "var(--color-primary)" }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700 }}>
            Campus Intelligence Assistant
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-success)" }} />
          <span>Model Context Protocol Enabled</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div style={{
        flex: 1,
        padding: "20px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
        {messages.map((msg, index) => (
          <div 
            key={index}
            className="animate-slide-up"
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              width: "100%"
            }}
          >
            <div style={{
              maxWidth: "80%",
              padding: "12px 16px",
              borderRadius: "12px",
              border: msg.role === "user" ? "none" : "1px solid var(--border-color)",
              background: msg.role === "user" ? "var(--gradient-brand)" : "rgba(255, 255, 255, 0.02)",
              color: msg.role === "user" ? "#fff" : "var(--text-primary)",
              boxShadow: msg.role === "user" ? "0 4px 15px -3px rgba(139, 92, 246, 0.3)" : "none"
            }}>
              {msg.role === "assistant" ? formatMessageContent(msg.content) : (
                <p style={{ fontSize: "0.85rem", lineHeight: "1.5" }}>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Dynamic Tool Executions Panel */}
        {toolLogs.length > 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid var(--border-glow)",
            borderRadius: "8px",
            padding: "12px",
            margin: "8px 0"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--color-secondary)", fontWeight: 600 }}>
              <PlayCircle style={{ width: "14px", height: "14px" }} />
              Live Gateway Tool Orchestration:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {toolLogs.map(log => (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.7rem" }}>
                  {log.status === "running" ? (
                    <RefreshCw className="animate-spin" style={{ width: "12px", height: "12px", color: "var(--color-secondary)" }} />
                  ) : (
                    <CheckCircle style={{ width: "12px", height: "12px", color: "var(--color-success)" }} />
                  )}
                  <span style={{ color: "var(--text-secondary)" }}>
                    Querying <strong>{log.serverId}</strong> server via <code>{log.toolName}({JSON.stringify(log.args)})</code>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message Input Spacer */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar Form */}
      <form 
        onSubmit={handleSubmit}
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border-color)",
          background: "rgba(0, 0, 0, 0.2)",
          display: "flex",
          gap: "10px"
        }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          placeholder={loading ? "Waiting for gateway responses..." : "Ask the AI Assistant about campus info..."}
          className="input-glass"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-brand"
          style={{ padding: "10px 16px" }}
        >
          <Send style={{ width: "14px", height: "14px" }} />
        </button>
      </form>
    </div>
  );
}
