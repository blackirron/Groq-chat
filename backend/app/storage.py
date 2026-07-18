"""
Storage for shared chat snapshots. Plain JSON files on disk, one per
share — consistent with the flat-file approach used elsewhere (no
database needed at this scale, and it's trivial to inspect/debug by
just reading the file).

A share is a frozen snapshot, not a live link into your session: once
created, editing the original conversation later does NOT change what
a shared link shows. That's a deliberate choice — it's what "share"
means in ChatGPT too, and it avoids ever exposing your other private
chats through a stale reference.
"""

import json
import secrets
import time
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "shares"


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _share_path(share_id: str) -> Path:
    return DATA_DIR / f"{share_id}.json"


def create_share(title: str, messages: list[dict]) -> str:
    _ensure_dir()
    share_id = secrets.token_urlsafe(9)  # short, URL-safe, unguessable
    payload = {
        "id": share_id,
        "title": title,
        "messages": messages,
        "created_at": time.time(),
    }
    _share_path(share_id).write_text(json.dumps(payload, indent=2))
    return share_id


def get_share(share_id: str) -> dict | None:
    # Reject anything that isn't a plain token before touching the
    # filesystem — share_id comes straight from the URL path, so a
    # crafted id like "../../something" must never reach Path().
    if not share_id.replace("-", "").replace("_", "").isalnum():
        return None
    path = _share_path(share_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None
