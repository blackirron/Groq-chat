import { useEffect, useState } from "react";
import { useTheme } from "./useTheme.js";
import { useLanguage } from "./useLanguage.js";

/**
 * Renders a previously shared, frozen chat snapshot. Read-only by
 * design — no input box, no way to continue the conversation from
 * here, since this page can be opened by anyone with the link, not
 * just you.
 */
export default function ShareView({ shareId }) {
  useTheme(); // applies the visitor's saved/system theme preference; no toggle shown here
  const { t } = useLanguage(); // applies the visitor's own saved UI language
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/share/${shareId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "not-found" : "error");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: e.message || "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  if (state.status === "loading") {
    return (
      <div className="app share-app">
        <div className="share-center-msg">Loading shared chat…</div>
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="app share-app">
        <div className="share-center-msg">
          {state.status === "not-found"
            ? "This shared chat doesn't exist, or the link is wrong."
            : "Couldn't load this shared chat."}
        </div>
      </div>
    );
  }

  const { title, messages } = state.data;

  return (
    <div className="app share-app">
      <div className="main-col">
        <header className="header">
          <div className="brand">
            <span className="brand-mark">⚡</span>
            <span className="brand-name">{title || "Shared chat"}</span>
          </div>
          <span className="share-readonly-tag">{t.readOnly}</span>
        </header>

        <main className="thread">
          {messages.map((m, i) => (
            <div key={i} className={`bubble-row ${m.role}`}>
              <div className={`bubble ${m.role}`}>
                <div className="bubble-content">{m.content}</div>
                {m.role === "assistant" && m.latencyMs != null && (
                  <div className="latency-badge">{m.latencyMs} ms</div>
                )}
              </div>
            </div>
          ))}
        </main>

        <footer className="composer share-footer">
          <a className="ghost-btn" href="/">
            {t.startYourOwnChat}
          </a>
        </footer>
      </div>
    </div>
  );
}
