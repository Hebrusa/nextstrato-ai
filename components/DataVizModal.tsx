"use client";

import React, { useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

/* ── Shared type ── */
export type DocFile = { name: string; text: string };

/* ── Color helpers ── */
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const ACCENT = "#06b6d4"; // second series color

/* ════════════════════════════════
   CSV parsing
════════════════════════════════ */
function detectDelimiter(line: string): string {
  const s = (line.match(/;/g) ?? []).length;
  const t = (line.match(/\t/g) ?? []).length;
  if (t >= s && t >= (line.match(/,/g) ?? []).length) return "\t";
  if (s > (line.match(/,/g) ?? []).length) return ";";
  return ",";
}

function splitCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; }
    else if (ch === sep && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

type ParsedCSV = {
  headers: string[];
  rows: Record<string, string>[];
  numericCols: string[];
  categoricalCols: string[];
  timeCols: string[];
};

function parseCSV(text: string): ParsedCSV | null {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const sep = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], sep);
  const rows = lines.slice(1, 31).map((l) => {
    const vals = splitCSVLine(l, sep);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  const numericCols = headers.filter((h) =>
    rows.some((r) => r[h] !== "" && !isNaN(parseFloat(r[h].replace(/[\s,]/g, ""))))
    && rows.filter((r) => r[h] !== "").every((r) => !isNaN(parseFloat(r[h].replace(/[\s,]/g, ""))))
  );
  const categoricalCols = headers.filter((h) => !numericCols.includes(h));
  const timeCols = categoricalCols.filter((h) =>
    /date|month|mois|year|ann[ée]|quarter|trim|week|sem|jour|day|p[ée]riode/i.test(h)
  );
  return { headers, rows, numericCols, categoricalCols, timeCols };
}

function isLikelyCSV(text: string) {
  const first = text.split("\n")[0];
  return splitCSVLine(first, detectDelimiter(first)).length >= 2;
}

/* ════════════════════════════════
   Chart data preparation
════════════════════════════════ */
type ChartData = {
  type: "bar" | "line";
  data: Record<string, string | number>[];
  xKey: string;
  yKeys: string[];
};

function prepareChart(csv: ParsedCSV): ChartData | null {
  const { rows, numericCols, categoricalCols, timeCols } = csv;
  const xCol = timeCols[0] ?? categoricalCols[0];
  if (!xCol && numericCols.length < 1) return null;

  if (!xCol) {
    // All numeric — use row index
    return {
      type: "line",
      data: rows.map((r, i) => ({
        name: String(i + 1),
        ...Object.fromEntries(
          numericCols.slice(0, 3).map((c) => [c, parseFloat(r[c].replace(/[\s,]/g, "")) || 0])
        ),
      })),
      xKey: "name",
      yKeys: numericCols.slice(0, 3),
    };
  }

  return {
    type: timeCols.includes(xCol) ? "line" : "bar",
    data: rows.slice(0, 15).map((r) => ({
      name: r[xCol],
      ...Object.fromEntries(
        numericCols.slice(0, 3).map((c) => [c, parseFloat(r[c].replace(/[\s,]/g, "")) || 0])
      ),
    })),
    xKey: "name",
    yKeys: numericCols.slice(0, 3),
  };
}

type ComparisonData = {
  data: Record<string, string | number>[];
  metric: string;
  keys: [string, string];
};

function prepareComparison(
  csv1: ParsedCSV, csv2: ParsedCSV,
  n1: string, n2: string
): ComparisonData | null {
  const common = csv1.numericCols.filter((c) => csv2.numericCols.includes(c));
  if (!common.length) return null;
  const metric = common[0];
  const x1 = csv1.categoricalCols[0] ?? csv1.timeCols[0];
  const x2 = csv2.categoricalCols[0] ?? csv2.timeCols[0];
  if (!x1 || !x2) return null;

  const map1 = Object.fromEntries(
    csv1.rows.slice(0, 10).map((r) => [r[x1], parseFloat(r[metric].replace(/[\s,]/g, "")) || 0])
  );
  const map2 = Object.fromEntries(
    csv2.rows.slice(0, 10).map((r) => [r[x2], parseFloat(r[metric].replace(/[\s,]/g, "")) || 0])
  );
  const allKeys = Array.from(new Set([...Object.keys(map1), ...Object.keys(map2)])).slice(0, 10);
  const k1 = n1.replace(/\.[^.]+$/, "");
  const k2 = n2.replace(/\.[^.]+$/, "");

  return {
    data: allKeys.map((k) => ({ name: k, [k1]: map1[k] ?? 0, [k2]: map2[k] ?? 0 })),
    metric,
    keys: [k1, k2],
  };
}

/* ════════════════════════════════
   Number formatter
════════════════════════════════ */
function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString("fr-FR");
}

