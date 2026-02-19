"use client";

import { useRef, useState } from "react";

export type KBDoc = {
  id: string;
  name: string;
  text: string;
  addedAt: number;
  sizeBytes: number;
};

type Props = {
  docs: KBDoc[];
  primary: string;
  onAdd: (doc: KBDoc) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * 0.52)},${Math.round(g + (255 - g) * 0.52)},${Math.round(b + (255 - b) * 0.52)})`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const MAX_KB_DOCS = 5;

export default function KnowledgeBasePanel({ docs, primary, onAdd, onRemove, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const lightPrimary = lightenColor(primary);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (docs.length >= MAX_KB_DOCS) {
      setUploadError(`Maximum ${MAX_KB_DOCS} documents atteint.`);
      e.target.value = "";
      return;
    }
    setIsParsing(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      let data: { text?: string; name?: string; error?: string };
      try { data = await res.json(); } catch {
        setUploadError(`Erreur serveur (${res.status}). Réessayez.`);
        return;
      }
      if (!res.ok || data.error) {
        setUploadError(data.error ?? `Erreur ${res.status}.`);
      } else if (data.text) {
        const text = data.text;
        const name = data.name ?? file.name;
        onAdd({
          id: `kb-${Date.now()}`,
          name,
          text,
          addedAt: Date.now(),
          sizeBytes: new TextEncoder().encode(text).length,
        });
      } else {
        setUploadError("Le fichier semble vide ou illisible.");
      }
    } catch {
      setUploadError("Impossible de joindre le serveur.");
    } finally {
      setIsParsing(false);
      e.target.value = "";
    }
  };

  const totalSize = docs.reduce((acc, d) => acc + d.sizeBytes, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          zIndex: 50,
          background: "#0d0e18",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.06) transparent",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>📚</span>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", margin: 0 }}>
                Base de connaissances
              </h2>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5 }}>
              Ces documents sont disponibles dans toutes vos conversations.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              width: 30,
              height: 30,
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Upload button */}
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing || docs.length >= MAX_KB_DOCS}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: `1.5px dashed ${docs.length >= MAX_KB_DOCS ? "rgba(255,255,255,0.1)" : hexToRgba(primary, 0.4)}`,
                background: docs.length >= MAX_KB_DOCS ? "rgba(255,255,255,0.03)" : hexToRgba(primary, 0.06),
                color: docs.length >= MAX_KB_DOCS ? "rgba(255,255,255,0.25)" : lightPrimary,
                cursor: docs.length >= MAX_KB_DOCS || isParsing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {isParsing ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                  Traitement en cours…
                </>
              ) : docs.length >= MAX_KB_DOCS ? (
                <>📚 Maximum atteint ({MAX_KB_DOCS} documents)</>
              ) : (
                <>➕ Ajouter un document</>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.csv,.tsv,.xlsx,.xls"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", textAlign: "center", marginTop: 6, marginBottom: 0 }}>
              PDF, TXT, CSV, Excel · Max {MAX_KB_DOCS} documents
            </p>
          </div>

          {/* Error */}
          {uploadError && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
            }}>
              <span style={{ fontSize: 12, color: "#fca5a5" }}>⚠ {uploadError}</span>
              <button
                onClick={() => setUploadError(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 12 }}
              >✕</button>
            </div>
          )}

          {/* Doc list */}
          {docs.length === 0 ? (
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "40px 0",
              color: "rgba(255,255,255,0.2)",
            }}>
              <span style={{ fontSize: 36 }}>📂</span>
              <p style={{ fontSize: 13, margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                Aucun document dans la base.<br />
                Ajoutez des fichiers pour enrichir les réponses.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", margin: 0 }}>
                  Documents ({docs.length}/{MAX_KB_DOCS})
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>
                  {formatSize(totalSize)} total
                </p>
              </div>

              {docs.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: hexToRgba(primary, 0.12),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 16,
                  }}>
                    {doc.name.endsWith(".pdf") ? "📄" :
                     doc.name.endsWith(".csv") || doc.name.endsWith(".xlsx") || doc.name.endsWith(".xls") ? "📊" :
                     "📝"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#e8eaf0",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {doc.name}
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>
                      {formatSize(doc.sizeBytes)} · Ajouté le {formatDate(doc.addedAt)}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => onRemove(doc.id)}
                    title="Supprimer de la base"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.2)",
                      padding: "4px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.12s",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.cssText += "color:rgba(239,68,68,0.8);background:rgba(239,68,68,0.1);")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.cssText += "color:rgba(255,255,255,0.2);background:none;")}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.6, margin: 0 }}>
            💡 Les documents sont stockés localement dans votre navigateur et injectés automatiquement dans chaque conversation.
          </p>
        </div>
      </div>
    </>
  );
}
