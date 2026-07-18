import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "groq-chat:sessions";

function makeId() {
  return crypto.randomUUID();
}

function titleFromFirstMessage(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 42 ? clean.slice(0, 42) + "…" : clean || "New chat";
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to default below
  }
  // No saved sessions (first run, or corrupted storage) — start with
  // exactly one empty session so the app never has to juggle a
  // "no active chat" state. This lives in the initializer, not a
  // mount effect, so it can't double-fire under StrictMode.
  const now = Date.now();
  return [
    {
      id: makeId(),
      title: "New chat",
      messages: [],
      rolePrompt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Multiple saved conversations, ChatGPT-sidebar style. Each session is
 * { id, title, messages: [], createdAt, updatedAt }. Persisted as one
 * array in localStorage — fine at the scale a single person's chat
 * history reaches; if this ever needs to sync across devices, this
 * hook's internals are the only thing that'd need to change.
 */
export function useChatSessions() {
  const [initial] = useState(loadSessions);
  const [sessions, setSessions] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id ?? null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // storage unavailable — session still works for this tab's lifetime
    }
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeId) || null;

  const createSession = useCallback(() => {
    const id = makeId();
    const now = Date.now();
    setSessions((prev) => [
      { id, title: "New chat", messages: [], rolePrompt: null, createdAt: now, updatedAt: now },
      ...prev,
    ]);
    setActiveId(id);
    return id;
  }, []);

  const deleteSession = useCallback(
    (id) => {
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const now = Date.now();
        const fresh = {
          id: makeId(),
          title: "New chat",
          messages: [],
          rolePrompt: null,
          createdAt: now,
          updatedAt: now,
        };
        setSessions([fresh]);
        setActiveId(fresh.id);
        return;
      }
      setSessions(remaining);
      if (activeId === id) {
        setActiveId(remaining[0].id);
      }
    },
    [activeId, sessions]
  );

  const renameSession = useCallback((id, title) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s))
    );
  }, []);

  const setSessionRole = useCallback((id, rolePrompt) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, rolePrompt } : s))
    );
  }, []);

  const addMessage = useCallback(
    (sessionId, msg) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const isFirstUserMsg =
            s.messages.length === 0 && msg.role === "user";
          return {
            ...s,
            messages: [...s.messages, msg],
            updatedAt: Date.now(),
            title: isFirstUserMsg
              ? titleFromFirstMessage(msg.content)
              : s.title,
          };
        })
      );
    },
    []
  );

  const updateLastMessage = useCallback((sessionId, updater) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId || s.messages.length === 0) return s;
        const msgs = [...s.messages];
        msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
        return { ...s, messages: msgs, updatedAt: Date.now() };
      })
    );
  }, []);

  // For reactions (thumbs up/down) on an arbitrary message, not just the last one
  const updateMessageAt = useCallback((sessionId, index, updater) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId || !s.messages[index]) return s;
        const msgs = [...s.messages];
        msgs[index] = updater(msgs[index]);
        return { ...s, messages: msgs };
      })
    );
  }, []);

  // For regenerate: drop everything from `index` onward (the old
  // assistant reply and anything after it), so a fresh one can be
  // streamed in to replace it.
  const truncateMessagesTo = useCallback((sessionId, index) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return { ...s, messages: s.messages.slice(0, index) };
      })
    );
  }, []);

  return {
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
  };
}
