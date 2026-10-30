import os
import sys
import shutil
import tempfile
from pathlib import Path
from typing import List, Dict, Optional, Any

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from backend.config import DEFAULT_MODEL, BACKEND_PORT
from backend.ollama_client import (
    check_ollama_health,
    check_model_available,
    get_installed_models,
    get_ollama_status_details,
    resolve_model,
    stream_response_generator
)
from backend.assistant import process_chat, clear_conversation
from backend.conversation import session_conversation
from backend.speech_to_text import transcribe_audio_file
from backend.utils import safe_remove_file, logger
from backend.database import (
    init_db,
    list_conversations,
    get_conversation,
    create_conversation,
    update_conversation,
    delete_conversation,
    search_conversations,
    add_message,
    update_message,
    delete_messages_after,
    delete_last_assistant_message,
    clear_conversation_messages,
    store_document,
    list_documents,
    delete_document,
    get_conversation_chunks,
    list_notes,
    create_note,
    update_note,
    delete_note,
    list_tasks,
    create_task,
    update_task,
    delete_task,
    get_setting,
    set_setting
)
from backend.document_processor import extract_text_from_file, chunk_text, retrieve_relevant_chunks, format_document_context

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes database schema and ensures local data directories exist."""
    init_db()
    logger.info("Database initialized successfully.")
    yield

app = FastAPI(
    title="Local AI Assistant API",
    description="Local AI Assistant powered by Ollama, Faster-Whisper, and SQLite persistence.",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Models & Schemas -----------------

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None
    model: Optional[str] = None
    mode: Optional[str] = "chat"
    system_prompt: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    history: List[Dict[str, str]]
    model: Optional[str] = None
    conversation_id: Optional[str] = None

class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"
    model: Optional[str] = None
    system_prompt: Optional[str] = ""
    mode: Optional[str] = "chat"

class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    mode: Optional[str] = None

class NoteRequest(BaseModel):
    title: str
    content: str
    tags: Optional[str] = ""

class TaskRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    due_date: Optional[str] = ""
    status: Optional[str] = "pending"

class SettingRequest(BaseModel):
    key: str
    value: Any

# ----------------- Health & Status Endpoints -----------------

@app.get("/api/health")
def health_check():
    """Health check endpoint reporting overall system status."""
    ollama_ok = check_ollama_health()
    return {
        "status": "ok" if ollama_ok else "degraded",
        "ollama": "running" if ollama_ok else "stopped",
        "database": "connected"
    }

@app.get("/api/status")
def system_status():
    """Detailed status endpoint reporting connection, models, and dependencies."""
    status_info = get_ollama_status_details()
    default_model_ok = check_model_available(DEFAULT_MODEL) if status_info.get("connected") else False
    return {
        "ollama": status_info,
        "default_model": DEFAULT_MODEL,
        "default_model_available": default_model_ok,
        "database": "sqlite_wal_active"
    }

@app.get("/api/model")
def model_status(name: Optional[str] = None):
    """Status check for requested or default model availability."""
    ollama_ok = check_ollama_health()
    target_model = name or DEFAULT_MODEL
    model_ok = check_model_available(target_model) if ollama_ok else False

    return {
        "model": target_model,
        "ollama_running": ollama_ok,
        "model_available": model_ok
    }

@app.get("/api/models")
def list_models():
    """Lists all installed models in local Ollama with details."""
    ollama_info = get_ollama_status_details()
    return {
        "models": ollama_info.get("models", []),
        "details": ollama_info.get("model_details", []),
        "default": DEFAULT_MODEL,
        "ollama_running": ollama_info.get("connected", False),
        "error": ollama_info.get("error")
    }

# ----------------- Chat Endpoints (Sync & Stream) -----------------

@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """Processes chat messages using local Ollama and persists conversation."""
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message text cannot be empty.")
        
    try:
        reply, model_used, conv_id = process_chat(
            user_message=request.message,
            conversation_id=request.conversation_id,
            client_history=request.history,
            model_name=request.model,
            mode=request.mode or "chat",
            system_prompt=request.system_prompt
        )
        conv = get_conversation(conv_id)
        current_history = [
            {"role": m["role"], "content": m["content"]}
            for m in (conv.get("messages", []) if conv else [])
        ]
        return {
            "response": reply,
            "history": current_history,
            "model": model_used,
            "conversation_id": conv_id
        }
    except RuntimeError as e:
        logger.error(f"Chat service error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/chat/stream")
def stream_chat_endpoint(request: ChatRequest):
    """
    Streams tokens in real time using Server-Sent Events (SSE).
    Persists user message and completed assistant response to SQLite.
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message text cannot be empty.")

    clean_message = request.message.strip()
    cid = request.conversation_id or "default_session"

    # Ensure conversation exists
    conv = get_conversation(cid)
    if not conv:
        initial_title = clean_message[:36].strip() + ("..." if len(clean_message) > 36 else "")
        create_conversation(conv_id=cid, title=initial_title, model=request.model or "qwen2.5:1.5b", mode=request.mode or "chat")
        conv = get_conversation(cid)

    # Persist user message immediately
    add_message(conversation_id=cid, role="user", content=clean_message)

    # Gather history for context
    db_messages = conv.get("messages", []) if conv else []
    history_for_llm = []
    for m in db_messages:
        if m.get("content") != clean_message or m.get("role") != "user":
            history_for_llm.append({"role": m["role"], "content": m["content"]})

    if not history_for_llm and request.history:
        history_for_llm = [
            m for m in request.history
            if isinstance(m, dict) and "role" in m and "content" in m and m.get("content") != clean_message
        ]

    # Check for document context
    doc_chunks = get_conversation_chunks(cid)
    document_context = None
    if doc_chunks:
        top_chunks = retrieve_relevant_chunks(clean_message, doc_chunks, top_k=4)
        if top_chunks:
            document_context = format_document_context(top_chunks)

    effective_sys_prompt = request.system_prompt or (conv.get("system_prompt") if conv else None)
    effective_mode = request.mode or (conv.get("mode") if conv else "chat")
    target_model = request.model or (conv.get("model") if conv else None)

    def sse_event_stream():
        full_text_collector = []
        model_collector = [target_model or "qwen2.5:1.5b"]

        try:
            for sse_chunk in stream_response_generator(
                prompt=clean_message,
                history=history_for_llm,
                model_name=target_model,
                system_prompt=effective_sys_prompt,
                mode=effective_mode,
                document_context=document_context
            ):
                # Intercept token to save full response at completion
                if sse_chunk.startswith("data: "):
                    try:
                        import json
                        payload_data = json.loads(sse_chunk[6:].strip())
                        if payload_data.get("model"):
                            model_collector[0] = payload_data["model"]
                        if payload_data.get("token"):
                            full_text_collector.append(payload_data["token"])
                        if payload_data.get("done") and payload_data.get("full_text"):
                            full_text_collector = [payload_data["full_text"]]
                    except Exception:
                        pass
                yield sse_chunk
        finally:
            # Persist assistant message even if interrupted
            final_text = "".join(full_text_collector).strip()
            if final_text:
                add_message(
                    conversation_id=cid,
                    role="assistant",
                    content=final_text,
                    model=model_collector[0]
                )
                session_conversation.add_user_message(clean_message, conversation_id=cid)
                session_conversation.add_assistant_message(final_text, model=model_collector[0], conversation_id=cid)

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# ----------------- Conversation Management -----------------

