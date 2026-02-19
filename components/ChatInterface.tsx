"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ConfigPanel, { Config, DEFAULT_CONFIG } from "./ConfigPanel";
import DataVizModal, { DocFile } from "./DataVizModal";

/* ── Color helpers ── */
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

/* ── Agents ── */
type Agent = {
  id: string;
  name: string;
  fullName: string;
  icon: React.ReactNode;
  systemPrompt: string;
  suggestions: string[];
};

const AGENTS: Agent[] = [
  {
    id: "daf",
    name: "DAF",
    fullName: "Directeur Admin. & Financier",
    icon: <IconChartBar className="w-4 h-4" />,
    systemPrompt:
      "Tu es Strato, un assistant IA expert en finance d'entreprise pour NextStrato. Tu accompagnes les Directeurs Administratifs et Financiers dans leurs missions : analyse de trésorerie, élaboration de budgets, reporting financier, gestion des risques et optimisation fiscale. Tu fournis des analyses chiffrées, des recommandations stratégiques et des modèles financiers adaptés. Réponds en français, de manière précise, structurée et professionnelle.",
    suggestions: [
      "Analyse ma trésorerie du trimestre",
      "Prépare un budget prévisionnel",
      "Quels KPIs financiers surveiller ?",
      "Aide-moi pour la clôture comptable",
    ],
  },
  {
    id: "drh",
    name: "DRH",
    fullName: "Directeur des Ressources Humaines",
    icon: <IconUsers className="w-4 h-4" />,
    systemPrompt:
      "Tu es Strato, un assistant IA expert en ressources humaines pour NextStrato. Tu accompagnes les Directeurs RH dans leurs missions : recrutement, gestion des talents, politique salariale, plan de formation, conformité légale et dialogue social. Tu proposes des pratiques RH concrètes, des modèles de documents et des recommandations adaptées au contexte de l'entreprise. Réponds en français, de manière bienveillante, structurée et professionnelle.",
    suggestions: [
      "Optimiser ma politique salariale",
      "Construire un plan de formation annuel",
      "Stratégie de rétention des talents",
      "Points de vigilance droit du travail",
    ],
  },
  {
    id: "commerce",
    name: "Commerce",
    fullName: "Directeur Commercial",
    icon: <IconTrendingUp className="w-4 h-4" />,
    systemPrompt:
      "Tu es Strato, un assistant IA expert en développement commercial pour NextStrato. Tu accompagnes les Directeurs Commerciaux dans leurs missions : stratégie de vente, gestion du pipeline, acquisition et fidélisation clients, pilotage des équipes et prévisions de revenus. Tu proposes des analyses de performance, des stratégies de croissance et des outils de pilotage commercial. Réponds en français, de manière dynamique, orientée résultats et professionnelle.",
    suggestions: [
      "Analyse mon pipeline de ventes",
      "Stratégie d'acquisition nouveaux clients",
      "Prévisions commerciales Q4",
      "Optimiser mes offres et propositions",
    ],
  },
  {
    id: "operations",
    name: "Opération",
    fullName: "Directeur des Opérations",
    icon: <IconLayers className="w-4 h-4" />,
    systemPrompt:
      "Tu es Strato, un assistant IA expert en management des opérations pour NextStrato. Tu accompagnes les Directeurs des Opérations dans leurs missions : optimisation des processus, gestion de la supply chain, pilotage de la production, amélioration continue et gestion des risques opérationnels. Tu proposes des analyses de performance, des plans d'action concrets et des indicateurs de suivi. Réponds en français, de manière structurée, orientée terrain et professionnelle.",
    suggestions: [
      "Optimiser mes processus internes",
      "Analyse de ma supply chain",
      "Indicateurs de performance opérationnelle",
      "Plan d'amélioration continue",
    ],
  },
];

const DEFAULT_SUGGESTIONS = [
  "Comment optimiser mes opérations ?",
  "Analysez mes données métier",
  "Qu'est-ce que la transformation digitale ?",
  "Comment NextStrato peut m'aider ?",
];

