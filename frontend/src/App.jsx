import { useRef, useState, useEffect } from "react";
import { useChatSessions } from "./useChatSessions.js";
import { useTheme } from "./useTheme.js";
import { useLanguage } from "./useLanguage.js";
import { useConcise } from "./useConcise.js";
import { streamChat } from "./streamChat.js";
import MemoryPanel from "./MemoryPanel.jsx";
import RolePicker from "./RolePicker.jsx";
import LanguagePicker from "./LanguagePicker.jsx";
import CaptureModal from "./CaptureModal.jsx";
import { extractMemoryFromExchange } from "./memoryClient.js";

function formatRelativeTime(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function getQuickPrompts(t) {
  return [
    { icon: "💡", label: t.quickExplain, prompt: "Explain " },
    { icon: "🧑‍💻", label: t.quickCode, prompt: "Write code that " },
    { icon: "📝", label: t.quickSummarize, prompt: "Summarize this: " },
    { icon: "🌐", label: t.quickTranslate, prompt: "Translate this to " },
  ];
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { languageCode, setLanguageCode, responseLanguage, t } = useLanguage();
  const { concise, toggleConcise } = useConcise();
  const QUICK_PROMPTS = getQuickPrompts(t);
  const {
    sessions,
    activeId,
    activeSession,
    setActiveId,
    createSession,
    deleteSession,
    renameSession,
    setSessionRole,
    addMessage,
    updateLastMessage,
    updateMessageAt,
    truncateMessagesTo,
  } = useChatSessions();

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("idle"); // idle | sharing | copied | error
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [learnedToast, setLearnedToast] = useState(null);
  const [captureMode, setCaptureMode] = useState(null); // null | "camera" | "screen"
  const [pendingImage, setPendingImage] = useState(null); // data URL or null
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function runAssistantTurn(sessionId, nextMessages, lastUserText) {
    let fullReply = "";
    await streamChat(nextMessages, {
      rolePrompt: activeSession?.rolePrompt ?? null,
      responseLanguage,
      concise,
      onToken: (chunk) => {
        fullReply += chunk;
        updateLastMessage(sessionId, (m) => ({
          ...m,
          content: m.content + chunk,
        }));
      },
      onDone: (totalMs) => {
        updateLastMessage(sessionId, (m) => ({ ...m, latencyMs: totalMs }));
        setIsStreaming(false);
        // Fire-and-forget: pull out anything worth remembering from
        // this exchange. Never awaited, never blocks the UI — if it
        // fails or is slow, the chat itself is unaffected.
        if (fullReply.trim()) {
          extractMemoryFromExchange(lastUserText, fullReply).then((added) => {
            if (added.length > 0) {
              setLearnedToast(added.map((m) => m.text).join(" · "));
              setTimeout(() => setLearnedToast(null), 4000);
            }
          });
        }
      },
      onError: (msg) => {
        setError(msg);
        updateLastMessage(sessionId, (m) => ({
          ...m,
          content: m.content || "(no response)",
        }));
        setIsStreaming(false);
      },
    });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    let sessionId = activeId;
    if (!sessionId) sessionId = createSession();

    setError(null);
    setInput("");
    const attachedImage = pendingImage;
    setPendingImage(null);

    const priorMessages = messages;
    const userMsg = { role: "user", content: text, image_data_url: attachedImage };
    const nextMessages = [...priorMessages, userMsg];
    addMessage(sessionId, userMsg);
    addMessage(sessionId, { role: "assistant", content: "", latencyMs: null });
    setIsStreaming(true);

    await runAssistantTurn(sessionId, nextMessages, text);
  }

  async function handleRegenerate(assistantIndex) {
    if (!activeId || isStreaming) return;
    // The user message right before this assistant reply is what we're
    // regenerating a response to. Everything from assistantIndex onward
    // (the old reply, and anything after it) gets dropped.
    const userIndex = assistantIndex - 1;
    if (userIndex < 0 || messages[userIndex]?.role !== "user") return;

    const sessionId = activeId;
    const messagesForApi = messages.slice(0, assistantIndex); // up to and including that user message
    const lastUserText = messages[userIndex].content;

    setError(null);
    truncateMessagesTo(sessionId, assistantIndex);
    addMessage(sessionId, { role: "assistant", content: "", latencyMs: null });
    setIsStreaming(true);

    await runAssistantTurn(sessionId, messagesForApi, lastUserText);
  }

  async function handleCopy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard access can fail (permissions, insecure context) —
      // silently doing nothing is preferable to throwing an error for
      // what's a minor convenience action
    }
  }

  function handleReaction(index, reaction) {
    if (!activeId) return;
    updateMessageAt(activeId, index, (m) => ({
      ...m,
      reaction: m.reaction === reaction ? null : reaction, // click again to clear
    }));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function startRename(session) {
    setEditingId(session.id);
    setEditingTitle(session.title);
  }

  async function handleShare() {
    if (!activeSession || activeSession.messages.length === 0) return;
    setShareStatus("sharing");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: activeSession.title,
          messages: activeSession.messages.map((m) => ({
            role: m.role,
            content: m.content,
            latencyMs: m.latencyMs ?? null,
          })),
        }),
      });
      if (!res.ok) throw new Error("share failed");
      const { id } = await res.json();
      const url = `${window.location.origin}/share/${id}`;
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2500);
    } catch {
      setShareStatus("error");
      setTimeout(() => setShareStatus("idle"), 2500);
    }
  }

  function commitRename() {
    if (editingId && editingTitle.trim()) {
      renameSession(editingId, editingTitle.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="app">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button
          className="new-chat-btn"
          onClick={() => {
            createSession();
            setSidebarOpen(false);
          }}
        >
          <span className="plus">+</span> {t.newChat}
        </button>

        <div className="session-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => {
                setActiveId(s.id);
                setSidebarOpen(false);
              }}
            >
              {editingId === s.id ? (
                <input
                  className="session-rename-input"
                  value={editingTitle}
                  autoFocus
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="session-text">
                    <div className="session-title">{s.title}</div>
                    <div className="session-time">
                      {formatRelativeTime(s.updatedAt)}
                    </div>
                  </div>
                  <div className="session-actions">
                    <button
                      className="icon-btn"
                      title={t.rename}
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(s);
                      }}
                    >
                      ✎
                    </button>
                    <button
                      className="icon-btn"
                      title={t.deleteChat}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="main-col">
        <header className="header">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat list"
          >
            ☰
          </button>
          <div className="brand">
            <span className="brand-mark">⚡</span>
            <span className="brand-name">groq chat</span>
          </div>
          <button
            className="theme-toggle"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb">
                {theme === "dark" ? "🌙" : "☀️"}
              </span>
            </span>
          </button>
          <LanguagePicker languageCode={languageCode} onChange={setLanguageCode} />
          <button
            className={`ghost-btn concise-toggle ${concise ? "active" : ""}`}
            onClick={toggleConcise}
            title="Prefer short, to-the-point answers"
          >
            ⚡ Concise
          </button>
          <button
            className="ghost-btn"
            onClick={() => setMemoryPanelOpen(true)}
          >
            🧠 {t.memory}
          </button>
          <button
            className="ghost-btn share-btn"
            onClick={handleShare}
            disabled={!activeSession || messages.length === 0 || shareStatus === "sharing"}
          >
            {shareStatus === "copied"
              ? t.linkCopied
              : shareStatus === "error"
              ? t.couldntShare
              : shareStatus === "sharing"
              ? t.sharing
              : t.share}
          </button>
        </header>

        <main className="thread" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="empty-state">
              <p className="empty-title">{t.emptyTitle}</p>
              <p className="empty-sub">{t.emptySub}</p>
              <div className="quick-actions">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    className="quick-action-tile"
                    onClick={() => {
                      setInput(q.prompt);
                      textareaRef.current?.focus();
                    }}
                  >
                    <span className="quick-action-icon">{q.icon}</span>
                    <span className="quick-action-label">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLastMessage = i === messages.length - 1;
            const isCompleteAssistant =
              m.role === "assistant" && m.content && !(isStreaming && isLastMessage);
            return (
              <div key={i} className={`bubble-row ${m.role}`}>
                <div className={`bubble ${m.role}`}>
                  {m.image_data_url && (
                    <img
                      src={m.image_data_url}
                      alt="Attached"
                      className="message-image"
                    />
                  )}
                  <div className="bubble-content">
                    {m.content ||
                      (isStreaming && isLastMessage ? "…" : "")}
                  </div>
                  {m.role === "assistant" && m.latencyMs != null && (
                    <div className="latency-badge" title="Time to full response">
                      {m.latencyMs} ms
                    </div>
                  )}
                  {(m.content || m.role === "user") && (
                    <div className="message-actions">
                      <button
                        className="msg-action-btn"
                        title="Copy"
                        onClick={() => handleCopy(m.content)}
                      >
                        📋
                      </button>
                      {isCompleteAssistant && (
                        <>
                          <button
                            className="msg-action-btn"
                            title="Regenerate"
                            onClick={() => handleRegenerate(i)}
                          >
                            🔄
                          </button>
                          <button
                            className={`msg-action-btn ${m.reaction === "up" ? "active" : ""}`}
                            title="Good response"
                            onClick={() => handleReaction(i, "up")}
                          >
                            👍
                          </button>
                          <button
                            className={`msg-action-btn ${m.reaction === "down" ? "active" : ""}`}
                            title="Not helpful"
                            onClick={() => handleReaction(i, "down")}
                          >
                            👎
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {error && <div className="error-banner">{error}</div>}
        </main>

        <footer className="composer">
          <div className="composer-inner">
            <div className="composer-toolbar">
              <RolePicker
                rolePrompt={activeSession?.rolePrompt ?? null}
                onChange={(prompt) =>
                  activeId && setSessionRole(activeId, prompt)
                }
              />
              <button
                type="button"
                className="composer-tool-btn"
                onClick={() => setCaptureMode("camera")}
                title="Analyze from camera"
              >
                📷
              </button>
              <button
                type="button"
                className="composer-tool-btn"
                onClick={() => setCaptureMode("screen")}
                title="Analyze screen"
              >
                🖥️
              </button>
            </div>

            {pendingImage && (
              <div className="pending-image-row">
                <img src={pendingImage} alt="Captured frame to send" />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPendingImage(null)}
                  aria-label="Remove image"
                >
                  ✕
                </button>
                <span className="pending-image-label">
                  Attached — will be sent with your next message
                </span>
              </div>
            )}
            <div className="composer-input-row">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.messagePlaceholder}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
              >
                {isStreaming ? "…" : t.send}
              </button>
            </div>
          </div>
        </footer>

        {learnedToast && (
          <div className="learned-toast">🧠 Remembered: {learnedToast}</div>
        )}
      </div>

      {memoryPanelOpen && (
        <MemoryPanel onClose={() => setMemoryPanelOpen(false)} />
      )}

      {captureMode && (
        <CaptureModal
          mode={captureMode}
          onClose={() => setCaptureMode(null)}
          onCapture={(dataUrl) => {
            setPendingImage(dataUrl);
            setCaptureMode(null);
          }}
        />
      )}
    </div>
  );
}
