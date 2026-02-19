"use client";

import { useState, useRef } from "react";

/* ── Types & defaults (exported for use in ChatInterface) ── */
export type Config = {
  platformName: string;
  agentName: string;
  primaryColor: string;
  backgroundColor: string;
  welcomeMessage: string;
  systemPrompt: string;
  logoUrl: string;
};

export const DEFAULT_CONFIG: Config = {
  platformName: "NextStrato AI",
  agentName: "Strato",
  primaryColor: "#4F6EF7",
  backgroundColor: "#FFFFFF",
  welcomeMessage:
    "Bonjour ! Je suis votre assistant. Je suis là pour vous aider à optimiser vos opérations, analyser vos données et accélérer votre transformation digitale.",
  systemPrompt:
    "Tu es Strato, un assistant IA de NextStrato. Tu aides les entreprises à optimiser leurs opérations, analyser leurs données et accélérer leur transformation digitale. Réponds en français, de manière professionnelle, concise et directe.",
  logoUrl: "",
};

const COLOR_PRESETS = [
  "#4F6EF7", // Indigo (défaut)
  "#8B5CF6", // Violet
  "#0ea5e9", // Ciel
  "#10b981", // Émeraude
  "#f59e0b", // Ambre
  "#ef4444", // Rouge
  "#ec4899", // Rose
  "#64748b", // Ardoise
];

const BG_PRESETS = [
  "#FFFFFF", // Blanc pur (défaut)
  "#F5F5FA", // Gris clair
  "#f8fafc", // Blanc cassé
  "#EEF2FF", // Indigo très clair
  "#F5F3FF", // Violet très clair
  "#F0FDFB", // Vert très clair
  "#090a0f", // Nuit
  "#0f172a", // Ardoise sombre
];

type Props = {
  config: Config;
  onChange: (updates: Partial<Config>) => void;
  onClose: () => void;
  onReset: () => void;
};