/* ── Types ── */
type Message = { id: string; role: "user" | "assistant"; content: string };

const LS_KEY = "nextstrato-config";

export default function ChatInterface() {
  /* ── Config ── */
  const [config, setConfig] = useState<Config>(() => {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch { return DEFAULT_CONFIG; }
  });
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  const updateConfig = useCallback((updates: Partial<Config>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
  }, []);

  /* ── Active agent ── */
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const activeAgentRef = useRef<Agent | null>(null);
  useEffect(() => { activeAgentRef.current = activeAgent; }, [activeAgent]);

  const handleSelectAgent = (agent: Agent) => {
    setActiveAgent((prev) => (prev?.id === agent.id ? null : agent));
  };

  /* ── UI state ── */
  const [showConfig, setShowConfig] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: "init", role: "assistant", content: config.welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDataViz, setShowDataViz] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "init")
        return [{ ...prev[0], content: config.welcomeMessage }];
      return prev;
    });
  }, [config.welcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Colors ── */
  const primary = config.primaryColor;
  const lightPrimary = lightenColor(primary);

  /* ── File upload ── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingDoc(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
      } else if (data.text) {
        setDocuments((prev) => [...prev, { name: data.name, text: data.text }].slice(-2));
      } else {
        setUploadError("Le fichier semble vide ou illisible.");
      }
    } catch {
      setUploadError("Erreur réseau lors du chargement du fichier.");
    } finally {
      setIsParsingDoc(false);
      e.target.value = "";
    }
  };
  const removeDocument = (index: number) =>
    setDocuments((prev) => prev.filter((_, i) => i !== index));

  /* ── Send message ── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: text.trim() };
    const assistantId = `assistant-${Date.now() + 1}`;
    streamingIdRef.current = assistantId;
    const assistantMessage: Message = { id: assistantId, role: "assistant", content: "" };
    const apiMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

    const basePrompt = activeAgentRef.current?.systemPrompt ?? configRef.current.systemPrompt;
    const docs = documents;
    const docContext = docs.length > 0
      ? docs.map((d, i) => `Document ${i + 1} — "${d.name}" :\n\n${d.text}`).join("\n\n---\n\n")
      : null;
    const effectiveSystemPrompt = docContext
      ? `${basePrompt}\n\nL'utilisateur a partagé les documents suivants :\n\n${docContext}\n\nUtilise ces documents pour répondre aux questions si c'est pertinent.`
      : basePrompt;

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: effectiveSystemPrompt, messages: apiMessages }),
      });
      if (!res.ok || !res.body) throw new Error("Network error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(part.slice(6));
            if (event.type === "text")
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + event.text } : m));
            else if (event.type === "error")
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Erreur : ${event.message}` } : m));
          } catch { /* noop */ }
        }
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Une erreur est survenue. Veuillez réessayer." } : m));
    } finally {
      setIsStreaming(false);
      streamingIdRef.current = null;
    }
  }, [messages, isStreaming, documents]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 128) + "px";
  };
  const clearConversation = () => {
    setMessages([{ id: "init", role: "assistant", content: configRef.current.welcomeMessage }]);
    setInput("");
    setDocuments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const activeSuggestions = activeAgent ? activeAgent.suggestions : DEFAULT_SUGGESTIONS;
  const showSuggestions = messages.length === 1 && !isStreaming;
  const displayAgentName = activeAgent ? activeAgent.name : config.agentName;

  return (
    <div className="flex h-screen" style={{ background: config.backgroundColor, color: "#e8eaf0" }}>

      {/* ── Config Panel ── */}
      {showConfig && (
        <ConfigPanel config={config} onChange={updateConfig} onClose={() => setShowConfig(false)} onReset={resetConfig} />
      )}

      {/* ── DataViz Modal ── */}
      {showDataViz && documents.length >= 1 && (
        <DataVizModal documents={documents} primary={primary} onClose={() => setShowDataViz(false)} />
      )}

      {/* ════════════════════════════════════════
          SIDEBAR — Agents
      ════════════════════════════════════════ */}
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.06) transparent",
        }}
      >
        {/* Sidebar header */}
        <div style={{ padding: "20px 14px 10px" }}>
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.25)",
            margin: 0,
          }}>
            Agents spécialisés
          </p>
        </div>

        {/* Agent cards */}
        <div style={{ padding: "0 8px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {AGENTS.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={activeAgent?.id === agent.id}
              primary={primary}
              lightPrimary={lightPrimary}
              onClick={() => handleSelectAgent(agent)}
            />
          ))}
        </div>

        {/* Spacer + help text */}
        <div style={{ marginTop: "auto", padding: "12px 14px 16px" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", lineHeight: 1.5, margin: 0 }}>
            Sélectionnez un agent pour adapter le prompt et les suggestions.
          </p>
        </div>
      </aside>

      {/* ════════════════════════════════════════
          MAIN — Chat
      ════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Header ── */}
        <header
          style={{
            background: "rgba(10,11,18,0.85)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
          }}
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <div
              style={{ background: primary }}
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0"
            >
              {config.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <IconBolt className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p
                className="text-base font-semibold leading-none tracking-tight"
                style={{ fontFamily: "var(--font-syne)", color: "#ffffff" }}
              >
                {config.platformName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Plateforme d&apos;intelligence opérationnelle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Agent badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: hexToRgba(primary, 0.1),
                border: `1px solid ${hexToRgba(primary, 0.25)}`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: primary }} />
              <span className="text-sm font-medium" style={{ color: lightPrimary }}>
                {displayAgentName}
              </span>
            </div>

            {/* DataViz button */}
            <button
              onClick={() => documents.length >= 1 && setShowDataViz(true)}
              title={documents.length === 0 ? "Chargez un fichier CSV/Excel pour analyser" : "Analyser les graphiques"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: documents.length >= 1 ? hexToRgba(primary, 0.15) : "rgba(255,255,255,0.04)",
                border: `1px solid ${documents.length >= 1 ? hexToRgba(primary, 0.4) : "rgba(255,255,255,0.08)"}`,
                color: documents.length >= 1 ? lightPrimary : "rgba(255,255,255,0.25)",
                cursor: documents.length >= 1 ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (documents.length >= 1) e.currentTarget.style.cssText += `background:${hexToRgba(primary, 0.25)};`; }}
              onMouseLeave={(e) => { if (documents.length >= 1) e.currentTarget.style.cssText += `background:${hexToRgba(primary, 0.15)};`; }}
            >
              📊 <span>Analyser</span>
            </button>

            {/* Config button */}
            <button
              onClick={() => setShowConfig((v) => !v)}
              title="Configuration"
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                color: showConfig ? lightPrimary : "rgba(255,255,255,0.3)",
                background: showConfig ? hexToRgba(primary, 0.12) : "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.cssText += "background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);")}
              onMouseLeave={(e) => (e.currentTarget.style.cssText += showConfig
                ? `background:${hexToRgba(primary, 0.12)};color:${lightPrimary};`
                : "background:transparent;color:rgba(255,255,255,0.3);")}
            >
              <IconGear className="w-4 h-4" />
            </button>

            {/* Clear button */}
            <button
              onClick={clearConversation}
              title="Effacer la conversation"
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => (e.currentTarget.style.cssText += "background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);")}
              onMouseLeave={(e) => (e.currentTarget.style.cssText += "background:transparent;color:rgba(255,255,255,0.3);")}
            >
              <IconTrash className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Messages ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-8"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
        >
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isCurrentlyStreaming={isStreaming && msg.id === streamingIdRef.current}
                primary={primary}
                lightPrimary={lightPrimary}
              />
            ))}

            {/* Suggestions */}
            {showSuggestions && (
              <div className="pt-4">
                <p className="text-xs text-center mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {activeAgent ? `Cas d'usage — ${activeAgent.name}` : "Suggestions"}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {activeSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="px-4 py-2 rounded-full text-sm transition-all"
                      style={{
                        border: `1px solid ${hexToRgba(primary, 0.3)}`,
                        background: hexToRgba(primary, 0.05),
                        color: lightPrimary,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.cssText += `background:${hexToRgba(primary, 0.15)};border-color:${hexToRgba(primary, 0.5)};`)}
                      onMouseLeave={(e) => (e.currentTarget.style.cssText += `background:${hexToRgba(primary, 0.05)};border-color:${hexToRgba(primary, 0.3)};`)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input ── */}
        <div className="px-4 pb-6 pt-2 flex-shrink-0">
          <div className="max-w-3xl mx-auto">

            {/* Erreur upload */}
          {uploadError && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5",
                }}
              >
                ⚠ {uploadError}
              </span>
              <button
                onClick={() => setUploadError(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 11 }}
              >✕</button>
            </div>
          )}

          {/* Badges documents */}
          {documents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2 px-1">
              {documents.map((doc, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: i === 0 ? hexToRgba(primary, 0.12) : "rgba(6,182,212,0.1)",
                    border: `1px solid ${i === 0 ? hexToRgba(primary, 0.3) : "rgba(6,182,212,0.25)"}`,
                    color: i === 0 ? lightPrimary : "#06b6d4",
                  }}
                >
                  📎
                  <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.name}
                  </span>
                  <button
                    onClick={() => removeDocument(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, padding: 0, lineHeight: 1, fontSize: 11 }}
                  >✕</button>
                </span>
              ))}

              {/* Bouton Analyser dès 1 fichier */}
              {documents.length >= 1 && (
                <button
                  onClick={() => setShowDataViz(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: hexToRgba(primary, 0.15),
                    border: `1px solid ${hexToRgba(primary, 0.4)}`,
                    color: lightPrimary,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.cssText += `background:${hexToRgba(primary, 0.25)};`)}
                  onMouseLeave={(e) => (e.currentTarget.style.cssText += `background:${hexToRgba(primary, 0.15)};`)}
                >
                  📊 Analyser
                </button>
              )}
            </div>
          )}

            <div
              className="flex items-end gap-3 rounded-2xl px-4 py-3"
              style={{ background: "#13141d", border: "1px solid rgba(255,255,255,0.07)" }}
              onFocusCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = hexToRgba(primary, 0.45))}
              onBlurCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)")}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || isParsingDoc}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  color: documents.length > 0 ? lightPrimary : "rgba(255,255,255,0.25)",
                  background: documents.length > 0 ? hexToRgba(primary, 0.12) : "transparent",
                  opacity: isStreaming || isParsingDoc || documents.length >= 2 ? 0.4 : 1,
                  cursor: isStreaming || isParsingDoc || documents.length >= 2 ? "not-allowed" : "pointer",
                }}
                title={documents.length >= 2 ? "2 fichiers maximum" : "Joindre un fichier PDF, TXT ou CSV"}
                onMouseEnter={(e) => { if (!isStreaming && !isParsingDoc && documents.length < 2) e.currentTarget.style.cssText += "color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.06);"; }}
                onMouseLeave={(e) => { e.currentTarget.style.cssText += documents.length > 0 ? `color:${lightPrimary};background:${hexToRgba(primary, 0.12)};` : "color:rgba(255,255,255,0.25);background:transparent;"; }}
              >
                {isParsingDoc ? <IconSpinner className="w-4 h-4" /> : <IconPaperclip className="w-4 h-4" />}
              </button>

              <input ref={fileInputRef} type="file" accept=".pdf,.txt,.csv,.tsv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder={activeAgent ? `Posez votre question au ${activeAgent.name}…` : `Posez votre question à ${config.agentName}…`}
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed"
                style={{ color: "#e8eaf0", caretColor: primary, maxHeight: "128px", overflowY: "auto" }}
              />

              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: input.trim() && !isStreaming ? primary : hexToRgba(primary, 0.2),
                  opacity: !input.trim() || isStreaming ? 0.4 : 1,
                  cursor: !input.trim() || isStreaming ? "not-allowed" : "pointer",
                }}
              >
                <IconArrowUp className="w-4 h-4 text-white" />
              </button>
            </div>

            <p className="text-center text-xs mt-2.5" style={{ color: "rgba(255,255,255,0.15)" }}>
              Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne
            </p>
          </div>
        </div>

        {/* ── Trust banner ── */}
        <div
          className="flex-shrink-0 flex items-center justify-center py-2 px-4"
          style={{ borderTop: "1px solid #e5e7eb", background: "#ffffff" }}
        >
          <span style={{ fontSize: 12, color: "#111827", fontWeight: 500, letterSpacing: "0.01em" }}>
            🔒 Vos données ne quittent pas l&apos;Europe · Non utilisées pour entraîner l&apos;IA
          </span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   AgentCard
