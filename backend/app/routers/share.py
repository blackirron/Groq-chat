"""
POST /api/share      - freeze the given messages into a shareable snapshot
GET  /api/share/{id}  - fetch a previously shared snapshot (read-only)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import storage

router = APIRouter()


class ShareMessage(BaseModel):
    role: str
    content: str
    latencyMs: int | None = None


class CreateShareRequest(BaseModel):
    title: str
    messages: list[ShareMessage]


@router.post("/api/share")
def create_share(req: CreateShareRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")
    share_id = storage.create_share(
        req.title, [m.model_dump() for m in req.messages]
    )
    return {"id": share_id}


@router.get("/api/share/{share_id}")
def get_share(share_id: str):
    data = storage.get_share(share_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Share not found")
    return data
