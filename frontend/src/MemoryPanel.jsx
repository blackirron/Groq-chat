import { useEffect, useState } from "react";
import {
  fetchMemories,
  addMemoryFact,
  updateMemoryFact,
  deleteMemoryFact,
  clearAllMemory,
} from "./memoryClient.js";

export default function MemoryPanel({ onClose }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newFact, setNewFact] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMemories()
      .then(setMemories)
      .catch(() => setError("Couldn't load memory"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const text = newFact.trim();
    if (!text) return;
    try {
      const item = await addMemoryFact(text);
      setMemories((prev) =>
        prev.some((m) => m.id === item.id) ? prev : [item, ...prev]
      );
      setNewFact("");
    } catch {
      setError("Couldn't add that");
    }
  }

  async function handleDelete(id) {
    try {
      await deleteMemoryFact(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Couldn't delete that");
    }
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditingText(m.text);
  }

  async function commitEdit() {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateMemoryFact(editingId, text);
      setMemories((prev) =>
        prev.map((m) => (m.id === editingId ? updated : m))
      );
    } catch {
      setError("Couldn't save that edit");
    }
    setEditingId(null);
  }

  async function handleClearAll() {
    if (!window.confirm("Forget everything? This can't be undone.")) return;
    try {
      await clearAllMemory();
      setMemories([]);
    } catch {
      setError("Couldn't clear memory");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="memory-panel" onClick={(e) => e.stopPropagation()}>
        <div className="memory-panel-header">
          <h2>Memory</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="memory-panel-sub">
          What the assistant remembers about you, across every chat. Edit or
          remove anything that's wrong or outdated.
        </p>

        <div className="memory-add-row">
          <input
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add something to remember…"
          />
          <button className="ghost-btn" onClick={handleAdd} disabled={!newFact.trim()}>
            Add
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="memory-list">
          {loading && <div className="memory-empty">Loading…</div>}
          {!loading && memories.length === 0 && (
            <div className="memory-empty">
              Nothing remembered yet. Facts you'd want kept across chats —
              your name, role, preferences — will show up here as you chat,
              or you can add them directly above.
            </div>
          )}
          {memories.map((m) => (
            <div key={m.id} className="memory-item">
              {editingId === m.id ? (
                <input
                  className="memory-edit-input"
                  value={editingText}
                  autoFocus
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <span className="memory-text">{m.text}</span>
                  <div className="memory-item-actions">
                    <button
                      className="icon-btn"
                      title="Edit"
                      onClick={() => startEdit(m)}
                    >
                      ✎
                    </button>
                    <button
                      className="icon-btn"
                      title="Forget"
                      onClick={() => handleDelete(m.id)}
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {memories.length > 0 && (
          <button className="ghost-btn memory-clear-all" onClick={handleClearAll}>
            Forget everything
          </button>
        )}
      </div>
    </div>
  );
}