════════════════════════════════════════ */
function AgentCard({
  agent,
  isSelected,
  primary,
  lightPrimary,
  onClick,
}: {
  agent: Agent;
  isSelected: boolean;
  primary: string;
  lightPrimary: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 10px",
        borderRadius: 10,
        border: `1px solid ${isSelected ? hexToRgba(primary, 0.35) : "rgba(255,255,255,0.05)"}`,
        borderLeft: `3px solid ${isSelected ? primary : "transparent"}`,
        background: isSelected ? hexToRgba(primary, 0.08) : "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLElement).style.cssText +=
            "background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);";
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLElement).style.cssText +=
            "background:transparent;border-color:rgba(255,255,255,0.05);";
      }}
    >
      {/* Icon + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: isSelected ? hexToRgba(primary, 0.2) : "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: isSelected ? lightPrimary : "rgba(255,255,255,0.45)",
          }}
        >
          {agent.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: isSelected ? "#fff" : "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13, margin: 0 }}>
            {agent.name}
          </p>
          <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, margin: "1px 0 0", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {agent.fullName}
          </p>
        </div>
      </div>

      {/* Use cases */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {agent.suggestions.slice(0, 3).map((s, i) => (
          <p
            key={i}
            style={{
              fontSize: 11,
              color: isSelected ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.22)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.4,
            }}
          >
            · {s}
          </p>
        ))}
      </div>
    </button>
  );
}

