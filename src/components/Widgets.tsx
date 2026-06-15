"use client";

import React, { useEffect, useState } from "react";
import { 
  Utensils, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  Clock, 
  MapPin, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  BookMarked
} from "lucide-react";

export function Widgets() {
  const [activeTab, setActiveTab] = useState<"cafeteria" | "events" | "academics">("cafeteria");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "";
      const res = await fetch(`${gatewayUrl}/api/widgets`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to fetch campus metrics");
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact widgets gateway");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <aside className="right-column glass-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Widget Header */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255, 255, 255, 0.01)"
      }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
          <RefreshCw className={loading ? "animate-spin" : ""} style={{ width: "16px", height: "16px", color: "var(--color-secondary)" }} />
          Campus Live Feeds
        </h2>
        <button 
          onClick={fetchData} 
          disabled={loading}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center"
          }}
          title="Refresh Data"
        >
          <RefreshCw style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* Tabs Selector */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-color)",
        background: "rgba(0, 0, 0, 0.2)"
      }}>
        <button
          onClick={() => setActiveTab("cafeteria")}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: activeTab === "cafeteria" ? "rgba(255,255,255,0.05)" : "transparent",
            color: activeTab === "cafeteria" ? "var(--color-secondary)" : "var(--text-secondary)",
            borderBottom: activeTab === "cafeteria" ? "2px solid var(--color-secondary)" : "none",
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <Utensils style={{ width: "14px", height: "14px" }} />
          Cafeteria
        </button>
        <button
          onClick={() => setActiveTab("events")}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: activeTab === "events" ? "rgba(255,255,255,0.05)" : "transparent",
            color: activeTab === "events" ? "var(--color-primary)" : "var(--text-secondary)",
            borderBottom: activeTab === "events" ? "2px solid var(--color-primary)" : "none",
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <Calendar style={{ width: "14px", height: "14px" }} />
          Events
        </button>
        <button
          onClick={() => setActiveTab("academics")}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: activeTab === "academics" ? "rgba(255,255,255,0.05)" : "transparent",
            color: activeTab === "academics" ? "var(--color-accent)" : "var(--text-secondary)",
            borderBottom: activeTab === "academics" ? "2px solid var(--color-accent)" : "none",
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <GraduationCap style={{ width: "14px", height: "14px" }} />
          Academics
        </button>
      </div>

      {/* Tab Contents Area */}
      <div style={{ flex: 1, padding: "16px", overflowY: "auto", position: "relative" }}>
        {loading && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "12px",
            color: "var(--text-secondary)"
          }}>
            <RefreshCw className="animate-spin" style={{ width: "24px", height: "24px", color: "var(--color-accent)" }} />
            <span style={{ fontSize: "0.85rem" }}>Polling live servers...</span>
          </div>
        )}

        {!loading && error && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "10px",
            padding: "20px",
            textAlign: "center"
          }}>
            <AlertCircle style={{ width: "28px", height: "28px", color: "var(--color-danger)" }} />
            <span style={{ fontSize: "0.85rem", color: "var(--color-danger)" }}>Gateway Sync Offline</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{error}</span>
          </div>
        )}

        {!loading && !error && data && (
          <div className="animate-fade-in">
            {/* 1. Cafeteria View */}
            {activeTab === "cafeteria" && (
              <div>
                {data.cafeteria.error ? (
                  <div style={{ display: "flex", gap: "8px", color: "var(--color-danger)", fontSize: "0.8rem", padding: "12px", background: "rgba(239, 68, 68, 0.05)", borderRadius: "6px" }}>
                    <AlertCircle style={{ flexShrink: 0, width: "16px", height: "16px" }} />
                    <span>{data.cafeteria.error}</span>
                  </div>
                ) : (
                  <div>
                    {/* Crowd Monitor Card */}
                    <div style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "16px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Main Hall Crowd Level</span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: data.cafeteria.busyStatus === "High" ? "var(--color-danger)" : "var(--color-success)" }}>
                          {data.cafeteria.busyStatus}
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden", marginBottom: "10px" }}>
                        <div style={{
                          height: "100%",
                          width: data.cafeteria.busyStatus === "High" ? "85%" : data.cafeteria.busyStatus === "Medium" ? "50%" : "20%",
                          background: data.cafeteria.busyStatus === "High" ? "var(--color-danger)" : "var(--color-success)"
                        }}></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        <Clock style={{ width: "12px", height: "12px" }} />
                        <span>Est. checkout wait: <strong>{data.cafeteria.waitTimeMinutes} mins</strong></span>
                      </div>
                    </div>

                    {/* Today's Special */}
                    <h3 style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "10px", fontFamily: "var(--font-display)" }}>
                      Today's Specials (Lunch)
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(data.cafeteria.items || []).map((item: any) => (
                        <div key={item.id} style={{
                          background: "rgba(255, 255, 255, 0.01)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start"
                        }}>
                          <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{item.name}</div>
                            <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                              {item.dietary.map((tag: string) => (
                                <span key={tag} style={{
                                  fontSize: "0.65rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: tag.toLowerCase().includes("vegan") ? "rgba(16, 185, 129, 0.1)" : "rgba(6, 182, 212, 0.1)",
                                  color: tag.toLowerCase().includes("vegan") ? "var(--color-success)" : "var(--color-secondary)"
                                }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span style={{ fontSize: "0.85rem", color: "var(--color-secondary)", fontWeight: 600 }}>
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Events View */}
            {activeTab === "events" && (
              <div>
                {data.events.error ? (
                  <div style={{ display: "flex", gap: "8px", color: "var(--color-danger)", fontSize: "0.8rem", padding: "12px", background: "rgba(239, 68, 68, 0.05)", borderRadius: "6px" }}>
                    <AlertCircle style={{ flexShrink: 0, width: "16px", height: "16px" }} />
                    <span>{data.events.error}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {(data.events || []).map((ev: any) => (
                      <div key={ev.id} style={{
                        background: "rgba(255, 255, 255, 0.01)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "12px",
                        position: "relative"
                      }}>
                        <span style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          fontSize: "0.65rem",
                          background: "rgba(139, 92, 246, 0.1)",
                          color: "var(--color-primary)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: 500
                        }}>
                          {ev.category}
                        </span>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: 600, paddingRight: "70px", marginBottom: "6px" }}>
                          {ev.title}
                        </h4>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px", lineBreak: "anywhere" }}>
                          {ev.description}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Calendar style={{ width: "12px", height: "12px" }} />
                            <span>{ev.date} @ {ev.time.split(" - ")[0]}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <MapPin style={{ width: "12px", height: "12px" }} />
                            <span>{ev.location}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Academics & Library View */}
            {activeTab === "academics" && (
              <div>
                {/* Courses Widget */}
                {data.academics.error ? (
                  <div style={{ display: "flex", gap: "8px", color: "var(--color-danger)", fontSize: "0.8rem", padding: "12px", background: "rgba(239, 68, 68, 0.05)", borderRadius: "6px", marginBottom: "16px" }}>
                    <AlertCircle style={{ flexShrink: 0, width: "16px", height: "16px" }} />
                    <span>{data.academics.error}</span>
                  </div>
                ) : (
                  <div style={{ marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <BookOpen style={{ width: "14px", height: "14px", color: "var(--color-accent)" }} />
                      Highlighted Courses
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(data.academics || []).slice(0, 2).map((course: any) => (
                        <div key={course.code} style={{
                          background: "rgba(255, 255, 255, 0.01)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "10px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>{course.code}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{course.credits} Credits</span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{course.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Library Books Widget */}
                {data.library.error ? (
                  <div style={{ display: "flex", gap: "8px", color: "var(--color-danger)", fontSize: "0.8rem", padding: "12px", background: "rgba(239, 68, 68, 0.05)", borderRadius: "6px" }}>
                    <AlertCircle style={{ flexShrink: 0, width: "16px", height: "16px" }} />
                    <span>{data.library.error}</span>
                  </div>
                ) : (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <BookMarked style={{ width: "14px", height: "14px", color: "var(--color-secondary)" }} />
                      Library Spotlight
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(data.library || []).slice(0, 2).map((book: any) => (
                        <div key={book.isbn} style={{
                          background: "rgba(255, 255, 255, 0.01)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "10px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>{book.title}</span>
                            <span style={{
                              fontSize: "0.65rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              flexShrink: 0,
                              background: book.availability.status === "Available" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              color: book.availability.status === "Available" ? "var(--color-success)" : "var(--color-danger)"
                            }}>
                              {book.availability.status}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "4px" }}>by {book.author}</div>
                          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin style={{ width: "10px", height: "10px" }} />
                            <span>{book.availability.location}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
