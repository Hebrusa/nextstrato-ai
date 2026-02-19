"use client";

import { useRef, useState, useCallback } from "react";

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

/* ── Google Drive Picker hook ── */
function useGoogleDrivePicker(onFilePicked: (file: File) => void) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  const [isLoading, setIsLoading] = useState(false);
  const [gdError, setGdError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const pickerReadyRef = useRef(false);

  const loadScript = (src: string): Promise<void> =>
    new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });

  const openPicker = useCallback(async () => {
    if (!apiKey || !clientId) {
      setGdError("Configurez NEXT_PUBLIC_GOOGLE_API_KEY et NEXT_PUBLIC_GOOGLE_CLIENT_ID dans .env.local");
      return;
    }
    setIsLoading(true);
    setGdError(null);
    try {
      await loadScript("https://apis.google.com/js/api.js");
      await loadScript("https://accounts.google.com/gsi/client");

      // Load Picker library once
      if (!pickerReadyRef.current) {
        await new Promise<void>((resolve) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).gapi.load("picker", () => { pickerReadyRef.current = true; resolve(); })
        );
      }

      // Obtain OAuth token if not already available
      if (!tokenRef.current) {
        await new Promise<void>((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tc = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/drive.readonly",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            callback: (resp: any) => {
              if (resp.error) { reject(new Error(resp.error)); return; }
              tokenRef.current = resp.access_token;
              // Clear token a minute before expiry
              setTimeout(() => { tokenRef.current = null; }, (resp.expires_in - 60) * 1000);
              resolve();
            },
          });
          tc.requestAccessToken({ prompt: "" });
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      const MIME_TYPES = [
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/vnd.google-apps.document",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ].join(",");

      new google.picker.PickerBuilder()
        .addView(
          new google.picker.DocsView()
            .setIncludeFolders(false)
            .setMimeTypes(MIME_TYPES)
        )
        .setOAuthToken(tokenRef.current!)
        .setDeveloperKey(apiKey)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .setCallback(async (data: any) => {
          if (data.action !== google.picker.Action.PICKED) return;
          const doc = data.docs[0];
          const { id: fileId, name: fileName, mimeType } = doc;

          // Google Docs → export as plain text; everything else → download binary
          const isGDoc = mimeType === "application/vnd.google-apps.document";
          const fetchUrl = isGDoc
            ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
            : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

          const resp = await fetch(fetchUrl, {
            headers: { Authorization: `Bearer ${tokenRef.current}` },
          });
          if (!resp.ok) { setGdError("Erreur lors du téléchargement depuis Google Drive."); return; }

          const blob = await resp.blob();
          const finalName = isGDoc ? `${fileName}.txt` : fileName;
          const fileMime = isGDoc ? "text/plain" : mimeType;
          onFilePicked(new File([blob], finalName, { type: fileMime }));
        })
        .build()
        .setVisible(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur Google Drive";
      // "popup_closed_by_user" is not an error — user just closed the window
      if (msg !== "popup_closed_by_user") setGdError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, clientId, onFilePicked]);

  const isConfigured = !!(apiKey && clientId);
  return { openPicker, isLoading: isLoading, gdError, isConfigured };
}

/* ── Main component ── */
export default function KnowledgeBasePanel({ docs, primary, onAdd, onRemove, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const lightPrimary = lightenColor(primary);
  const isFull = docs.length >= MAX_KB_DOCS;

  /* ── Parse a File object and add it to the KB ── */
  const parseAndAddFile = useCallback(async (file: File) => {
    if (isFull) { setUploadError(`Maximum ${MAX_KB_DOCS} documents atteint.`); return; }
    setIsParsing(true);
    setUploadError(null);
    try {
      // Plain text / CSV: read directly without hitting the API
      if (file.type === "text/plain" || file.type === "text/csv" || file.name.endsWith(".txt") || file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
        const text = await file.text();
        if (!text.trim()) { setUploadError("Le fichier semble vide."); return; }
        onAdd({
          id: `kb-${Date.now()}`,
          name: file.name,
          text,
          addedAt: Date.now(),
          sizeBytes: new TextEncoder().encode(text).length,
        });
        return;
      }

      // PDF, Excel, DOCX → server-side parsing
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      let data: { text?: string; name?: string; error?: string };
      try { data = await res.json(); } catch {
        setUploadError(`Erreur serveur (${res.status}). Réessayez.`); return;
      }
      if (!res.ok || data.error) {
        setUploadError(data.error ?? `Erreur ${res.status}.`);
      } else if (data.text) {
        const text = data.text;
        onAdd({
          id: `kb-${Date.now()}`,
          name: data.name ?? file.name,
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
    }
  }, [isFull, onAdd]);

  /* ── Local file input handler ── */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await parseAndAddFile(file);
    e.target.value = "";
  };

  /* ── Google Drive ── */
  const { openPicker, isLoading: isGDLoading, gdError, isConfigured: isGDConfigured } =
    useGoogleDrivePicker(parseAndAddFile);

  const busy = isParsing || isGDLoading;
  const totalSize = docs.reduce((acc, d) => acc + d.sizeBytes, 0);
  const displayError = uploadError ?? gdError;

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
        <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Upload local file ── */}
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || isFull}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: `1.5px dashed ${isFull ? "rgba(255,255,255,0.1)" : hexToRgba(primary, 0.4)}`,
                background: isFull ? "rgba(255,255,255,0.03)" : hexToRgba(primary, 0.06),
                color: isFull ? "rgba(255,255,255,0.25)" : lightPrimary,
                cursor: isFull || busy ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {busy && !isGDLoading ? (
                <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Traitement en cours…</>
              ) : isFull ? (
                <>📚 Maximum atteint ({MAX_KB_DOCS} documents)</>
              ) : (
                <>➕ Ajouter un fichier local</>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.csv,.tsv,.xlsx,.xls"
              style={{ display: "none" }}
              onChange={handleFile}
            />
          </div>

          {/* ── Google Drive button ── */}
          <button
            onClick={openPicker}
            disabled={busy || isFull}
            title={!isGDConfigured ? "Configurez NEXT_PUBLIC_GOOGLE_API_KEY et NEXT_PUBLIC_GOOGLE_CLIENT_ID" : undefined}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: `1px solid ${isFull || !isGDConfigured ? "rgba(255,255,255,0.08)" : "rgba(66,133,244,0.4)"}`,
              background: isFull || !isGDConfigured ? "rgba(255,255,255,0.02)" : "rgba(66,133,244,0.07)",
              color: isFull || !isGDConfigured ? "rgba(255,255,255,0.2)" : "#93b4f8",
              cursor: isFull || busy ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
              opacity: isFull ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isFull && !busy && isGDConfigured)
                (e.currentTarget as HTMLElement).style.cssText += "background:rgba(66,133,244,0.14);border-color:rgba(66,133,244,0.6);";
            }}
            onMouseLeave={(e) => {
              if (!isFull && !busy && isGDConfigured)
                (e.currentTarget as HTMLElement).style.cssText += "background:rgba(66,133,244,0.07);border-color:rgba(66,133,244,0.4);";
            }}
          >
            {isGDLoading ? (
              <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Connexion à Google Drive…</>
            ) : (
              <>
                <GoogleDriveIcon />
                Importer depuis Google Drive
                {!isGDConfigured && <span style={{ fontSize: 10, opacity: 0.6 }}>(non configuré)</span>}
              </>
            )}
          </button>

          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", textAlign: "center", margin: "-4px 0 0" }}>
            PDF, TXT, CSV, Excel, Google Docs · Max {MAX_KB_DOCS} documents
          </p>

          {/* Error */}
          {displayError && (
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
              <span style={{ fontSize: 12, color: "#fca5a5" }}>⚠ {displayError}</span>
              <button
                onClick={() => { setUploadError(null); }}
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
              padding: "32px 0",
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

/* ── Google Drive color icon ── */
function GoogleDriveIcon() {
  return (
    <svg viewBox="0 0 87.3 78" style={{ width: 16, height: 16, flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a7.3 7.3 0 0 0 1.05 3.75z" fill="#0066da" />
      <path d="M43.65 25L29.9 1.2a8.1 8.1 0 0 0-3.3 3.3L1.05 49.15A7.3 7.3 0 0 0 0 52.9h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25a7.3 7.3 0 0 0 1.05-3.75H59.8l5.85 11.45z" fill="#ea4335" />
      <path d="M43.65 25L57.4 1.2C56.05.43 54.5 0 52.9 0H34.4a8.2 8.2 0 0 0-4.5 1.2z" fill="#00832d" />
      <path d="M59.8 52.9h27.5a7.3 7.3 0 0 0-1.05-3.75L60.5 4.5a8.1 8.1 0 0 0-3.1-3.3L43.65 25z" fill="#2684fc" />
      <path d="M27.5 52.9l-13.75 23.8c1.35.77 2.9 1.2 4.5 1.2h51.4c1.6 0 3.15-.43 4.5-1.2L59.8 52.9z" fill="#ffba00" />
    </svg>
  );
}