/* ════════════════════════════════════════
   MessageBubble
════════════════════════════════════════ */
function MessageBubble({
  msg, isCurrentlyStreaming, primary, lightPrimary,
}: {
  msg: Message; isCurrentlyStreaming: boolean; primary: string; lightPrimary: string;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: hexToRgba(primary, 0.15), border: `1px solid ${hexToRgba(primary, 0.25)}` }}
        >
          <IconBolt className="w-4 h-4" style={{ color: lightPrimary }} />
        </div>
      )}
      <div
        className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={isUser
          ? { background: primary, color: "#ffffff", borderRadius: "18px 4px 18px 18px", boxShadow: `0 2px 16px ${hexToRgba(primary, 0.3)}` }
          : { background: "#13141d", border: "1px solid rgba(255,255,255,0.06)", color: "#d4d8f0", borderRadius: "4px 18px 18px 18px" }
        }
      >
        {isCurrentlyStreaming && msg.content === "" ? (
          <TypingIndicator lightPrimary={lightPrimary} />
        ) : (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        )}
      </div>
    </div>
  );
}

/* ── TypingIndicator ── */
function TypingIndicator({ lightPrimary }: { lightPrimary: string }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="block w-1.5 h-1.5 rounded-full" style={{ background: lightPrimary, animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   Icons
════════════════════════════════════════ */
function IconBolt({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}
function IconArrowUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function IconPaperclip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function IconSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
function IconGear({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
/* ── Agent icons ── */
function IconChartBar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" /><rect x="10" y="7" width="4" height="14" /><rect x="17" y="3" width="4" height="18" />
    </svg>
  );
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function IconLayers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
