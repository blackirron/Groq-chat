"""
App configuration. The Groq API key lives here, read from an
environment variable — it never touches the frontend or gets sent
to the browser. The frontend only ever talks to *our* backend at
/api/chat; our backend is the only thing that talks to Groq.
"""

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME = "Groq Chat"
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
    # llama-3.3-70b-versatile (the old default) is deprecated by Groq.
    # qwen3.6-27b replaces it AND handles vision + reasoning in the same
    # model, so chat and camera/screen analysis don't need separate
    # models or request paths.
    GROQ_MODEL = os.environ.get("GROQ_MODEL", "qwen/qwen3.6-27b")
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173")

    DEFAULT_SYSTEM_PROMPT = (
        "You are a warm, direct, and genuinely helpful assistant. "
        "Explain things clearly without being condescending. Be "
        "concise by default, but don't clip useful detail just to "
        "seem brief — match the depth to what's actually being asked. "
        "Use a natural, conversational tone rather than corporate or "
        "robotic phrasing. It's fine to have a point of view, and "
        "fine to say when you're not sure about something."
    )


settings = Settings()
