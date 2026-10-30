import sys
import os
from pathlib import Path

# Add project root directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# pyrefly: ignore[missing-import]
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import (
    create_conversation,
    get_conversation,
    add_message,
    list_conversations,
    delete_conversation,
    create_note,
    list_notes,
    delete_note,
    create_task,
    list_tasks,
    delete_task,
)
from backend.document_processor import chunk_text, retrieve_relevant_chunks, format_document_context
from backend.ollama_client import check_model_available, resolve_model

client = TestClient(app)

def test_conversation_lifecycle():
    # Create conversation
    conv = create_conversation(title="Pytest Test Chat", model="qwen2.5:1.5b")
    assert conv["id"] is not None
    assert conv["title"] == "Pytest Test Chat"
    cid = conv["id"]

    # Add messages
    m1 = add_message(conversation_id=cid, role="user", content="Hello test!")
    assert m1["role"] == "user"
    assert m1["content"] == "Hello test!"

    m2 = add_message(conversation_id=cid, role="assistant", content="Hello! How can I assist you?")
    assert m2["role"] == "assistant"

    # Fetch conversation
    fetched = get_conversation(cid)
    assert fetched is not None
    assert len(fetched["messages"]) == 2
    assert fetched["messages"][0]["content"] == "Hello test!"

    # Clean up
    delete_conversation(cid)
    assert get_conversation(cid) is None

def test_document_chunking_and_retrieval():
    text = (
        "Ollama is an open-source tool that allows users to run large language models locally. "
        "It supports models such as Llama, Qwen, and Mistral on macOS, Linux, and Windows.\n\n"
        "Whisper is an automatic speech recognition model trained by OpenAI. "
        "Faster-whisper uses CTranslate2 to achieve high-speed inference on CPU."
    )
    chunks = chunk_text(text, chunk_size=120, chunk_overlap=20)
    assert len(chunks) >= 2

    chunks_with_meta = [
        {"content": c, "filename": "tech_overview.txt", "chunk_index": i}
        for i, c in enumerate(chunks)
    ]
    retrieved = retrieve_relevant_chunks("CTranslate2 speech recognition", chunks_with_meta, top_k=1)
    assert len(retrieved) == 1
    assert "Whisper" in retrieved[0]["content"] or "CTranslate2" in retrieved[0]["content"]

    context_str = format_document_context(retrieved)
    assert "tech_overview.txt" in context_str

def test_notes_crud_api():
    res = client.post("/api/notes", json={"title": "Test Note", "content": "Important note content", "tags": "work,ai"})
    assert res.status_code == 200
    note = res.json()
    assert note["title"] == "Test Note"
    nid = note["id"]

    # List notes
    list_res = client.get("/api/notes")
    assert list_res.status_code == 200
    notes = list_res.json()["notes"]
    assert any(n["id"] == nid for n in notes)

    # Delete note
    del_res = client.delete(f"/api/notes/{nid}")
    assert del_res.status_code == 200

def test_tasks_crud_api():
    res = client.post("/api/tasks", json={"title": "Test Task", "description": "Finish coding", "priority": "high"})
    assert res.status_code == 200
    task = res.json()
    assert task["title"] == "Test Task"
    tid = task["id"]

    # List tasks
    list_res = client.get("/api/tasks")
    assert list_res.status_code == 200
    tasks = list_res.json()["tasks"]
    assert any(t["id"] == tid for t in tasks)

    # Delete task
    del_res = client.delete(f"/api/tasks/{tid}")
    assert del_res.status_code == 200

def test_model_availability_checks():
    # qwen2.5:1.5b is installed
    assert check_model_available("qwen2.5:1.5b") is True
    # Fake model should be false
    assert check_model_available("non_existent_fake_model_xyz:99b") is False

def test_trim_conversation_api():
    conv = create_conversation(title="Trim Test Chat")
    cid = conv["id"]
    m1 = add_message(cid, "user", "Message 1")
    m2 = add_message(cid, "assistant", "Message 2")
    m3 = add_message(cid, "user", "Message 3")

    res = client.post(f"/api/conversations/{cid}/messages/{m2['id']}/trim")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "trimmed"
    assert len(data["messages"]) == 1
    assert data["messages"][0]["id"] == m1["id"]

    delete_conversation(cid)

def test_search_conversations_api():
    unique_keyword = "quantum_superposition_xyz789"
    conv = create_conversation(title="Physics Notes")
    cid = conv["id"]
    add_message(cid, "user", f"Tell me about {unique_keyword}")

    res = client.get(f"/api/conversations?search={unique_keyword}")
    assert res.status_code == 200
    results = res.json()["conversations"]
    assert any(c["id"] == cid for c in results)

    delete_conversation(cid)
