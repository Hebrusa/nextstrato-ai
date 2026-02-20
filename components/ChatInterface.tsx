"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ConfigPanel, { Config, DEFAULT_CONFIG } from "./ConfigPanel";
import AgentDocPanel from "./AgentDocPanel";
import DataVizModal, { DocFile } from "./DataVizModal";
import KnowledgeBasePanel, { KBDoc } from "./KnowledgeBasePanel";

/* ── Color helpers ── */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
      `Tu es Strato, l'Agent DAF de NextStrato. Tu es un expert en finance d'entreprise spécialisé dans l'automatisation et l'analyse du cycle de clôture mensuel.

TON RÔLE PRINCIPAL : Éliminer les 2 à 5 jours perdus chaque mois par les équipes Finance à "mettre en forme" l'information. Tu automatises le cycle mensuel complet : extraction et consolidation des données (SAP, Sage, Pennylane, Excel, CSV), calcul des écarts vs budget et vs N-1, génération des commentaires explicatifs, et alimentation du dashboard temps réel.

CE QUE TU SAIS FAIRE :
- Consolider automatiquement multi-entités, harmoniser les plans comptables, reconstruire P&L consolidé, calculer cash-flow et BFR
- Analyser les écarts ligne par ligne : écart en valeur et en %, identifier les causes probables, générer des commentaires prêts pour le COMEX (ex : "La marge brute diminue de 4,2% vs budget, principalement liée à une hausse des coûts matières sur la BU Industrie (+8%).")
- Détecter automatiquement : variations anormales, dérives de marge, surcoûts par centre de profit, tensions de trésorerie
- Structurer le tableau de bord financier en 4 blocs : Performance financière (CA, marge brute, EBITDA, résultat net) / Cash & trésorerie (position, prévision 3 mois, BFR, DSO/DPO) / Analyse des écarts (Top 5 variations, alertes) / Vue multi-entités (filiales, BU, consolidation groupe)

TON POSITIONNEMENT : Tu permets au DAF de passer de "produire le reporting" à "analyser et piloter". Gain attendu : 2 à 3 jours récupérés par mois, zéro manipulation manuelle, pilotage stratégique centré sur les arbitrages et l'anticipation.

Réponds en français, de manière précise, chiffrée et directement actionnable. Quand l'utilisateur partage des données (CSV, Excel), analyse-les immédiatement avec des chiffres concrets.`,
    suggestions: [
      "Analyse les écarts de ma clôture mensuelle",
      "Génère un commentaire COMEX sur mes résultats",
      "Détecte les dérives de marge dans mes données",
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
      "Préparer RDV prospect / client",
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

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  agentId: string | null;
};

const LS_KEY = "nextstrato-config";
const LS_HISTORY_KEY = "nextstrato-conversations";
const LS_KB_KEY = "nextstrato-kb";
const LS_AGENT_DOCS_KEY = "nextstrato-agent-docs-v1";
const MAX_SAVED_CONVERSATIONS = 30;

