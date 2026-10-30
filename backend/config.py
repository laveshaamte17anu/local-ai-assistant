import os
from pathlib import Path

# Load optional .env file from project root or backend
for env_candidate in [Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env"]:
    if env_candidate.exists():
        with open(env_candidate, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())

# Ollama API Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/api/chat"
OLLAMA_TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"

# Default Local AI Model
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

# Speech-to-Text (Whisper) Configuration - CPU optimized
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"

# Backend Server Configuration
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8002))

# LLM Generation Configuration
MAX_TOKENS = int(os.getenv("MAX_TOKENS", 2048))
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", 180))
