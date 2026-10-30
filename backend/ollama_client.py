import os
import json
import requests
import logging
from typing import List, Dict, Optional, Any, Generator, Tuple
from backend.config import (
    OLLAMA_BASE_URL,
    OLLAMA_CHAT_URL,
    OLLAMA_TAGS_URL,
    DEFAULT_MODEL,
    MAX_TOKENS,
    OLLAMA_TIMEOUT,
)
from backend.utils import clean_thinking_text, StreamThinkFilter

logger = logging.getLogger(__name__)

SYSTEM_PROMPTS = {
    "chat": (
        "You are a helpful, direct, and knowledgeable local AI assistant running on the user's machine. "
        "Provide complete, clear, and well-structured answers. Always format your responses with clean Markdown, "
        "including headers, bullet points, and code blocks where helpful."
    ),
    "coding": (
        "You are an expert software engineer and technical architect. "
        "When explaining code, find likely bugs, suggest robust fixes, generate well-commented and clean code examples, "
        "and explain error messages clearly. Never claim to have executed code unless provided with real outputs."
    ),
    "document": (
        "You are a meticulous document analysis assistant. "
        "Answer questions based on the provided document excerpts. Distinguish clearly between information found "
        "in the document and general knowledge. Always cite the relevant document name or excerpt number."
    ),
    "study": (
        "You are an encouraging, pedagogical study tutor. "
        "Explain concepts in simple, intuitive language, create summaries, generate practice questions/quizzes, "
        "and explain answers step-by-step. Adapt your tone to be clear and educational."
    ),
    "writing": (
        "You are a professional writing and editorial assistant. "
        "Help the user draft clear emails, rewrite text with improved tone or grammar, create summaries, "
        "and brainstorm ideas effectively."
    ),
}

def check_ollama_health() -> bool:
    """Checks if Ollama service is reachable at local endpoint."""
    try:
        res = requests.get(OLLAMA_TAGS_URL, timeout=3)
        return res.status_code == 200
    except Exception:
        return False

def get_ollama_status_details() -> Dict[str, Any]:
    """Returns detailed connection and model status for Ollama."""
    try:
        res = requests.get(OLLAMA_TAGS_URL, timeout=4)
        if res.status_code == 200:
            models = res.json().get("models", [])
            installed_names = [m.get("name", "") for m in models if m.get("name")]
            has_models = len(installed_names) > 0
            return {
                "connected": True,
                "status": "connected" if has_models else "model_unavailable",
                "endpoint": OLLAMA_BASE_URL,
                "models": installed_names,
                "model_details": models,
                "model_count": len(installed_names),
                "error": None if has_models else "Ollama is running, but no models are installed. Please run 'ollama pull qwen2.5:1.5b' or 'ollama pull qwen3:4b'."
            }
        else:
            return {
                "connected": False,
                "status": "error",
                "endpoint": OLLAMA_BASE_URL,
                "models": [],
                "model_details": [],
                "model_count": 0,
                "error": f"Ollama HTTP {res.status_code}: {res.text}"
            }
    except requests.exceptions.ConnectionError:
        return {
            "connected": False,
            "status": "disconnected",
            "endpoint": OLLAMA_BASE_URL,
            "models": [],
            "model_details": [],
            "model_count": 0,
            "error": f"Ollama service is not running at {OLLAMA_BASE_URL}. Please start Ollama."
        }
    except requests.exceptions.Timeout:
        return {
            "connected": False,
            "status": "timeout",
            "endpoint": OLLAMA_BASE_URL,
            "models": [],
            "model_details": [],
            "model_count": 0,
            "error": "Connection to Ollama timed out."
        }
    except Exception as e:
        return {
            "connected": False,
            "status": "error",
            "endpoint": OLLAMA_BASE_URL,
            "models": [],
            "model_details": [],
            "model_count": 0,
            "error": str(e)
        }

