"""
The one real endpoint: POST /api/chat.

Takes the running message history from the frontend, forwards it to
Groq's chat completions endpoint (OpenAI-compatible), and streams the
response back token-by-token as Server-Sent Events. Streaming matters
here specifically because Groq's whole selling point is inference
speed — buffering the full response before sending it back would
throw away the thing that makes Groq worth using.
"""

import json

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import memory
from app.core.config import settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str
    image_data_url: str | None = None  # data:image/jpeg;base64,... — camera/screen capture


def _to_groq_message(m: ChatMessage) -> dict:
    """Groq's vision format wants content as a list of parts
    ({type: text} / {type: image_url}) when an image is attached,
    but plain string content otherwise — sending the list form for
    every message would work too, but keeping plain text messages as
    plain strings is simpler to read in logs and slightly cheaper."""
    if not m.image_data_url:
        return {"role": m.role, "content": m.content}
    return {
        "role": m.role,
        "content": [
            {"type": "text", "text": m.content},
            {"type": "image_url", "image_url": {"url": m.image_data_url}},
        ],
    }


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    role_prompt: str | None = None  # optional persona override, e.g. "Act as a strict code reviewer"
    include_memory: bool = True
    response_language: str | None = None  # e.g. "Hindi" — preference, not a hard override
    concise: bool = False


def _build_system_prompt(
    role_prompt: str | None,
    include_memory: bool,
    response_language: str | None,
    concise: bool,
) -> str:
    base = role_prompt.strip() if role_prompt and role_prompt.strip() else settings.DEFAULT_SYSTEM_PROMPT
    parts = [base]
    if concise:
        parts.append(
            "Concise mode is on: prioritize the shortest response that "
            "fully answers the question. Skip preamble, skip restating "
            "the question, skip caveats unless they materially change "
            "the answer. Prefer short paragraphs or tight bullet points "
            "over long prose. Still include necessary detail — being "
            "concise means cutting filler, not cutting substance."
        )
    if response_language and response_language.strip().lower() not in ("", "auto"):
        lang = response_language.strip()
        parts.append(
            f"Prefer responding in {lang}. If the user's message is clearly "
            f"written in a different language, or pastes content (like code "
            f"or an error message) that shouldn't be translated, follow "
            f"their lead instead of forcing {lang}."
        )
    if include_memory:
        mem_block = memory.as_prompt_block()
        if mem_block:
            parts.append(mem_block)
    return "\n\n".join(parts)


async def _stream_groq(messages: list[dict]):
    if not settings.GROQ_API_KEY:
        # Surface a clear, catchable error as an SSE event rather than
        # a raw 500 — the frontend can show this directly to the user.
        yield f"data: {json.dumps({'error': 'GROQ_API_KEY is not set on the server.'})}\n\n"
        return

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "stream": True,
    }
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            async with client.stream(
                "POST", settings.GROQ_API_URL, json=payload, headers=headers
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    yield f"data: {json.dumps({'error': body.decode(errors='replace')})}\n\n"
                    return

                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[len("data: "):]
                    if data.strip() == "[DONE]":
                        yield "data: [DONE]\n\n"
                        return
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                    except (KeyError, IndexError, json.JSONDecodeError):
                        continue
                    if delta:
                        yield f"data: {json.dumps({'content': delta})}\n\n"
        except httpx.RequestError as e:
            yield f"data: {json.dumps({'error': f'Could not reach Groq: {e}'})}\n\n"


@router.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    system_prompt = _build_system_prompt(
        req.role_prompt, req.include_memory, req.response_language, req.concise
    )
    messages = [{"role": "system", "content": system_prompt}] + [
        _to_groq_message(m) for m in req.messages
    ]
    return StreamingResponse(
        _stream_groq(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering (nginx etc.)
        },
    )
