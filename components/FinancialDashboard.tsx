"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { DocFile } from "./DataVizModal";

/* ── Helpers ── */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K€`;
  return `${v.toFixed(0)}€`;
}

function fmtDays(v: number): string {
  return `${v.toFixed(0)}j`;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/* ── KPI Pattern matching ── */
const P = {
  ca: /chiffre.?d.?affaires|^ca$|^revenue$|^ventes?$|^sales$/i,
  margeBrute: /marge.?brute|gross.?margin/i,
  ebitda: /ebitda|excédent.?brut/i,
  resultatNet: /résultat.?net|net.?income|bénéfice.?net/i,
  tresorerie: /trésorerie|^cash$|liquidités?|disponibilités?/i,
  bfr: /^bfr$|besoin.?fonds|working.?capital/i,
  dso: /^dso$|délai.?clients?|jours.?clients?/i,
  dpo: /^dpo$|délai.?fournisseurs?|jours.?four/i,
  budget: /budget/i,
  nMoins1: /n-1|n\.1|année.?préc|previous/i,
  entite: /filiale|entité|bu\b|business.?unit|département|direction|société/i,
};

/* ── Types ── */
type KpiValue = { reel: number | null; budget: number | null; nMoins1: number | null };

type ParsedData = {
  kpis: {
    ca: KpiValue; margeBrute: KpiValue; ebitda: KpiValue; resultatNet: KpiValue;
    tresorerie: KpiValue; bfr: KpiValue; dso: KpiValue; dpo: KpiValue;
  };
  entities: { name: string; ca: number; marge: number; ebitda: number }[];
  variances: { label: string; ecart: number; pct: number; isGood: boolean; isAlert: boolean }[];
};

/* ── CSV Parsing ── */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const delim = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delim).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

function parseNum(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function findCol(headers: string[], pattern: RegExp): string | null {
  return headers.find((h) => pattern.test(h.trim())) ?? null;
}

function sumCol(rows: Record<string, string>[], col: string): number | null {
  let total = 0, found = false;
  for (const row of rows) {
    const v = parseNum(row[col]);
    if (v !== null) { total += v; found = true; }
  }
  return found ? total : null;
}

function avgCol(rows: Record<string, string>[], col: string): number | null {
  let total = 0, count = 0;
  for (const row of rows) {
    const v = parseNum(row[col]);
    if (v !== null) { total += v; count++; }
  }
  return count > 0 ? total / count : null;
}

/* ── Main parsing function ── */
function parseData(docs: DocFile[]): ParsedData {
  const allRows: Record<string, string>[] = [];
  for (const doc of docs) allRows.push(...parseCsv(doc.text));

  const headers = allRows.length > 0 ? Object.keys(allRows[0]) : [];

  // Detect type column (Réel / Budget / N-1 rows)
  const typeCol = headers.find((h) => /^type$|^catégorie$|^nature$|^indicateur$|^période$/i.test(h));
  let reelRows = allRows;
  let budgetRows: Record<string, string>[] = [];
  let n1Rows: Record<string, string>[] = [];
  if (typeCol) {
    reelRows = allRows.filter((r) => /réel|actual|reel/i.test(r[typeCol] ?? ""));
    budgetRows = allRows.filter((r) => /budget/i.test(r[typeCol] ?? ""));
    n1Rows = allRows.filter((r) => /n-1|n\.1|précédent|previous/i.test(r[typeCol] ?? ""));
    if (reelRows.length === 0) reelRows = allRows;
  }

  // Column detection
  const caReelCol = headers.find((h) => /ca.?réel|réel.?ca|chiffre.?réel|ventes.?réel/i.test(h))
    ?? findCol(headers, P.ca);
  const caBudgetCol = headers.find((h) => /ca.?budget|budget.?ca|chiffre.?budget/i.test(h)) ?? null;
  const caN1Col = headers.find((h) => /ca.?n-1|n-1.?ca/i.test(h)) ?? null;
  const margeReelCol = headers.find((h) => /marge.?réel|réel.?marge/i.test(h))
    ?? findCol(headers, P.margeBrute);
  const margeBudgetCol = headers.find((h) => /marge.?budget|budget.?marge/i.test(h)) ?? null;
  const ebitdaReelCol = headers.find((h) => /ebitda.?réel|réel.?ebitda/i.test(h))
    ?? findCol(headers, P.ebitda);
  const ebitdaBudgetCol = headers.find((h) => /ebitda.?budget|budget.?ebitda/i.test(h)) ?? null;
  const rnCol = findCol(headers, P.resultatNet);
  const tresoCol = findCol(headers, P.tresorerie);
  const bfrCol = findCol(headers, P.bfr);
  const dsoCol = findCol(headers, P.dso);
  const dpoCol = findCol(headers, P.dpo);
  const entiteCol = findCol(headers, P.entite);

  const makeKpi = (
    reelCol: string | null,
    budgetCol2: string | null,
    n1Col: string | null,
    isDays = false
  ): KpiValue => {
    const agg = isDays ? avgCol : sumCol;
    const reel = agg(reelRows, reelCol ?? "");
    const budget = budgetCol2
      ? (agg(reelRows, budgetCol2) ?? agg(reelRows, reelCol ?? "") ?? null)
      : (budgetRows.length > 0 ? agg(budgetRows, reelCol ?? "") : null);
    const nMoins1 = n1Col
      ? (agg(reelRows, n1Col) ?? (n1Rows.length > 0 ? agg(n1Rows, reelCol ?? "") : null))
      : (n1Rows.length > 0 ? agg(n1Rows, reelCol ?? "") : null);
    return { reel: reelCol ? reel : null, budget: budgetCol2 ? budget : budget, nMoins1 };
  };

  const kpis = {
    ca: makeKpi(caReelCol, caBudgetCol, caN1Col),
    margeBrute: makeKpi(margeReelCol, margeBudgetCol, null),
    ebitda: makeKpi(ebitdaReelCol, ebitdaBudgetCol, null),
    resultatNet: makeKpi(rnCol, null, null),
    tresorerie: makeKpi(tresoCol, null, null),
    bfr: makeKpi(bfrCol, null, null),
    dso: makeKpi(dsoCol, null, null, true),
    dpo: makeKpi(dpoCol, null, null, true),
  };

  // Entities
  const entities: ParsedData["entities"] = [];
  if (entiteCol && caReelCol) {
    const names = [...new Set(reelRows.map((r) => r[entiteCol]).filter(Boolean))];
    for (const name of names.slice(0, 8)) {
      const rows = reelRows.filter((r) => r[entiteCol] === name);
      entities.push({
        name,
        ca: sumCol(rows, caReelCol) ?? 0,
        marge: margeReelCol ? (sumCol(rows, margeReelCol) ?? 0) : 0,
        ebitda: ebitdaReelCol ? (sumCol(rows, ebitdaReelCol) ?? 0) : 0,
      });
    }
    entities.sort((a, b) => b.ca - a.ca);
  }

  // Variances
  const KPI_LABELS: Record<string, string> = {
    ca: "Chiffre d'affaires", margeBrute: "Marge brute", ebitda: "EBITDA",
    resultatNet: "Résultat net", tresorerie: "Trésorerie", bfr: "BFR",
  };
  const REVENUE_METRICS = new Set(["ca", "margeBrute", "ebitda", "resultatNet", "tresorerie"]);

  const variances: ParsedData["variances"] = [];
  for (const [key, kpi] of Object.entries(kpis)) {
    if (!KPI_LABELS[key] || kpi.reel === null) continue;
    const ref = kpi.budget ?? kpi.nMoins1;
    if (ref === null || ref === 0) continue;
    const ecart = kpi.reel - ref;
    const pct = (ecart / Math.abs(ref)) * 100;
    const isGood = REVENUE_METRICS.has(key) ? ecart >= 0 : ecart <= 0;
    const refLabel = kpi.budget !== null ? "vs Budget" : "vs N-1";
    variances.push({
      label: `${KPI_LABELS[key]} (${refLabel})`,
      ecart, pct, isGood,
      isAlert: Math.abs(pct) > 10,
    });
  }
  variances.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  return { kpis, entities, variances: variances.slice(0, 6) };
}

/* ── KPI Card ── */
function KpiCard({ label, kpi, isDays = false, icon }: {
  label: string; kpi: KpiValue; isDays?: boolean; icon: string;
}) {
  const format = isDays ? fmtDays : fmt;
  const hasReel = kpi.reel !== null;
  const ecartB = kpi.reel !== null && kpi.budget !== null ? kpi.reel - kpi.budget : null;
  const ecartN = kpi.reel !== null && kpi.nMoins1 !== null ? kpi.reel - kpi.nMoins1 : null;
  const pctB = ecartB !== null && kpi.budget && kpi.budget !== 0 ? (ecartB / Math.abs(kpi.budget)) * 100 : null;
  const pctN = ecartN !== null && kpi.nMoins1 && kpi.nMoins1 !== 0 ? (ecartN / Math.abs(kpi.nMoins1)) * 100 : null;

  const badge = (pct: number | null, ref: number | null, refLabel: string) => {
    if (pct === null || ref === null) return null;
    const good = pct >= 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
          background: good ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          color: good ? "#059669" : "#dc2626",
        }}>
          {good ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
        </span>
        <span style={{ fontSize: 10, color: "#71718A" }}>{refLabel} ({format(ref)})</span>
      </div>
    );
  };

  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E4E4EF", borderRadius: 12,
      padding: "16px", flex: 1, minWidth: 145,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#71718A", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: "#0F0F18", margin: "0 0 10px", lineHeight: 1.1 }}>
        {hasReel ? format(kpi.reel!) : <span style={{ color: "#71718A", fontSize: 14 }}>N/D</span>}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {badge(pctB, kpi.budget, "vs Budget")}
        {badge(pctN, kpi.nMoins1, "vs N-1")}
        {!hasReel && <span style={{ fontSize: 10, color: "#71718A" }}>Colonne non détectée</span>}
      </div>
    </div>
  );
}

/* ── Section header ── */
function SectionTitle({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: color }} />
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#0F0F18", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</h3>
    </div>
  );
}

/* ── Props ── */
type Props = { documents: DocFile[]; primary: string; onClose: () => void };

/* ── Main component ── */
export default function FinancialDashboard({ documents, primary, onClose }: Props) {
  const [tab, setTab] = useState<"kpis" | "entities" | "comex">("kpis");
  const [data, setData] = useState<ParsedData | null>(null);
  const [comexText, setComexText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [comexError, setComexError] = useState<string | null>(null);

  const COLORS = [primary, "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6"];

  useEffect(() => {
    if (documents.length > 0) setData(parseData(documents));
  }, [documents]);

  const generateComex = useCallback(async () => {
    if (!data) return;
    setIsGenerating(true);
    setComexError(null);
    setComexText("");

    const KPI_LABELS: Record<string, string> = {
      ca: "CA", margeBrute: "Marge brute", ebitda: "EBITDA",
      resultatNet: "Résultat net", tresorerie: "Trésorerie", bfr: "BFR", dso: "DSO", dpo: "DPO",
    };
    const kpiSummary = (Object.entries(data.kpis) as [string, KpiValue][])
      .filter(([, v]) => v.reel !== null)
      .map(([k, v]) => {
        let line = `${KPI_LABELS[k] ?? k}: Réel=${v.reel}`;
        if (v.budget !== null) line += `, Budget=${v.budget}`;
        if (v.nMoins1 !== null) line += `, N-1=${v.nMoins1}`;
        return line;
      }).join("\n");

    const varSummary = data.variances
      .map((v) => `${v.label}: ${v.ecart >= 0 ? "+" : ""}${v.ecart.toFixed(0)} (${fmtPct(v.pct)})`)
      .join("\n");

    const entitySummary = data.entities.length > 0
      ? "\nVue multi-entités:\n" + data.entities.map((e) => `${e.name}: CA=${e.ca}, Marge=${e.marge}`).join("\n")
      : "";

    const prompt = `Tu es un expert DAF. Génère un commentaire COMEX structuré et professionnel (4 paragraphes) basé sur :

