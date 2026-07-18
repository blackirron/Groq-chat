from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import chat, share, memory

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGINS] if settings.CORS_ORIGINS != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(share.router)
app.include_router(memory.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "model": settings.GROQ_MODEL}


# Serve the built frontend (frontend/dist) from this same service, so
# Render only needs one deployment instead of two separate services
# with CORS between them. This mirrors the pattern used in your other
# FastAPI + static-frontend projects (isthisAI, AIAdmaker).
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount(
        "/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets"
    )

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # A typo'd or removed API route should 404 normally, not
        # silently return the frontend's index.html — only non-API
        # paths fall through to the SPA.
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        requested = FRONTEND_DIST / full_path
        if full_path and requested.is_file():
            return FileResponse(requested)
        # Anything else (/, /share/<id>, any client-side route) gets
        # index.html — React Router-style paths that aren't real files
        # on disk are handled entirely client-side after that.
        return FileResponse(FRONTEND_DIST / "index.html")
