from typing import List, Dict, Optional, Tuple, Any
from backend.ollama_client import generate_response as generate_ollama_response
from backend.conversation import session_conversation
from backend.database import (
    get_conversation,
    create_conversation,
    add_message,
    get_conversation_chunks,
    clear_conversation_messages
)
from backend.document_processor import retrieve_relevant_chunks, format_document_context

def process_chat(
    user_message: str,
    conversation_id: Optional[str] = None,
    client_history: Optional[List[Dict[str, str]]] = None,
    model_name: Optional[str] = None,
    mode: str = "chat",
    system_prompt: Optional[str] = None
) -> Tuple[str, str, str]:
    """
    Processes chat message:
    1. Validates and ensures conversation exists in DB.
    2. Persists user message.
    3. Retrieves grounded document context if files were uploaded to this conversation.
    4. Calls local Ollama model.
    5. Persists assistant message to DB.
    Returns (response_text, model_used, conversation_id).
    """
    if not user_message or not user_message.strip():
        raise ValueError("Message content cannot be empty.")

    clean_message = user_message.strip()
    cid = conversation_id or "default_session"

    # Ensure conversation exists in DB
    conv = get_conversation(cid)
    if not conv:
        initial_title = clean_message[:36].strip() + ("..." if len(clean_message) > 36 else "")
        create_conversation(conv_id=cid, title=initial_title, model=model_name or "qwen2.5:1.5b", mode=mode)
        conv = get_conversation(cid)

    # Persist user message
    add_message(conversation_id=cid, role="user", content=clean_message)

    # Retrieve history for context
    db_messages = conv.get("messages", []) if conv else []
    history_for_llm = []
    for m in db_messages:
        # Exclude the current message we just added
        if m.get("content") != clean_message or m.get("role") != "user":
            history_for_llm.append({"role": m["role"], "content": m["content"]})

    # If client passed history and DB was empty, use client history
    if not history_for_llm and client_history:
        history_for_llm = [
            m for m in client_history 
            if isinstance(m, dict) and "role" in m and "content" in m and m.get("content") != clean_message
        ]

    # Check for document chunks attached to this conversation
    doc_chunks = get_conversation_chunks(cid)
    document_context = None
    if doc_chunks:
        top_chunks = retrieve_relevant_chunks(clean_message, doc_chunks, top_k=4)
        if top_chunks:
            document_context = format_document_context(top_chunks)

    # Call local Ollama model
    effective_sys_prompt = system_prompt or (conv.get("system_prompt") if conv else None)
    effective_mode = mode or (conv.get("mode") if conv else "chat")

    response_text, model_used = generate_ollama_response(
        prompt=clean_message,
        history=history_for_llm,
        model_name=model_name or (conv.get("model") if conv else None),
        system_prompt=effective_sys_prompt,
        mode=effective_mode,
        document_context=document_context
    )

    # Persist assistant response
    add_message(conversation_id=cid, role="assistant", content=response_text, model=model_used)

    # Sync memory session instance for backward compatibility
    session_conversation.add_user_message(clean_message, conversation_id=cid)
    session_conversation.add_assistant_message(response_text, model=model_used, conversation_id=cid)

    return response_text, model_used, cid

def clear_conversation(conversation_id: Optional[str] = None):
    cid = conversation_id or "default_session"
    clear_conversation_messages(cid)
    session_conversation.clear(cid)