def get_installed_models() -> List[str]:
    """Returns list of model names pulled in Ollama."""
    try:
        res = requests.get(OLLAMA_TAGS_URL, timeout=3)
        if res.status_code == 200:
            models = res.json().get("models", [])
            return [m.get("name", "") for m in models if m.get("name")]
    except Exception as e:
        logger.error(f"Error fetching Ollama models: {e}")
    return []

def check_model_available(model_name: str) -> bool:
    """Checks whether the specific requested model is pulled in Ollama."""
    if not model_name:
        return False
    installed = get_installed_models()
    # Normalize model tags (e.g. 'qwen3:4b' vs 'qwen3:4b-latest' or 'qwen3:4b')
    target = model_name.strip().lower()
    for m in installed:
        m_lower = m.lower()
        if m_lower == target or m_lower.startswith(f"{target}:") or target.startswith(f"{m_lower}:"):
            return True
        if target.split(":")[0] == m_lower.split(":")[0]:
            return True
    return False

def resolve_model(requested_model: Optional[str] = None) -> str:
    """
    Resolves the model to use.
    Never invents a model. If requested model is installed, returns it.
    If requested model is missing, raises RuntimeError.
    If no model requested, selects DEFAULT_MODEL if installed, else first installed model.
    """
    installed = get_installed_models()
    if not installed:
        raise RuntimeError("No models found in local Ollama. Please run 'ollama pull qwen2.5:1.5b' or 'ollama pull qwen3:4b'.")

    if requested_model and requested_model.strip():
        req = requested_model.strip()
        req_lower = req.lower()
        # 1. Exact match (case-sensitive then insensitive)
        for m in installed:
            if m == req:
                return m
        for m in installed:
            if m.lower() == req_lower:
                return m
        # 2. Tag / prefix match
        for m in installed:
            m_lower = m.lower()
            if m_lower.startswith(f"{req_lower}:") or req_lower.startswith(f"{m_lower}:"):
                return m
            if req_lower.split(":")[0] == m_lower.split(":")[0]:
                return m
        raise RuntimeError(f"Requested model '{req}' is not installed in local Ollama. Installed models: {', '.join(installed)}")

    # Check if default is installed
    def_lower = DEFAULT_MODEL.strip().lower()
    for m in installed:
        if m.lower() == def_lower or m.lower().startswith(def_lower) or def_lower.startswith(m.lower()):
            return m

    return installed[0]

def build_chat_messages(
    prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
    system_prompt: Optional[str] = None,
    mode: str = "chat",
    document_context: Optional[str] = None,
    max_history_turns: int = 12
) -> List[Dict[str, str]]:
    """Builds structured chat messages list for Ollama Chat API."""
    base_sys = system_prompt.strip() if system_prompt and system_prompt.strip() else SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["chat"])
    
    if document_context and document_context.strip():
        base_sys += f"\n\n{document_context.strip()}"

    messages = [{"role": "system", "content": base_sys}]

    if history:
        valid_history = [
            m for m in history 
            if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")
        ]
        # Keep last max_history_turns
        truncated = valid_history[-(max_history_turns * 2):]
        for msg in truncated:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": prompt.strip()})
    return messages

def _build_ollama_payload(
    model_name: str,
    messages: List[Dict[str, str]],
    stream: bool = False,
    temperature: float = 0.4
) -> Dict[str, Any]:
    return {
        "model": model_name,
        "messages": messages,
        "stream": stream,
        "options": {
            "num_predict": MAX_TOKENS,
            "num_ctx": 4096,
            "temperature": temperature,
            "num_thread": max(1, (os.cpu_count() or 4))
        }
    }

