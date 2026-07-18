"""
GET    /api/memory          - list everything remembered
POST   /api/memory          - add a fact manually
PATCH  /api/memory/{id}     - edit a fact's text
DELETE /api/memory/{id}     - forget one fact
DELETE /api/memory          - forget everything
POST   /api/memory/extract  - given a finished exchange, ask the model
                               what's worth remembering and store it
"""

import json

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import memory
from app.core.config import settings

router = APIRouter()


class AddMemoryRequest(BaseModel):
    text: str


class UpdateMemoryRequest(BaseModel):
    text: str


class ExtractRequest(BaseModel):
    user_message: str
    assistant_message: str


EXTRACTION_SYSTEM_PROMPT = """You extract durable facts worth remembering \
about a user from one exchange of a chat, for a personal-assistant memory \
feature.

Only extract things that would still be true and useful in future, \
unrelated conversations — name, role/occupation, stable preferences, \
ongoing projects, tools they use, how they like answers formatted. \
Do NOT extract one-off requests, the current topic being discussed, or \
anything that's just true of this single exchange.

Respond with ONLY a JSON array of short strings, each a single fact \
written in third person (e.g. "User's name is Samir", "Prefers concise \
answers"). If there's nothing worth remembering, respond with exactly: []

No prose, no markdown fences, just the JSON array."""


@router.get("/api/memory")
def list_memory():
    return {"memories": memory.list_memories()}


@router.post("/api/memory")
def add_memory(req: AddMemoryRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")
    item = memory.add_memory(req.text, source="manual")
    return item


@router.patch("/api/memory/{memory_id}")
def update_memory(memory_id: str, req: UpdateMemoryRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")
    item = memory.update_memory(memory_id, req.text)
    if item is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return item


@router.delete("/api/memory/{memory_id}")
def delete_memory(memory_id: str):
    if not memory.delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": True}


@router.delete("/api/memory")
def clear_memory():
    memory.clear_all()
    return {"cleared": True}


@router.post("/api/memory/extract")
async def extract_memory(req: ExtractRequest):
    if not settings.GROQ_API_KEY:
        # Silent no-op, not an error — extraction is a background nicety,
        # not something that should surface a scary error to the user
        # just because they haven't set up their key yet.
        return {"added": []}

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"User said: {req.user_message}\n\n"
                    f"Assistant replied: {req.assistant_message}"
                ),
            },
        ],
        "temperature": 0.2,
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                settings.GROQ_API_URL, json=payload, headers=headers
            )
        if resp.status_code != 200:
            return {"added": []}
        data = resp.json()
        content = data["choices"][0]["message"]["content"].strip()
        # Models sometimes wrap JSON in markdown fences despite instructions
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        facts = json.loads(content)
        if not isinstance(facts, list):
            return {"added": []}
    except (httpx.RequestError, KeyError, IndexError, json.JSONDecodeError):
        return {"added": []}

    added = []
    for fact in facts:
        if isinstance(fact, str) and fact.strip():
            added.append(memory.add_memory(fact, source="auto"))
    return {"added": added}