@app.get("/api/conversations")
def get_conversations_list(search: Optional[str] = None):
    """Retrieves all conversations from SQLite database."""
    if search and search.strip():
        return {"conversations": search_conversations(search.strip())}
    return {"conversations": list_conversations()}

@app.post("/api/conversations")
def create_conversation_endpoint(req: CreateConversationRequest):
    """Creates a new conversation."""
    conv = create_conversation(
        title=req.title or "New Conversation",
        model=req.model or DEFAULT_MODEL,
        system_prompt=req.system_prompt or "",
        mode=req.mode or "chat"
    )
    return conv

@app.get("/api/conversations/{conv_id}")
def get_single_conversation(conv_id: str):
    """Retrieves full conversation with messages and documents."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conv["documents"] = list_documents(conv_id)
    return conv

@app.put("/api/conversations/{conv_id}")
def update_conversation_endpoint(conv_id: str, req: UpdateConversationRequest):
    """Updates title, model, system prompt, or mode of a conversation."""
    updated = update_conversation(
        conv_id=conv_id,
        title=req.title,
        model=req.model,
        system_prompt=req.system_prompt,
        mode=req.mode
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return updated

@app.delete("/api/conversations/{conv_id}")
def delete_conversation_endpoint(conv_id: str):
    """Deletes conversation and its associated messages and documents."""
    success = delete_conversation(conv_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"status": "deleted", "id": conv_id}

@app.post("/api/conversations/{conv_id}/clear")
def clear_conversation_messages_endpoint(conv_id: str):
    """Clears all messages inside a specific conversation."""
    clear_conversation_messages(conv_id)
    return {"status": "cleared", "conversation_id": conv_id}

@app.post("/api/conversations/{conv_id}/regenerate")
def regenerate_assistant_response(conv_id: str, model: Optional[str] = None):
    """
    Deletes the latest assistant message and regenerates a new one
    based on the preceding user message and conversation history.
    """
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    messages = conv.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="Cannot regenerate in an empty conversation.")

    # Find last user prompt
    last_user_prompt = None
    for m in reversed(messages):
        if m["role"] == "user":
            last_user_prompt = m["content"]
            break

    if not last_user_prompt:
        raise HTTPException(status_code=400, detail="No user message found to regenerate from.")

    # Delete last assistant message if present
    delete_last_assistant_message(conv_id)

    # Re-run chat with remaining messages
    updated_conv = get_conversation(conv_id)
    preceding_msgs = [
        {"role": m["role"], "content": m["content"]}
        for m in (updated_conv.get("messages", []) if updated_conv else [])
        if m["content"] != last_user_prompt
    ]

    target_model = model or conv.get("model") or "qwen2.5:1.5b"
    reply, model_used, _ = process_chat(
        user_message=last_user_prompt,
        conversation_id=conv_id,
        client_history=preceding_msgs,
        model_name=target_model,
        mode=conv.get("mode", "chat"),
        system_prompt=conv.get("system_prompt")
    )

    refreshed = get_conversation(conv_id)
    return {
        "response": reply,
        "model": model_used,
        "conversation": refreshed
    }

@app.post("/api/conversations/{conv_id}/messages/{message_id}/trim")
def trim_conversation_after_message(conv_id: str, message_id: str):
    """
    Deletes the specified message and all subsequent messages in a conversation.
    Enables clean conversation editing, branching, and resending from a previous point.
    """
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    delete_messages_after(conv_id, message_id)
    refreshed = get_conversation(conv_id)
    return {
        "status": "trimmed",
        "conversation_id": conv_id,
        "message_id": message_id,
        "messages": refreshed.get("messages", []) if refreshed else []
    }

# ----------------- Document Assistant Endpoints -----------------

@app.post("/api/documents/upload")
async def upload_document_endpoint(
    conversation_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Uploads PDF, DOCX, TXT, MD, CSV, or JSON document.
    Extracts text, splits into semantic chunks, and persists into SQLite for grounded RAG.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    # Security: sanitize filename to prevent path traversal
    safe_filename = Path(file.filename).name
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"doc_{os.urandom(4).hex()}_{safe_filename}")

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract text
        extracted_text, _ = extract_text_from_file(temp_path, safe_filename)
        # Chunk text
        chunks = chunk_text(extracted_text, chunk_size=700, chunk_overlap=100)
        
        file_size = os.path.getsize(temp_path)
        file_ext = os.path.splitext(safe_filename)[1].lower()

        # Store in database
        doc_record = store_document(
            conversation_id=conversation_id,
            filename=safe_filename,
            file_type=file_ext,
            file_size=file_size,
            chunks=chunks
        )

        return {
            "status": "success",
            "document": doc_record,
            "message": f"Successfully processed '{safe_filename}' into {len(chunks)} searchable chunks."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Document processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Error extracting document: {str(e)}")
    finally:
        safe_remove_file(temp_path)

@app.get("/api/documents/{conv_id}")
def get_documents_endpoint(conv_id: str):
    """Lists all documents associated with a conversation."""
    return {"documents": list_documents(conv_id)}

@app.delete("/api/documents/{doc_id}")
def delete_document_endpoint(doc_id: str):
    """Deletes an uploaded document and its chunks."""
    success = delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": "deleted", "id": doc_id}

# ----------------- Notes Endpoints -----------------

@app.get("/api/notes")
def get_notes():
    """Retrieves all persistent user notes."""
    return {"notes": list_notes()}

@app.post("/api/notes")
def create_note_endpoint(req: NoteRequest):
    """Creates a new note."""
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Note title cannot be empty.")
    return create_note(title=req.title.strip(), content=req.content, tags=req.tags or "")

@app.put("/api/notes/{note_id}")
def update_note_endpoint(note_id: str, req: NoteRequest):
    """Updates an existing note."""
    updated = update_note(nid=note_id, title=req.title, content=req.content, tags=req.tags)
    if not updated:
        raise HTTPException(status_code=404, detail="Note not found.")
    return updated

@app.delete("/api/notes/{note_id}")
def delete_note_endpoint(note_id: str):
    """Deletes a note."""
    if not delete_note(note_id):
        raise HTTPException(status_code=404, detail="Note not found.")
    return {"status": "deleted", "id": note_id}

# ----------------- Tasks Endpoints -----------------

@app.get("/api/tasks")
def get_tasks():
    """Retrieves all persistent tasks."""
    return {"tasks": list_tasks()}

@app.post("/api/tasks")
def create_task_endpoint(req: TaskRequest):
    """Creates a new task."""
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Task title cannot be empty.")
    return create_task(
        title=req.title.strip(),
        description=req.description or "",
        priority=req.priority or "medium",
        due_date=req.due_date or ""
    )

@app.put("/api/tasks/{task_id}")
def update_task_endpoint(task_id: str, req: TaskRequest):
    """Updates task status, title, description, or priority."""
    updated = update_task(
        tid=task_id,
        title=req.title,
        description=req.description,
        status=req.status,
        priority=req.priority,
        due_date=req.due_date
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found.")
    return updated

@app.delete("/api/tasks/{task_id}")
def delete_task_endpoint(task_id: str):
    """Deletes a task."""
    if not delete_task(task_id):
        raise HTTPException(status_code=404, detail="Task not found.")
    return {"status": "deleted", "id": task_id}

# ----------------- Settings Endpoints -----------------

@app.get("/api/settings")
def get_all_settings():
    """Retrieves persistent user preferences."""
    return {
        "model": get_setting("model", DEFAULT_MODEL),
        "theme": get_setting("theme", "dark"),
        "voice_enabled": get_setting("voice_enabled", True),
        "voice_rate": get_setting("voice_rate", 1.0),
        "voice_pitch": get_setting("voice_pitch", 1.0),
        "voice_uri": get_setting("voice_uri", "")
    }

@app.post("/api/settings")
def save_setting(req: SettingRequest):
    """Saves a persistent user preference."""
    set_setting(req.key, req.value)
    return {"status": "saved", "key": req.key, "value": req.value}

# ----------------- Speech-to-Text Endpoint -----------------

@app.post("/api/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    """Transcribes uploaded audio file using local faster-whisper on CPU."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No audio file uploaded.")
        
    temp_dir = tempfile.gettempdir()
    extension = os.path.splitext(file.filename)[1] or ".webm"
    temp_path = os.path.join(temp_dir, f"voice_{os.urandom(4).hex()}{extension}")
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        transcribed_text = transcribe_audio_file(temp_path)
        return {"text": transcribed_text}
    except Exception as e:
        safe_remove_file(temp_path)
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Could not understand the audio: {str(e)}")

# Legacy compatibility endpoints
@app.post("/api/clear")
def clear_chat_endpoint():
    """Clears active conversation history."""
    clear_conversation()
    return {"status": "cleared", "history": []}

@app.get("/api/history")
def get_history_endpoint():
    """Retrieves current session history."""
    return {"history": session_conversation.get_history()}

if __name__ == "__main__":
    import uvicorn
    app_target = "main:app" if Path.cwd() == Path(__file__).resolve().parent else "backend.main:app"
    uvicorn.run(app_target, host="127.0.0.1", port=BACKEND_PORT, reload=True)