function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 7 * 86_400_000) return `Il y a ${Math.floor(diff / 86_400_000)} j`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

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

  /* ── Conversation history ── */
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(LS_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  /* ── Knowledge Base ── */
  const [knowledgeBase, setKnowledgeBase] = useState<KBDoc[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(LS_KB_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showKB, setShowKB] = useState(false);

  const addKBDoc = useCallback((doc: KBDoc) => {
    setKnowledgeBase((prev) => {
      const updated = [...prev, doc];
      try { localStorage.setItem(LS_KB_KEY, JSON.stringify(updated)); } catch { /* noop */ }
      return updated;
    });
  }, []);

  const removeKBDoc = useCallback((id: string) => {
    setKnowledgeBase((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      try { localStorage.setItem(LS_KB_KEY, JSON.stringify(updated)); } catch { /* noop */ }
      return updated;
    });
  }, []);

  /* ── UI state ── */
  const [showConfig, setShowConfig] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: "init", role: "assistant", content: config.welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentDocs, setAgentDocs] = useState<Record<string, DocFile[]>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem(LS_AGENT_DOCS_KEY); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  });
  const agentDocsRef = useRef(agentDocs);
  useEffect(() => { agentDocsRef.current = agentDocs; }, [agentDocs]);

  const agentKey = activeAgent?.id ?? "general";
  const documents = agentDocs[agentKey] ?? [];

  const updateDocsForAgent = (key: string, docs: DocFile[]) => {
    setAgentDocs((prev) => {
      const next = { ...prev, [key]: docs };
      try { localStorage.setItem(LS_AGENT_DOCS_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };

  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDataViz, setShowDataViz] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

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

  /* ── Save conversation ── */
  const saveConversation = useCallback((msgs: Message[]) => {
    const firstUserMsg = msgs.find((m) => m.role === "user");
    if (!firstUserMsg) return;
    const title = firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? "…" : "");
    setConversations((prev) => {
      const existingId = currentConversationIdRef.current;
      let updated: Conversation[];
      if (existingId && prev.find((c) => c.id === existingId)) {
        updated = prev.map((c) =>
          c.id === existingId
            ? { ...c, messages: msgs, updatedAt: Date.now(), agentId: activeAgentRef.current?.id ?? null }
            : c
        );
      } else {
        const newConv: Conversation = {
          id: `conv-${Date.now()}`,
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: msgs,
          agentId: activeAgentRef.current?.id ?? null,
        };
        currentConversationIdRef.current = newConv.id;
        setCurrentConversationId(newConv.id);
        updated = [newConv, ...prev].slice(0, MAX_SAVED_CONVERSATIONS);
      }
      try { localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(updated)); } catch { /* noop */ }
      return updated;
    });
  }, []);

  /* ── Load conversation ── */
  const loadConversation = useCallback((conv: Conversation) => {
    setMessages(conv.messages);
    setCurrentConversationId(conv.id);
    currentConversationIdRef.current = conv.id;
    const agent = AGENTS.find((a) => a.id === conv.agentId) ?? null;
    setActiveAgent(agent);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  /* ── Delete conversation ── */
  const deleteConversation = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      try { localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(updated)); } catch { /* noop */ }
      return updated;
    });
    if (currentConversationIdRef.current === id) {
      setMessages([{ id: "init", role: "assistant", content: configRef.current.welcomeMessage }]);
      setCurrentConversationId(null);
      currentConversationIdRef.current = null;
    }
  }, []);

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
      let data: { text?: string; name?: string; error?: string };
      try { data = await res.json(); }
      catch { setUploadError(`Erreur serveur (${res.status}) — réponse invalide. Réessayez.`); return; }
      if (!res.ok || data.error) {
        setUploadError(data.error ?? `Erreur ${res.status} lors du traitement du fichier.`);
      } else if (data.text) {
        const key = activeAgentRef.current?.id ?? "general";
        const cur = agentDocsRef.current[key] ?? [];
        updateDocsForAgent(key, [...cur, { name: data.name ?? file.name, text: data.text! }].slice(-5));
      } else {
        setUploadError("Le fichier semble vide ou illisible.");
      }
    } catch {
      setUploadError("Impossible de joindre le serveur. Vérifiez votre connexion.");
    } finally {
      setIsParsingDoc(false);
      e.target.value = "";
    }
  };
  const removeDocument = (agentId: string, index: number) => {
    const cur = agentDocsRef.current[agentId] ?? [];
    updateDocsForAgent(agentId, cur.filter((_, i) => i !== index));
  };

  /* ── Send message ── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: text.trim() };
    const assistantId = `assistant-${Date.now() + 1}`;
    streamingIdRef.current = assistantId;
    const assistantMessage: Message = { id: assistantId, role: "assistant", content: "" };
    const apiMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

    const basePrompt = activeAgentRef.current?.systemPrompt ?? configRef.current.systemPrompt;
    const kbContext = knowledgeBase.length > 0
      ? knowledgeBase.map((d, i) => `Document ${i + 1} — "${d.name}" :\n\n${d.text}`).join("\n\n---\n\n")
      : null;
    const currentDocs = agentDocsRef.current[activeAgentRef.current?.id ?? "general"] ?? [];
    const docContext = currentDocs.length > 0
      ? currentDocs.map((d, i) => `Document ${i + 1} — "${d.name}" :\n\n${d.text}`).join("\n\n---\n\n")
      : null;
    const effectiveSystemPrompt = [
      basePrompt,
      kbContext ? `\n\nBase de connaissances (documents permanents disponibles) :\n\n${kbContext}\n\nUtilise ces documents comme référence fiable pour répondre aux questions.` : null,
      docContext ? `\n\nDocuments joints à cette conversation :\n\n${docContext}\n\nUtilise ces documents pour répondre aux questions si c'est pertinent.` : null,
    ].filter(Boolean).join("");

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
      saveConversation(messagesRef.current);
    }
  }, [messages, isStreaming, knowledgeBase, saveConversation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 128) + "px";
  };

  const startNewConversation = useCallback(() => {
    setMessages([{ id: "init", role: "assistant", content: configRef.current.welcomeMessage }]);
    setCurrentConversationId(null);
    currentConversationIdRef.current = null;
    setInput("");
    setActiveAgent(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  const clearConversation = () => { startNewConversation(); };

  /* ── Download as PDF ── */
  const downloadConversationPDF = useCallback(() => {
    const conversationMessages = messages.filter((m) => !(m.id === "init" && m.role === "assistant"));
    if (conversationMessages.length === 0) return;
    const agentName = activeAgent ? activeAgent.fullName : config.agentName;
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const rows = conversationMessages.map((m) => {
      const isUser = m.role === "user";
      return `<div class="message ${isUser ? "user" : "assistant"}">
        <div class="label">${isUser ? "Vous" : agentName}</div>
        <div class="bubble">${m.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</div>
      </div>`;
    }).join("");
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>${config.platformName} — Conversation</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #0F0F18; background: #fff; padding: 32px 40px; }
header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #E4E4EF; padding-bottom: 16px; margin-bottom: 24px; }
header h1 { font-size: 18px; font-weight: 700; color: #0F0F18; }
header span { font-size: 11px; color: #71718A; }
.message { margin-bottom: 18px; }
.label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
.user .label { color: #4F6EF7; text-align: right; }
.assistant .label { color: #71718A; }
.bubble { padding: 12px 16px; border-radius: 12px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.user .bubble { background: #4F6EF7; color: #fff; border-radius: 16px 4px 16px 16px; margin-left: auto; max-width: 80%; }
.assistant .bubble { background: #F5F5FA; color: #0F0F18; border-radius: 4px 16px 16px 16px; max-width: 80%; border: 1px solid #E4E4EF; }
footer { margin-top: 32px; border-top: 1px solid #E4E4EF; padding-top: 12px; font-size: 10px; color: #71718A; text-align: center; }
</style></head><body>
<header><h1>${config.platformName}</h1><span>Exporté le ${dateStr}</span></header>
${rows}
<footer>🔒 Données confidentielles — ${config.platformName}</footer>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }, [messages, activeAgent, config]);

  const activeSuggestions = activeAgent ? activeAgent.suggestions : DEFAULT_SUGGESTIONS;
  const showSuggestions = messages.length === 1 && !isStreaming;
  const displayAgentName = activeAgent ? activeAgent.name : config.agentName;

  return (
    <div className="flex h-screen" style={{ background: config.backgroundColor, color: "#0F0F18" }}>

      {showConfig && <ConfigPanel config={config} onChange={updateConfig} onClose={() => setShowConfig(false)} onReset={resetConfig} />}
      {showDataViz && documents.length >= 1 && <DataVizModal documents={documents} primary={primary} onClose={() => setShowDataViz(false)} />}
      {showKB && <KnowledgeBasePanel docs={knowledgeBase} primary={primary} onAdd={addKBDoc} onRemove={removeKBDoc} onClose={() => setShowKB(false)} />}

      {/* ════ SIDEBAR ════ */}
      <aside style={{ width: 232, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid #E4E4EF", background: "#FFFFFF", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.08) transparent" }}>

        <div style={{ padding: "12px 8px 4px" }}>
          <button
            onClick={startNewConversation}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: `1px solid ${hexToRgba(primary, 0.3)}`, background: hexToRgba(primary, 0.06), color: primary, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(primary, 0.12); e.currentTarget.style.borderColor = hexToRgba(primary, 0.5); }}
            onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(primary, 0.06); e.currentTarget.style.borderColor = hexToRgba(primary, 0.3); }}
          >
            <IconPlus className="w-4 h-4" /> Nouvelle conversation
          </button>
        </div>

        <div style={{ padding: "14px 14px 6px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#71718A", margin: 0 }}>Agents spécialisés</p>
        </div>
        <div style={{ padding: "0 8px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {AGENTS.map((agent) => (
            <AgentCard key={agent.id} agent={agent} isSelected={activeAgent?.id === agent.id} primary={primary} onClick={() => handleSelectAgent(agent)} />
          ))}
        </div>

        {conversations.length > 0 && (
          <>
            <div style={{ margin: "0 8px", borderTop: "1px solid #E4E4EF" }} />
            <div style={{ padding: "14px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#71718A", margin: 0 }}>Historique</p>
              <span style={{ fontSize: 10, color: "#71718A", fontWeight: 500 }}>{conversations.length}</span>
            </div>
            <div style={{ padding: "0 8px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
              {conversations.map((conv) => {
                const isActive = conv.id === currentConversationId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${isActive ? hexToRgba(primary, 0.3) : "#E4E4EF"}`, borderLeft: `3px solid ${isActive ? primary : "transparent"}`, background: isActive ? hexToRgba(primary, 0.06) : "transparent", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6, transition: "all 0.12s" }}
                    onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = hexToRgba(primary, 0.05); (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(primary, 0.2); } }}
                    onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "#E4E4EF"; } }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: isActive ? "#0F0F18" : "rgba(0,0,0,0.6)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>{conv.title}</p>
                      <p style={{ fontSize: 10, color: "#71718A", margin: "2px 0 0", lineHeight: 1 }}>
                        {conv.agentId ? AGENTS.find((a) => a.id === conv.agentId)?.name + " · " : ""}
                        {formatRelativeDate(conv.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      title="Supprimer"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,0,0,0.25)", padding: "2px 3px", borderRadius: 4, lineHeight: 1, flexShrink: 0, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#dc2626"; (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.25)"; (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <IconTrash className="w-3 h-3" />
                    </button>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: "auto", padding: "12px 14px 16px" }}>
          <p style={{ fontSize: 11, color: "#71718A", lineHeight: 1.5, margin: 0 }}>
            Sélectionnez un agent pour adapter le prompt et les suggestions.
          </p>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex flex-col flex-1 min-w-0">

        <header style={{ background: "rgba(255,255,255,0.92)", borderBottom: "1px solid #E4E4EF", backdropFilter: "blur(12px)" }} className="flex items-center justify-between px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div style={{ background: primary }} className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
              {config.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={config.logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <IconBolt className="w-5 h-5 text-white" />}
            </div>
            <div>
              <p className="text-base font-semibold leading-none tracking-tight" style={{ fontFamily: "var(--font-syne)", color: "#0F0F18" }}>{config.platformName}</p>
              <p className="text-xs mt-0.5" style={{ color: "#71718A" }}>Plateforme d&apos;intelligence opérationnelle</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: hexToRgba(primary, 0.08), border: `1px solid ${hexToRgba(primary, 0.2)}` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: primary }} />
              <span className="text-sm font-medium" style={{ color: primary }}>{displayAgentName}</span>
            </div>

            <button
              onClick={() => documents.length >= 1 && setShowDataViz(true)}
              title={documents.length === 0 ? "Chargez un fichier CSV/Excel pour analyser" : "Analyser les graphiques"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: documents.length >= 1 ? primary : "#F5F5FA", border: `1px solid ${documents.length >= 1 ? primary : "#E4E4EF"}`, color: documents.length >= 1 ? "#fff" : "#71718A", cursor: documents.length >= 1 ? "pointer" : "not-allowed", transition: "all 0.15s", opacity: documents.length >= 1 ? 1 : 0.7 }}
              onMouseEnter={(e) => { if (documents.length >= 1) e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { if (documents.length >= 1) e.currentTarget.style.opacity = "1"; }}
            >
              📊 <span>Analyser</span>
            </button>

            <button
              onClick={() => setShowKB((v) => !v)}
              title="Base de connaissances"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: showKB || knowledgeBase.length > 0 ? hexToRgba(primary, 0.08) : "#F5F5FA", border: `1px solid ${showKB || knowledgeBase.length > 0 ? hexToRgba(primary, 0.3) : "#E4E4EF"}`, color: showKB || knowledgeBase.length > 0 ? primary : "#71718A", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(primary, 0.12); e.currentTarget.style.borderColor = hexToRgba(primary, 0.4); e.currentTarget.style.color = primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = showKB || knowledgeBase.length > 0 ? hexToRgba(primary, 0.08) : "#F5F5FA"; e.currentTarget.style.borderColor = showKB || knowledgeBase.length > 0 ? hexToRgba(primary, 0.3) : "#E4E4EF"; e.currentTarget.style.color = showKB || knowledgeBase.length > 0 ? primary : "#71718A"; }}
            >
              📚 <span>Base</span>
              {knowledgeBase.length > 0 && (
                <span style={{ background: primary, color: "#fff", borderRadius: "999px", padding: "0 5px", fontSize: 10, fontWeight: 700, lineHeight: "16px" }}>{knowledgeBase.length}</span>
              )}
            </button>

            <button
              onClick={downloadConversationPDF}
              disabled={messages.length <= 1}
              title="Télécharger la conversation en PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: messages.length > 1 ? hexToRgba(primary, 0.06) : "#F5F5FA", border: `1px solid ${messages.length > 1 ? hexToRgba(primary, 0.25) : "#E4E4EF"}`, color: messages.length > 1 ? primary : "#71718A", cursor: messages.length > 1 ? "pointer" : "not-allowed", transition: "all 0.15s", opacity: messages.length > 1 ? 1 : 0.5 }}
              onMouseEnter={(e) => { if (messages.length > 1) { e.currentTarget.style.background = hexToRgba(primary, 0.12); e.currentTarget.style.borderColor = hexToRgba(primary, 0.4); } }}
              onMouseLeave={(e) => { if (messages.length > 1) { e.currentTarget.style.background = hexToRgba(primary, 0.06); e.currentTarget.style.borderColor = hexToRgba(primary, 0.25); } }}
            >
              <IconDownload className="w-3.5 h-3.5" /><span>PDF</span>
            </button>

            <button
              onClick={() => setShowConfig((v) => !v)}
              title="Configuration"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ color: showConfig ? primary : "#71718A", background: showConfig ? hexToRgba(primary, 0.08) : "transparent", border: showConfig ? `1px solid ${hexToRgba(primary, 0.2)}` : "1px solid transparent" }}
              onMouseEnter={(e) => { if (!showConfig) { e.currentTarget.style.background = "#F5F5FA"; e.currentTarget.style.color = "#0F0F18"; } }}
              onMouseLeave={(e) => { if (!showConfig) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71718A"; } }}
            >
              <IconGear className="w-4 h-4" />
            </button>

            <button
              onClick={clearConversation}
              title="Nouvelle conversation"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ color: "#71718A", background: "transparent", border: "1px solid transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F5F5FA"; e.currentTarget.style.color = "#0F0F18"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71718A"; }}
            >
              <IconTrash className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.08) transparent" }}>
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} isCurrentlyStreaming={isStreaming && msg.id === streamingIdRef.current} primary={primary} />
            ))}
            {showSuggestions && (
              <div className="pt-4">
                <p className="text-xs text-center mb-3" style={{ color: "#71718A" }}>
                  {activeAgent ? `Cas d'usage — ${activeAgent.name}` : "Suggestions"}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {activeSuggestions.map((s) => (
                    <button key={s}
                      onClick={() => sendMessage(s)}
                      className="px-4 py-2 rounded-full text-sm transition-all"
                      style={{ border: `1px solid ${hexToRgba(primary, 0.3)}`, background: hexToRgba(primary, 0.05), color: primary }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(primary, 0.12); e.currentTarget.style.borderColor = hexToRgba(primary, 0.5); }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(primary, 0.05); e.currentTarget.style.borderColor = hexToRgba(primary, 0.3); }}
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

        <div className="px-4 pb-6 pt-2 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.csv,.tsv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <div className="flex items-end gap-3 rounded-2xl px-4 py-3"
              style={{ background: "#F5F5FA", border: "1px solid #E4E4EF" }}
              onFocusCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = hexToRgba(primary, 0.45))}
              onBlurCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "#E4E4EF")}
            >
              <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onInput={handleInput}
                placeholder={activeAgent ? `Posez votre question au ${activeAgent.name}…` : `Posez votre question à ${config.agentName}…`}
                rows={1} disabled={isStreaming}
                className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed"
                style={{ color: "#0F0F18", caretColor: primary, maxHeight: "128px", overflowY: "auto" }}
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: input.trim() && !isStreaming ? primary : hexToRgba(primary, 0.2), opacity: !input.trim() || isStreaming ? 0.5 : 1, cursor: !input.trim() || isStreaming ? "not-allowed" : "pointer" }}
              >
                <IconArrowUp className="w-4 h-4 text-white" />
              </button>
            </div>

            <p className="text-center text-xs mt-2.5" style={{ color: "#71718A" }}>
              Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-center py-2 px-4" style={{ borderTop: "1px solid #E4E4EF", background: "#ffffff" }}>
          <span style={{ fontSize: 12, color: "#71718A", fontWeight: 500, letterSpacing: "0.01em" }}>
            🔒 Vos données ne quittent pas l&apos;Europe · Non utilisées pour entraîner l&apos;IA
          </span>
        </div>
      </div>

      <AgentDocPanel
        agents={AGENTS.map((a) => ({ id: a.id, name: a.name }))}
        activeAgentId={activeAgent?.id ?? null}
        agentDocs={agentDocs}
        primary={primary}
        isUploading={isParsingDoc}
        uploadError={uploadError}
        onUpload={() => fileInputRef.current?.click()}
        onRemove={removeDocument}
        onClearError={() => setUploadError(null)}
        onAnalyze={() => setShowDataViz(true)}
      />
    </div>
  );
}

/* ════ AgentCard ════ */
function AgentCard({ agent, isSelected, primary, onClick }: { agent: Agent; isSelected: boolean; primary: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", padding: "12px 10px", borderRadius: 10, border: `1px solid ${isSelected ? hexToRgba(primary, 0.35) : "#E4E4EF"}`, borderLeft: `3px solid ${isSelected ? primary : "transparent"}`, background: isSelected ? hexToRgba(primary, 0.06) : "transparent", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
      onMouseEnter={(e) => { if (!isSelected) { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "#C5C5D5"; } }}
      onMouseLeave={(e) => { if (!isSelected) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "#E4E4EF"; } }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: isSelected ? hexToRgba(primary, 0.12) : "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: isSelected ? primary : "#71718A" }}>{agent.icon}</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: isSelected ? "#0F0F18" : "rgba(0,0,0,0.7)", fontWeight: 600, fontSize: 13, margin: 0 }}>{agent.name}</p>
          <p style={{ color: "#71718A", fontSize: 10, margin: "1px 0 0", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.fullName}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {agent.suggestions.slice(0, 3).map((s, i) => (
          <p key={i} style={{ fontSize: 11, color: isSelected ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.3)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>· {s}</p>
        ))}
      </div>
    </button>
  );
}

/* ════ MessageBubble ════ */
function MessageBubble({ msg, isCurrentlyStreaming, primary }: { msg: Message; isCurrentlyStreaming: boolean; primary: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: hexToRgba(primary, 0.1), border: `1px solid ${hexToRgba(primary, 0.2)}` }}>
          <IconBolt className="w-4 h-4" style={{ color: primary }} />
        </div>
      )}
      <div className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={isUser
          ? { background: primary, color: "#fff", borderRadius: "18px 4px 18px 18px", boxShadow: `0 2px 16px ${hexToRgba(primary, 0.25)}` }
          : { background: "#FFFFFF", border: "1px solid #E4E4EF", color: "#0F0F18", borderRadius: "4px 18px 18px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }
        }
      >
        {isCurrentlyStreaming && msg.content === "" ? <TypingIndicator primary={primary} /> : <p className="whitespace-pre-wrap">{msg.content}</p>}
      </div>
    </div>
  );
}

function TypingIndicator({ primary }: { primary: string }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="block w-1.5 h-1.5 rounded-full" style={{ background: primary, animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

/* ════ Icons ════ */
function IconBolt({ className, style }: { className?: string; style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>; }
function IconTrash({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>; }
function IconArrowUp({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>; }
function IconPaperclip({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>; }
function IconSpinner({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>; }
function IconGear({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>; }
function IconPlus({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>; }
function IconDownload({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function IconChartBar({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="9" /><rect x="10" y="7" width="4" height="14" /><rect x="17" y="3" width="4" height="18" /></svg>; }
function IconUsers({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function IconTrendingUp({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>; }
function IconLayers({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>; }