KPIs:
${kpiSummary}

Analyse des écarts:
${varSummary}${entitySummary}

Structure OBLIGATOIRE :
1. **Synthèse Performance** — faits marquants chiffrés
2. **Points de Vigilance** — écarts négatifs et causes probables
3. **Points Positifs** — performances supérieures aux attentes
4. **Recommandations** — 3 actions prioritaires concrètes

Sois précis, chiffré et directement actionnable. Réponds en français.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          systemPrompt: "Tu es un expert DAF. Génère des commentaires COMEX structurés, chiffrés et actionnables en français.",
        }),
      });

      if (!res.ok || !res.body) { setComexError(`Erreur ${res.status}`); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const delta = JSON.parse(raw)?.choices?.[0]?.delta?.content ?? "";
            full += delta;
            setComexText(full);
          } catch { /* ignore */ }
        }
      }
    } catch {
      setComexError("Impossible de joindre le serveur.");
    } finally {
      setIsGenerating(false);
    }
  }, [data]);

  const tabs = [
    { id: "kpis" as const, label: "📊 KPIs" },
    { id: "entities" as const, label: "🏢 Multi-entités" },
    { id: "comex" as const, label: "📝 Commentaire COMEX" },
  ];

  const noKpiDetected = data &&
    data.kpis.ca.reel === null && data.kpis.margeBrute.reel === null &&
    data.kpis.ebitda.reel === null && data.kpis.tresorerie.reel === null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(4px)" }} />

      {/* Modal */}
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24, pointerEvents: "none" }}>
        <div style={{
          width: "100%", maxWidth: 920, maxHeight: "90vh",
          background: "#FFFFFF", borderRadius: 16, border: "1px solid #E4E4EF",
          boxShadow: "0 24px 80px rgba(0,0,0,0.14)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          pointerEvents: "auto",
        }}>

          {/* Header */}
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #E4E4EF", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: hexToRgba(primary, 0.1), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💼</div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F0F18", margin: 0 }}>Dashboard Financier DAF</h2>
                <p style={{ fontSize: 11, color: "#71718A", margin: "2px 0 0" }}>
                  {documents.length === 0
                    ? "Chargez un fichier CSV ou Excel pour commencer"
                    : `${documents.length} fichier${documents.length > 1 ? "s" : ""} analysé${documents.length > 1 ? "s" : ""} · ${documents.map((d) => d.name).join(", ")}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "#F5F5FA", border: "1px solid #E4E4EF", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#71718A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, padding: "12px 24px 0", borderBottom: "1px solid #E4E4EF", flexShrink: 0, background: "#F5F5FA" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 16px", border: "none", borderRadius: "8px 8px 0 0",
                background: tab === t.id ? "#FFFFFF" : "transparent",
                color: tab === t.id ? primary : "#71718A",
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                cursor: "pointer", transition: "all 0.12s",
                borderTop: tab === t.id ? `2px solid ${primary}` : "2px solid transparent",
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.08) transparent" }}>

            {/* ── No documents ── */}
            {documents.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p style={{ fontSize: 44, margin: 0 }}>📂</p>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F0F18", margin: "16px 0 8px" }}>Chargez vos données financières</h3>
                <p style={{ fontSize: 13, color: "#71718A", lineHeight: 1.7, margin: "0 auto", maxWidth: 380 }}>
                  Utilisez le bouton 📎 dans la zone de saisie pour joindre un fichier CSV ou Excel.<br />
                  Le dashboard détectera automatiquement vos indicateurs.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
                  {["CA / Marge brute / EBITDA", "Trésorerie / BFR / DSO / DPO", "Filiale / BU / Entité"].map((hint) => (
                    <span key={hint} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: hexToRgba(primary, 0.07), border: `1px solid ${hexToRgba(primary, 0.2)}`, color: primary }}>
                      {hint}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab KPIs ── */}
            {tab === "kpis" && data && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {noKpiDetected && (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "#71718A" }}>
                    <p style={{ fontSize: 36, margin: 0 }}>📂</p>
                    <p style={{ fontSize: 13, marginTop: 12, lineHeight: 1.7 }}>
                      Aucun indicateur financier détecté dans vos fichiers.<br />
                      Vérifiez que les colonnes sont nommées : <strong>CA, Marge brute, EBITDA, Résultat net, Trésorerie, BFR, DSO, DPO</strong>.
                    </p>
                  </div>
                )}

                {/* Performance financière */}
                <section>
                  <SectionTitle label="Performance financière" color={primary} />
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <KpiCard label="Chiffre d'affaires" kpi={data.kpis.ca} icon="💰" />
                    <KpiCard label="Marge brute" kpi={data.kpis.margeBrute} icon="📈" />
                    <KpiCard label="EBITDA" kpi={data.kpis.ebitda} icon="⚡" />
                    <KpiCard label="Résultat net" kpi={data.kpis.resultatNet} icon="🎯" />
                  </div>
                </section>

                {/* Cash & Trésorerie */}
                <section>
                  <SectionTitle label="Cash & Trésorerie" color="#8B5CF6" />
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <KpiCard label="Trésorerie" kpi={data.kpis.tresorerie} icon="🏦" />
                    <KpiCard label="BFR" kpi={data.kpis.bfr} icon="🔄" />
                    <KpiCard label="DSO — jours clients" kpi={data.kpis.dso} isDays icon="📅" />
                    <KpiCard label="DPO — jours four." kpi={data.kpis.dpo} isDays icon="📆" />
                  </div>
                </section>

                {/* Analyse des écarts */}
                {data.variances.length > 0 && (
                  <section>
                    <SectionTitle label="Analyse des écarts" color="#F59E0B" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.variances.map((v, i) => {
                        const color = v.isAlert ? "#F59E0B" : v.isGood ? "#059669" : "#dc2626";
                        const bg = v.isAlert ? "rgba(245,158,11,0.07)" : v.isGood ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)";
                        const border = v.isAlert ? "rgba(245,158,11,0.2)" : v.isGood ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)";
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{v.isAlert ? "⚠️" : v.isGood ? "✅" : "🔴"}</span>
                            <p style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#0F0F18", margin: 0 }}>{v.label}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color }}>{v.ecart >= 0 ? "+" : ""}{fmt(v.ecart)}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: color + "22", color }}>{fmtPct(v.pct)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ── Tab Multi-entités ── */}
            {tab === "entities" && data && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {data.entities.length > 0 ? (
                  <>
                    <SectionTitle label="Performance par entité" color={primary} />

                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.entities} margin={{ top: 5, right: 20, left: 10, bottom: 35 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                          <XAxis dataKey="name" tick={{ fill: "rgba(0,0,0,0.45)", fontSize: 11 }} angle={-20} textAnchor="end" />
                          <YAxis tick={{ fill: "rgba(0,0,0,0.45)", fontSize: 11 }} tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)} />
                          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E4E4EF", borderRadius: 8, fontSize: 12 }} formatter={(v: number | string | undefined) => typeof v === "number" ? fmt(v) : String(v ?? "")} />
                          <Bar dataKey="ca" name="CA" radius={[4, 4, 0, 0]}>
                            {data.entities.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.entities.map((e, i) => {
                        const total = data.entities.reduce((s, x) => s + x.ca, 0);
                        const share = total > 0 ? (e.ca / total) * 100 : 0;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "#F5F5FA", border: "1px solid #E4E4EF" }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                            <p style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#0F0F18", margin: 0 }}>{e.name}</p>
                            <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                              <div style={{ textAlign: "right" }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: "#0F0F18", margin: 0 }}>{fmt(e.ca)}</p>
                                <p style={{ fontSize: 10, color: "#71718A", margin: "2px 0 0" }}>CA</p>
                              </div>
                              {e.marge !== 0 && (
                                <div style={{ textAlign: "right" }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0F0F18", margin: 0 }}>{fmt(e.marge)}</p>
                                  <p style={{ fontSize: 10, color: "#71718A", margin: "2px 0 0" }}>Marge</p>
                                </div>
                              )}
                              <div style={{ textAlign: "right" }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: primary, margin: 0 }}>{share.toFixed(1)}%</p>
                                <p style={{ fontSize: 10, color: "#71718A", margin: "2px 0 0" }}>Part groupe</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "64px 0", color: "#71718A" }}>
                    <p style={{ fontSize: 40, margin: 0 }}>🏢</p>
                    <p style={{ fontSize: 13, marginTop: 14, lineHeight: 1.7 }}>
                      Aucune entité détectée.<br />
                      Ajoutez une colonne <strong>Filiale</strong>, <strong>Entité</strong>, <strong>BU</strong> ou <strong>Département</strong> dans vos fichiers.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab Commentaire COMEX ── */}
            {tab === "comex" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {!comexText && !isGenerating && (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 40, margin: 0 }}>✍️</p>
                    <p style={{ fontSize: 13, color: "#71718A", marginTop: 14, marginBottom: 24, lineHeight: 1.7 }}>
                      Générez automatiquement un commentaire COMEX structuré<br />basé sur les données de vos fichiers.
                    </p>
                    <button onClick={generateComex} style={{
                      background: primary, color: "#fff", border: "none", borderRadius: 10,
                      padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}>
                      ✨ Générer le commentaire COMEX
                    </button>
                    {comexError && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 12 }}>⚠ {comexError}</p>}
                  </div>
                )}

                {isGenerating && !comexText && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "#71718A" }}>
                    <span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: 18 }}>⟳</span>
                    <span style={{ fontSize: 13 }}>Génération du commentaire COMEX en cours…</span>
                  </div>
                )}

                {comexText && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <SectionTitle label="Commentaire COMEX" color={primary} />
                      <div style={{ display: "flex", gap: 8 }}>
                        {isGenerating && <span style={{ fontSize: 16, animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>}
                        <button onClick={generateComex} disabled={isGenerating}
                          style={{ background: "none", border: `1px solid ${hexToRgba(primary, 0.3)}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, color: primary, cursor: isGenerating ? "not-allowed" : "pointer" }}>
                          ↻ Regénérer
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(comexText)}
                          style={{ background: "none", border: "1px solid #E4E4EF", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: "#71718A", cursor: "pointer" }}>
                          📋 Copier
                        </button>
                      </div>
                    </div>
                    <div style={{
                      background: "#F5F5FA", borderRadius: 10, padding: "20px 22px",
                      border: "1px solid #E4E4EF", fontSize: 13, lineHeight: 1.85, color: "#0F0F18",
                      whiteSpace: "pre-wrap",
                    }}>
                      {comexText}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