export default function ConfigPanel({ config, onChange, onClose, onReset }: Props) {
  const [logoMode, setLogoMode] = useState<"url" | "file">("url");
  const logoFileRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ logoUrl: reader.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 40,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          background: "#FFFFFF",
          borderLeft: "1px solid #E4E4EF",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #E4E4EF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ color: "#0F0F18", fontWeight: 600, fontSize: 15, margin: 0 }}>
              Configuration
            </p>
            <p style={{ color: "#71718A", fontSize: 12, margin: "2px 0 0" }}>
              Modifications appliquées en temps réel
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "#F5F5FA",
              border: "1px solid #E4E4EF",
              color: "#71718A",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,0,0,0.08) transparent",
          }}
        >
          {/* ── Identité ── */}
          <Section title="Identité">
            <Field label="Nom de la plateforme">
              <PanelInput
                value={config.platformName}
                onChange={(v) => onChange({ platformName: v })}
                placeholder="NextStrato AI"
                primary={config.primaryColor}
              />
            </Field>
            <Field label="Nom de l'agent">
              <PanelInput
                value={config.agentName}
                onChange={(v) => onChange({ agentName: v })}
                placeholder="Strato"
                primary={config.primaryColor}
              />
            </Field>
          </Section>

          {/* ── Logo ── */}
          <Section title="Logo">
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {(["url", "file"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLogoMode(mode)}
                  style={{
                    padding: "4px 14px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    border: "1px solid",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: logoMode === mode ? config.primaryColor : "transparent",
                    borderColor: logoMode === mode ? config.primaryColor : "#E4E4EF",
                    color: logoMode === mode ? "#fff" : "#71718A",
                  }}
                >
                  {mode === "url" ? "URL" : "Fichier"}
                </button>
              ))}
            </div>

            {logoMode === "url" ? (
              <PanelInput
                value={config.logoUrl}
                onChange={(v) => onChange({ logoUrl: v })}
                placeholder="https://exemple.com/logo.png"
                primary={config.primaryColor}
              />
            ) : (
              <button
                onClick={() => logoFileRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px dashed #E4E4EF",
                  background: "#F5F5FA",
                  color: "#71718A",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Choisir une image (PNG, SVG, JPG, WebP)
              </button>
            )}
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              style={{ display: "none" }}
              onChange={handleLogoFile}
            />

            {config.logoUrl && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#F5F5FA",
                  border: "1px solid #E4E4EF",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.logoUrl} alt="Aperçu" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6 }} />
                <span style={{ fontSize: 12, color: "#71718A", flex: 1 }}>Aperçu du logo</span>
                <button
                  onClick={() => onChange({ logoUrl: "" })}
                  style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                >
                  Supprimer
                </button>
              </div>
            )}
          </Section>

          {/* ── Couleurs ── */}
          <Section title="Couleurs">
            <Field label="Couleur principale">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) => onChange({ primaryColor: e.target.value })}
                  style={{ width: 42, height: 42, border: "2px solid #E4E4EF", borderRadius: 10, cursor: "pointer", padding: 3, background: "transparent", flexShrink: 0 }}
                />
                <p style={{ fontFamily: "monospace", fontSize: 13, color: "#71718A", margin: 0 }}>
                  {config.primaryColor.toUpperCase()}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onChange({ primaryColor: color })}
                    title={color}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", background: color,
                      border: config.primaryColor === color ? `2px solid ${color}` : "2px solid transparent",
                      cursor: "pointer",
                      boxShadow: config.primaryColor === color ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : "none",
                      transition: "transform 0.1s, box-shadow 0.1s",
                    }}
                  />
                ))}
              </div>
            </Field>

            <Field label="Couleur de fond">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <input
                  type="color"
                  value={config.backgroundColor}
                  onChange={(e) => onChange({ backgroundColor: e.target.value })}
                  style={{ width: 42, height: 42, border: "2px solid #E4E4EF", borderRadius: 10, cursor: "pointer", padding: 3, background: "transparent", flexShrink: 0 }}
                />
                <p style={{ fontFamily: "monospace", fontSize: 13, color: "#71718A", margin: 0 }}>
                  {config.backgroundColor.toUpperCase()}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {BG_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onChange({ backgroundColor: color })}
                    title={color}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", background: color,
                      border: config.backgroundColor === color ? `2px solid ${config.primaryColor}` : "2px solid #E4E4EF",
                      cursor: "pointer",
                      boxShadow: config.backgroundColor === color ? `0 0 0 2px #fff, 0 0 0 4px ${config.primaryColor}` : "none",
                      transition: "transform 0.1s, box-shadow 0.1s",
                    }}
                  />
                ))}
              </div>
            </Field>
          </Section>

          {/* ── Messages ── */}
          <Section title="Messages">
            <Field label="Message de bienvenue">
              <PanelTextarea
                value={config.welcomeMessage}
                onChange={(v) => onChange({ welcomeMessage: v })}
                placeholder="Bonjour ! Je suis votre assistant…"
                rows={3}
                primary={config.primaryColor}
              />
            </Field>
            <Field label="System prompt">
              <PanelTextarea
                value={config.systemPrompt}
                onChange={(v) => onChange({ systemPrompt: v })}
                placeholder="Tu es un assistant IA…"
                rows={6}
                primary={config.primaryColor}
              />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E4E4EF", flexShrink: 0 }}>
          <button
            onClick={onReset}
            style={{
              width: "100%", padding: "9px", borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.25)",
              background: "rgba(239,68,68,0.05)",
              color: "#dc2626", fontSize: 13, cursor: "pointer", fontWeight: 500,
            }}
          >
            Réinitialiser les paramètres par défaut
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#71718A", margin: "0 0 14px" }}>
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#71718A", margin: "0 0 6px" }}>{label}</p>
      {children}
    </div>
  );
}

function PanelInput({ value, onChange, placeholder, primary }: { value: string; onChange: (v: string) => void; placeholder?: string; primary: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E4E4EF", background: "#F5F5FA", color: "#0F0F18", fontSize: 13, outline: "none", boxSizing: "border-box" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = primary)}
      onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E4EF")}
    />
  );
}

function PanelTextarea({ value, onChange, placeholder, rows = 3, primary }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; primary: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E4E4EF", background: "#F5F5FA", color: "#0F0F18", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.55, fontFamily: "inherit" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = primary)}
      onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E4EF")}
    />
  );
}
