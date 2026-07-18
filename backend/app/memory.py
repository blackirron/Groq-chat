"""
Cross-chat memory: durable facts about the user that persist across
every conversation, not just the current one. Same flat-JSON-file
approach as shares — this is a single-user personal tool, no auth,
so "memory" is just one file on the machine running the backend.

Facts are plain short strings ("User's name is Samir", "Prefers
concise answers"), not structured data — keeps the editable-memory
UI trivial (it's just a list of text you can add to or remove from)
and keeps prompt injection simple (join them into the system prompt).
"""

import json
import time
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MEMORY_FILE = DATA_DIR / "memory.json"


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_all() -> list[dict]:
    if not MEMORY_FILE.exists():
        return []
    try:
        return json.loads(MEMORY_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []


def _write_all(items: list[dict]) -> None:
    _ensure_dir()
    MEMORY_FILE.write_text(json.dumps(items, indent=2))


def list_memories() -> list[dict]:
    return sorted(_read_all(), key=lambda m: m["created_at"], reverse=True)


def add_memory(text: str, source: str = "manual") -> dict:
    text = text.strip()
    items = _read_all()
    # Skip near-duplicates (case-insensitive exact match) rather than
    # piling up repeats every time the same fact gets re-stated.
    if any(m["text"].strip().lower() == text.lower() for m in items):
        return next(m for m in items if m["text"].strip().lower() == text.lower())
    item = {
        "id": uuid.uuid4().hex[:12],
        "text": text,
        "source": source,  # "manual" | "auto"
        "created_at": time.time(),
    }
    items.append(item)
    _write_all(items)
    return item


def delete_memory(memory_id: str) -> bool:
    items = _read_all()
    remaining = [m for m in items if m["id"] != memory_id]
    if len(remaining) == len(items):
        return False
    _write_all(remaining)
    return True


def update_memory(memory_id: str, text: str) -> dict | None:
    items = _read_all()
    for m in items:
        if m["id"] == memory_id:
            m["text"] = text.strip()
            _write_all(items)
            return m
    return None


def clear_all() -> None:
    _write_all([])


def as_prompt_block() -> str:
    """Formats current memory as text to inject into the system prompt.
    Empty string if there's nothing stored yet."""
    items = list_memories()
    if not items:
        return ""
    lines = "\n".join(f"- {m['text']}" for m in items)
    return (
        "Here is what you currently know about the user from earlier "
        "conversations. Use it naturally where relevant — don't "
        "recite it back or announce that you're using it:\n" + lines
    )
