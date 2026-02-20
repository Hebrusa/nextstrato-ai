"use client";

import { DocFile } from "./DataVizModal";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type AgentInfo = { id: string; name: string };

type Props = {
  agents: AgentInfo[];
  activeAgentId: string | null;
  agentDocs: Record<string, DocFile[]>;
  primary: string;
  isUploading: boolean;
  uploadError: string | null;
  onUpload: () => void;
  onRemove: (agentId: string, index: number) => void;
  onClearError: () => void;
  onAnalyze: () => void;
  onClose: () => void;
};

export default function AgentDocPanel({
  agents, activeAgentId, agentDocs, primary, isUploading, uploadError,
  onUpload, onRemove, onClearError, onAnalyze, onClose,
}: Props) {
  const hasAnyDoc = agents.some((a) => (agentDocs[a.id] ?? []).length > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 280,
        display: "flex", flexDirection: "column",
        borderLeft: "1px solid #E4E4EF",
        background: "#FFFFFF",
        zIndex: 41,
        boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
      }}>

        {/* Header */}
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #E4E4EF", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#71718A", margin: 0 }}>
            Répertoire de fichiers
          </p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#0F0F18"; e.currentTarget.style.background = "#F5F5FA"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(0,0,0,0.3)"; e.currentTarget.style.background = "none"; }}
          >
            ✕
          </button>
        </div>

        {/* Agent sections */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.08) transparent" }}>
          {agents.map((agent) => {
            const docs = agentDocs[agent.id] ?? [];
            const isActive = agent.id === activeAgentId;

            return (
              <div key={agent.id}>
                {/* Agent row */}
                <div style={{
                  padding: "9px 12px 9px 11px",
                  borderLeft: `3px solid ${isActive ? primary : "transparent"}`,
                  background: isActive ? hexToRgba(primary, 0.04) : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? primary : "#71718A" }}>
                      {agent.name}
                    </span>
                    {docs.length > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "0 5px", lineHeight: "16px", borderRadius: 10,
                        background: isActive ? hexToRgba(primary, 0.1) : "#F5F5FA",
                        color: isActive ? primary : "#71718A",
                      }}>
                        {docs.length}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <button
                      onClick={onUpload}
                      disabled={isUploading || docs.length >= 5}
                      title={docs.length >= 5 ? "5 fichiers maximum" : "Ajouter un fichier (CSV, Excel, PDF…)"}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: `1px solid ${hexToRgba(primary, 0.3)}`,
                        background: hexToRgba(primary, 0.06),
                        color: primary, fontSize: 14, lineHeight: 1,
                        cursor: docs.length >= 5 || isUploading ? "not-allowed" : "pointer",
                        opacity: docs.length >= 5 ? 0.4 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      {isUploading ? "…" : "+"}
                    </button>
                  )}
                </div>

                {/* File list */}
                {docs.length > 0 && (
                  <div style={{ padding: "2px 10px 6px" }}>
                    {docs.map((doc, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "5px 8px", borderRadius: 7, marginBottom: 3,
                        background: "#F5F5FA", border: "1px solid #E4E4EF",
                      }}>
                        <span style={{ fontSize: 12, flexShrink: 0 }}>📄</span>
                        <span style={{
                          flex: 1, fontSize: 11, color: "#0F0F18",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {doc.name}
                        </span>
                        <button
                          onClick={() => onRemove(agent.id, i)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,0,0,0.28)", padding: 0, lineHeight: 1, fontSize: 12, flexShrink: 0 }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(0,0,0,0.28)"; }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions for active agent with docs */}
                {isActive && docs.length > 0 && (
                  <div style={{ padding: "2px 10px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <button
                      onClick={onAnalyze}
                      style={{
                        width: "100%", padding: "7px 10px", borderRadius: 7, textAlign: "left",
                        border: `1px solid ${hexToRgba(primary, 0.3)}`,
                        background: hexToRgba(primary, 0.06),
                        color: primary, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(primary, 0.12); }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(primary, 0.06); }}
                    >
                      📊 Analyser les données
                    </button>
                  </div>
                )}

                <div style={{ margin: "0 10px", borderTop: "1px solid #E4E4EF" }} />
              </div>
            );
          })}

          {/* Empty state */}
          {!hasAnyDoc && (
            <div style={{ padding: "28px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 36, margin: "0 0 12px" }}>📁</p>
              <p style={{ fontSize: 11, color: "#71718A", lineHeight: 1.7, margin: 0 }}>
                Sélectionnez un agent<br />et ajoutez vos fichiers<br />pour commencer l&apos;analyse.
              </p>
            </div>
          )}
        </div>

        {/* Upload error */}
        {uploadError && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid #E4E4EF", background: "rgba(239,68,68,0.04)", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#dc2626", margin: "0 0 4px" }}>⚠ {uploadError}</p>
            <button onClick={onClearError} style={{ fontSize: 10, color: "#71718A", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Fermer</button>
          </div>
        )}
      </aside>
    </>
  );
}