/* ════════════════════════════════
   Simple Markdown renderer
════════════════════════════════ */
function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: "#d4d8f0" }}>
      {text.split("\n").map((line, i) => {
        if (/^#{1,3} /.test(line))
          return <p key={i} style={{ fontWeight: 700, color: "#e8eaf0", margin: "14px 0 4px", fontSize: 13 }}>{line.replace(/^#+\s/, "")}</p>;
        if (/^\*\*.*\*\*$/.test(line.trim()))
          return <p key={i} style={{ fontWeight: 600, color: "#e8eaf0", margin: "10px 0 2px" }}>{line.trim().slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return <p key={i} style={{ margin: "2px 0", paddingLeft: 12 }}>· {line.slice(2)}</p>;
        if (/^\d+\. /.test(line))
          return <p key={i} style={{ margin: "2px 0", paddingLeft: 12 }}>{line}</p>;
        if (line.trim() === "") return <br key={i} />;
        // inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        if (parts.length > 1)
          return (
            <p key={i} style={{ margin: "2px 0" }}>
              {parts.map((p, j) =>
                p.startsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p
              )}
            </p>
          );
        return <p key={i} style={{ margin: "2px 0" }}>{line}</p>;
      })}
    </div>
  );
}

/* ════════════════════════════════
   Recharts shared theme
════════════════════════════════ */
const tooltipStyle = {
  contentStyle: {
    background: "#13141d",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e8eaf0",
    fontSize: 12,
  },
  labelStyle: { color: "rgba(255,255,255,0.6)", marginBottom: 4 },
};
const axisProps = {
  tick: { fill: "rgba(255,255,255,0.35)", fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
};
const gridProps = { stroke: "rgba(255,255,255,0.05)", strokeDasharray: "3 3" };

/* ════════════════════════════════
   SingleChart
════════════════════════════════ */
type ChartType = "bar" | "line" | "area" | "pie";

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
];

function SingleChart({ chart, primary, title }: { chart: ChartData; primary: string; title: string }) {
  const [chartType, setChartType] = useState<ChartType>(chart.type);
  const COLORS = [primary, ACCENT, "#f59e0b", "#a78bfa", "#34d399"];
  const common = { data: chart.data };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "3px 10px", borderRadius: 4, border: "none", cursor: "pointer",
    fontSize: 11, fontWeight: 500,
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    color: active ? "#e8eaf0" : "rgba(255,255,255,0.3)",
    transition: "background 0.15s, color 0.15s",
  });

  const pieData = chart.data.map((d) => ({
    name: String(d[chart.xKey]),
    value: Number(d[chart.yKeys[0]]) || 0,
  }));

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Title + type switcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", margin: 0 }}>
          {title}
        </p>
        <div style={{ display: "flex", gap: 1, background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: 2 }}>
          {CHART_TYPES.map(({ value, label }) => (
            <button key={value} onClick={() => setChartType(value)} style={btnStyle(chartType === value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        {chartType === "bar" ? (
          <BarChart {...common} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={chart.xKey} {...axisProps} tickFormatter={(v) => String(v).slice(0, 10)} />
            <YAxis {...axisProps} tickFormatter={fmt} width={45} />
            <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => fmt(v ?? 0)} />
            {chart.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />}
            {chart.yKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={40} />
            ))}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart {...common} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={chart.xKey} {...axisProps} tickFormatter={(v) => String(v).slice(0, 10)} />
            <YAxis {...axisProps} tickFormatter={fmt} width={45} />
            <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => fmt(v ?? 0)} />
            {chart.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />}
            {chart.yKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : chartType === "area" ? (
          <AreaChart {...common} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              {chart.yKeys.map((k, i) => (
                <linearGradient key={k} id={`area-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={chart.xKey} {...axisProps} tickFormatter={(v) => String(v).slice(0, 10)} />
            <YAxis {...axisProps} tickFormatter={fmt} width={45} />
            <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => fmt(v ?? 0)} />
            {chart.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />}
            {chart.yKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} fill={`url(#area-grad-${k})`} />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={85}
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${String(name ?? "").slice(0, 10)} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle.contentStyle}
              formatter={(v: number | undefined) => fmt(v ?? 0)}
            />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ════════════════════════════════
   ComparisonChart
════════════════════════════════ */
function ComparisonChart({ cmp, primary }: { cmp: ComparisonData; primary: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", margin: "0 0 10px" }}>
        Comparaison — {cmp.metric}
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={cmp.data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" {...axisProps} tickFormatter={(v) => String(v).slice(0, 10)} />
          <YAxis {...axisProps} tickFormatter={fmt} width={45} />
          <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => fmt(v ?? 0)} />
          <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
          <Bar dataKey={cmp.keys[0]} fill={primary} radius={[3, 3, 0, 0]} maxBarSize={30} />
          <Bar dataKey={cmp.keys[1]} fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ════════════════════════════════
   DataVizModal — main
════════════════════════════════ */
type Props = { documents: DocFile[]; primary: string; onClose: () => void };

export default function DataVizModal({ documents, primary, onClose }: Props) {
  const [insights, setInsights] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  /* Parse each file */
  const analyses = documents.map((doc) => {
    const isCSV =
      doc.name.toLowerCase().endsWith(".csv") ||
      doc.name.toLowerCase().endsWith(".tsv") ||
      isLikelyCSV(doc.text);
    return { ...doc, isCSV, parsed: isCSV ? parseCSV(doc.text) : null };
  });

  const csvDocs = analyses.filter((a) => a.isCSV && a.parsed);
  const chart1 = csvDocs[0]?.parsed ? prepareChart(csvDocs[0].parsed) : null;
  const chart2 = csvDocs[1]?.parsed ? prepareChart(csvDocs[1].parsed) : null;
  const cmp =
    csvDocs.length === 2 && csvDocs[0].parsed && csvDocs[1].parsed
      ? prepareComparison(csvDocs[0].parsed, csvDocs[1].parsed, csvDocs[0].name, csvDocs[1].name)
      : null;

  /* AI analysis */
  const launchAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setInsights("");
    setHasAnalyzed(true);

    const summarize = (a: (typeof analyses)[0]) => {
      if (!a.isCSV || !a.parsed) {
        return `**${a.name}** (${a.name.endsWith(".pdf") ? "PDF" : "Texte"})\nExtrait :\n${a.text.slice(0, 600)}`;
      }
      const { headers, rows, numericCols } = a.parsed;
      const stats = numericCols
        .map((col) => {
          const vals = rows
            .map((r) => parseFloat(r[col].replace(/[\s,]/g, "")))
            .filter((v) => !isNaN(v));
          if (!vals.length) return null;
          const sum = vals.reduce((a, b) => a + b, 0);
          return `  ${col}: min=${fmt(Math.min(...vals))}, max=${fmt(Math.max(...vals))}, moy=${fmt(sum / vals.length)}`;
        })
        .filter(Boolean)
        .join("\n");
      return `**${a.name}** — ${rows.length} lignes | Colonnes : ${headers.join(", ")}\nStatistiques :\n${stats}\nPremières lignes :\n${rows.slice(0, 3).map((r) => Object.values(r).slice(0, 5).join(" | ")).join("\n")}`;
    };

    const isSingle = analyses.length === 1;
    const prompt = isSingle
      ? `Tu es un expert en analyse de données et business intelligence.

Voici un fichier à analyser :

---
${summarize(analyses[0])}
---

Fournis une analyse structurée :
1. **Description** du fichier (nature des données, période si applicable)
2. **Statistiques clés** (chiffres importants à retenir)
3. **Insights et tendances** (patterns, anomalies, points d'attention)
4. **Recommandations** concrètes et actionnables

Réponds en français, de manière structurée et professionnelle.`
      : `Tu es un expert en analyse de données et business intelligence.

Voici deux fichiers à analyser et comparer :

---
${summarize(analyses[0])}

---
${summarize(analyses[1])}

---

Fournis une analyse structurée :
1. **Description** de chaque fichier (nature des données, période si applicable)
2. **Statistiques clés** (chiffres importants)
3. **Comparaison et corrélations** entre les deux fichiers
4. **Insights et anomalies** (tendances, écarts, points d'attention)
5. **Recommandations** concrètes et actionnables

Réponds en français, de manière structurée et professionnelle.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(part.slice(6));
            if (ev.type === "text") setInsights((p) => p + ev.text);
          } catch { /* noop */ }
        }
      }
    } catch {
      setInsights("Erreur lors de l'analyse. Veuillez réessayer.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyses]);

  const hasCharts = csvDocs.length > 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "#090a0f", display: "flex", flexDirection: "column",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
          padding: "14px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(10,11,18,0.9)",
        }}
      >
        <span style={{ fontSize: 18 }}>📊</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#e8eaf0", fontWeight: 600, fontSize: 15, margin: 0 }}>
            {documents.length === 1 ? "Analyse du fichier" : "Analyse comparative"}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
            {documents.map((d, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11, padding: "1px 8px", borderRadius: 999,
                  background: i === 0 ? hexToRgba(primary, 0.15) : "rgba(6,182,212,0.12)",
                  color: i === 0 ? primary : ACCENT,
                  border: `1px solid ${i === 0 ? hexToRgba(primary, 0.3) : "rgba(6,182,212,0.25)"}`,
                }}
              >
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Launch analysis button */}
        <button
          onClick={launchAnalysis}
          disabled={isAnalyzing}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: isAnalyzing ? "not-allowed" : "pointer",
            background: isAnalyzing ? "rgba(255,255,255,0.06)" : primary,
            color: isAnalyzing ? "rgba(255,255,255,0.4)" : "#fff",
            fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {isAnalyzing ? (
            <><IconSpinner />Analyse en cours…</>
          ) : (
            <>{hasAnalyzed ? "🔄 Relancer" : "🤖 Lancer l'analyse IA"}</>
          )}
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)",
            cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >✕</button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left — Charts */}
        <div
          style={{
            width: "55%", flexShrink: 0, overflowY: "auto", padding: "24px",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent",
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", margin: "0 0 20px" }}>
            Visualisation
          </p>

          {!hasCharts ? (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                height: 200, gap: 8,
              }}
            >
              <span style={{ fontSize: 32 }}>📄</span>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center" }}>
                Les graphiques sont disponibles pour les fichiers CSV.<br />
                Lance l&apos;analyse IA pour comparer les contenus textuels.
              </p>
            </div>
          ) : (
            <>
              {chart1 && (
                <SingleChart
                  chart={chart1}
                  primary={primary}
                  title={csvDocs[0].name.replace(/\.[^.]+$/, "")}
                />
              )}
              {chart2 && (
                <SingleChart
                  chart={chart2}
                  primary={ACCENT}
                  title={csvDocs[1].name.replace(/\.[^.]+$/, "")}
                />
              )}
              {cmp && <ComparisonChart cmp={cmp} primary={primary} />}
              {!cmp && csvDocs.length === 2 && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 8 }}>
                  Aucune colonne commune trouvée pour la comparaison directe.
                </p>
              )}
            </>
          )}
        </div>

        {/* Right — AI Insights */}
        <div
          style={{
            flex: 1, overflowY: "auto", padding: "24px",
            scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent",
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", margin: "0 0 20px" }}>
            Insights IA
          </p>

          {!hasAnalyzed && !isAnalyzing ? (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                height: "60%", gap: 12, textAlign: "center",
              }}
            >
              <span style={{ fontSize: 40 }}>🤖</span>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, maxWidth: 260 }}>
                Clique sur &quot;Lancer l&apos;analyse IA&quot; pour obtenir une comparaison détaillée, des statistiques clés et des recommandations.
              </p>
            </div>
          ) : isAnalyzing && insights === "" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              <IconSpinner />Analyse en cours…
            </div>
          ) : (
            <SimpleMarkdown text={insights} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Spinner ── */
function IconSpinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