def generate_response(
    prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
    model_name: Optional[str] = None,
    system_prompt: Optional[str] = None,
    mode: str = "chat",
    document_context: Optional[str] = None,
    temperature: float = 0.4
) -> Tuple[str, str]:
    """
    Generates complete non-streaming response.
    Returns (cleaned_response_text, model_used).
    """
    if not check_ollama_health():
        raise RuntimeError("Ollama is not running. Please start Ollama at http://localhost:11434.")

    active_model = resolve_model(model_name)
    messages = build_chat_messages(prompt, history, system_prompt, mode, document_context)
    payload = _build_ollama_payload(active_model, messages, stream=False, temperature=temperature)

    try:
        res = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        if res.status_code != 200:
            raise RuntimeError(f"Ollama returned HTTP status {res.status_code}: {res.text}")
        data = res.json()
        raw_text = data.get("message", {}).get("content", "")
        cleaned = clean_thinking_text(raw_text)
        return cleaned, active_model
    except requests.exceptions.Timeout:
        raise RuntimeError(f"Generation timed out after {OLLAMA_TIMEOUT}s on model '{active_model}'. Try a shorter prompt or faster model.")
    except requests.exceptions.ConnectionError:
        raise RuntimeError("Lost connection to Ollama during generation.")
    except Exception as e:
        raise RuntimeError(f"Generation error: {str(e)}")

def stream_response_generator(
    prompt: str,
    history: Optional[List[Dict[str, str]]] = None,
    model_name: Optional[str] = None,
    system_prompt: Optional[str] = None,
    mode: str = "chat",
    document_context: Optional[str] = None,
    temperature: float = 0.4
) -> Generator[str, None, None]:
    """
    Streams tokens using Server-Sent Events (SSE).
    Yields events in format:
    data: {"token": "...", "model": "...", "done": false}\n\n
    and finally:
    data: {"done": true, "full_text": "...", "model": "..."}\n\n
    """
    if not check_ollama_health():
        err_event = json.dumps({"error": "Ollama service is unreachable. Please start Ollama at http://localhost:11434.", "done": True})
        yield f"data: {err_event}\n\n"
        return

    try:
        active_model = resolve_model(model_name)
    except Exception as e:
        err_event = json.dumps({"error": str(e), "done": True})
        yield f"data: {err_event}\n\n"
        return

    messages = build_chat_messages(prompt, history, system_prompt, mode, document_context)
    payload = _build_ollama_payload(active_model, messages, stream=True, temperature=temperature)

    think_filter = StreamThinkFilter()
    full_text_parts = []

    try:
        with requests.post(OLLAMA_CHAT_URL, json=payload, stream=True, timeout=OLLAMA_TIMEOUT) as resp:
            if resp.status_code != 200:
                err_text = resp.text
                err_event = json.dumps({"error": f"Ollama HTTP {resp.status_code}: {err_text}", "done": True})
                yield f"data: {err_event}\n\n"
                return

            for line in resp.iter_lines(decode_unicode=True):
                if not line or not line.strip():
                    continue
                try:
                    chunk_data = json.loads(line)
                    raw_token = chunk_data.get("message", {}).get("content", "")
                    is_done = chunk_data.get("done", False)

                    clean_tok = think_filter.process_token(raw_token)
                    if clean_tok:
                        full_text_parts.append(clean_tok)
                        event_payload = json.dumps({
                            "token": clean_tok,
                            "done": False,
                            "model": active_model
                        })
                        yield f"data: {event_payload}\n\n"

                    if is_done:
                        remaining = think_filter.flush()
                        if remaining:
                            full_text_parts.append(remaining)
                            event_payload = json.dumps({
                                "token": remaining,
                                "done": False,
                                "model": active_model
                            })
                            yield f"data: {event_payload}\n\n"
                        break
                except json.JSONDecodeError:
                    continue

        complete_text = "".join(full_text_parts)
        final_event = json.dumps({
            "token": "",
            "done": True,
            "full_text": complete_text,
            "model": active_model
        })
        yield f"data: {final_event}\n\n"

    except requests.exceptions.Timeout:
        err_event = json.dumps({"error": "Generation timed out.", "done": True})
        yield f"data: {err_event}\n\n"
    except Exception as e:
        err_event = json.dumps({"error": f"Stream error: {str(e)}", "done": True})
        yield f"data: {err_event}\n\n"
