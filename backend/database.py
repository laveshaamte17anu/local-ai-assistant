import sqlite3
import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

# Database storage path
DB_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DB_DIR / "localai.db"

def get_connection() -> sqlite3.Connection:
    """Creates a thread-safe connection to the SQLite database with WAL mode."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    """Initializes database schema if tables do not exist."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT NOT NULL,
        system_prompt TEXT DEFAULT '',
        mode TEXT DEFAULT 'chat',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        due_date TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_doc_chunks_conv ON document_chunks(conversation_id);
    """)

    conn.commit()
    conn.close()

# ----------------- Conversations CRUD -----------------

def list_conversations(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.*, 
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c
        ORDER BY c.updated_at DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    conv = dict(row)
    
    cursor.execute("""
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC
    """, (conv_id,))
    conv["messages"] = [dict(m) for m in cursor.fetchall()]
    conn.close()
    return conv

def create_conversation(
    conv_id: Optional[str] = None,
    title: str = "New Conversation",
    model: str = "qwen2.5:1.5b",
    system_prompt: str = "",
    mode: str = "chat"
) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cid = conv_id or f"conv_{int(datetime.now().timestamp()*1000)}_{uuid.uuid4().hex[:6]}"
    
    cursor.execute("""
        INSERT INTO conversations (id, title, model, system_prompt, mode, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (cid, title, model, system_prompt, mode, now, now))
    conn.commit()
    conn.close()
    return {
        "id": cid,
        "title": title,
        "model": model,
        "system_prompt": system_prompt,
        "mode": mode,
        "created_at": now,
        "updated_at": now,
        "messages": []
    }

def update_conversation(
    conv_id: str,
    title: Optional[str] = None,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    mode: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    updates = ["updated_at = ?"]
    params = [now]
    
    if title is not None:
        updates.append("title = ?")
        params.append(title)
    if model is not None:
        updates.append("model = ?")
        params.append(model)
    if system_prompt is not None:
        updates.append("system_prompt = ?")
        params.append(system_prompt)
    if mode is not None:
        updates.append("mode = ?")
        params.append(mode)
        
    params.append(conv_id)
    cursor.execute(f"UPDATE conversations SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return get_conversation(conv_id)

def delete_conversation(conv_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM document_chunks WHERE conversation_id = ?", (conv_id,))
    cursor.execute("DELETE FROM documents WHERE conversation_id = ?", (conv_id,))
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def search_conversations(query: str) -> List[Dict[str, Any]]:
    """Search conversations by title or message contents."""
    conn = get_connection()
    cursor = conn.cursor()
    search_term = f"%{query}%"
    cursor.execute("""
        SELECT DISTINCT c.*
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.title LIKE ? OR m.content LIKE ?
        ORDER BY c.updated_at DESC
        LIMIT 50
    """, (search_term, search_term))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ----------------- Messages CRUD -----------------

def add_message(
    conversation_id: str,
    role: str,
    content: str,
    model: Optional[str] = None,
    msg_id: Optional[str] = None,
    status: str = "completed"
) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    mid = msg_id or f"msg_{int(datetime.now().timestamp()*1000)}_{uuid.uuid4().hex[:6]}"
    
    # Ensure conversation exists
    cursor.execute("SELECT id FROM conversations WHERE id = ?", (conversation_id,))
    if not cursor.fetchone():
        # Auto-create conversation
        cursor.execute("""
            INSERT INTO conversations (id, title, model, system_prompt, mode, created_at, updated_at)
            VALUES (?, ?, ?, '', 'chat', ?, ?)
        """, (conversation_id, content[:36] + ("..." if len(content) > 36 else ""), model or "qwen2.5:1.5b", now, now))
    
    cursor.execute("""
        INSERT INTO messages (id, conversation_id, role, content, model, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (mid, conversation_id, role, content, model, status, now))
    
    cursor.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
    conn.commit()
    conn.close()
    return {
        "id": mid,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "model": model,
        "status": status,
        "created_at": now
    }

def update_message(msg_id: str, content: str, status: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute("UPDATE messages SET content = ?, status = ? WHERE id = ?", (content, status, msg_id))
    else:
        cursor.execute("UPDATE messages SET content = ? WHERE id = ?", (content, msg_id))
    conn.commit()
    cursor.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_messages_after(conversation_id: str, message_id: str) -> bool:
    """Deletes the specified message and all subsequent messages in a conversation (useful for edit & regenerate)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?", (message_id, conversation_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    msg_time = row["created_at"]
    cursor.execute("DELETE FROM messages WHERE conversation_id = ? AND created_at >= ?", (conversation_id, msg_time))
    deleted = cursor.rowcount > 0
    now = datetime.now().isoformat()
    cursor.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
    conn.commit()
    conn.close()
    return deleted

def delete_last_assistant_message(conversation_id: str) -> Optional[str]:
    """Deletes the latest assistant message in the conversation (for regenerate). Returns deleted message id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id FROM messages 
        WHERE conversation_id = ? AND role = 'assistant'
        ORDER BY created_at DESC 
        LIMIT 1
    """, (conversation_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    mid = row["id"]
    cursor.execute("DELETE FROM messages WHERE id = ?", (mid,))
    conn.commit()
    conn.close()
    return mid

def clear_conversation_messages(conversation_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    now = datetime.now().isoformat()
    cursor.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
    conn.commit()
    conn.close()
    return True

# ----------------- Documents & Chunks -----------------

def store_document(
    conversation_id: str,
    filename: str,
    file_type: str,
    file_size: int,
    chunks: List[str]
) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    doc_id = f"doc_{int(datetime.now().timestamp()*1000)}_{uuid.uuid4().hex[:6]}"
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO documents (id, conversation_id, filename, file_type, file_size, chunk_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (doc_id, conversation_id, filename, file_type, file_size, len(chunks), now))
    
    for idx, chunk in enumerate(chunks):
        chunk_id = f"chk_{doc_id}_{idx}"
        cursor.execute("""
            INSERT INTO document_chunks (id, document_id, conversation_id, chunk_index, content)
            VALUES (?, ?, ?, ?, ?)
        """, (chunk_id, doc_id, conversation_id, idx, chunk))
        
    conn.commit()
    conn.close()
    return {
        "id": doc_id,
        "conversation_id": conversation_id,
        "filename": filename,
        "file_type": file_type,
        "file_size": file_size,
        "chunk_count": len(chunks),
        "created_at": now
    }

def list_documents(conversation_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM documents 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC
    """, (conversation_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_document(doc_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id,))
    cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def get_conversation_chunks(conversation_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT dc.id, dc.content, dc.chunk_index, d.filename
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.conversation_id = ?
        ORDER BY d.created_at ASC, dc.chunk_index ASC
    """, (conversation_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ----------------- Notes CRUD -----------------

def list_notes() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notes ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def create_note(title: str, content: str, tags: str = "") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    nid = f"note_{int(datetime.now().timestamp()*1000)}_{uuid.uuid4().hex[:6]}"
    now = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO notes (id, title, content, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (nid, title, content, tags, now, now))
    conn.commit()
    conn.close()
    return {
        "id": nid,
        "title": title,
        "content": content,
        "tags": tags,
        "created_at": now,
        "updated_at": now
    }

def update_note(nid: str, title: Optional[str] = None, content: Optional[str] = None, tags: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    updates = ["updated_at = ?"]
    params = [now]
    if title is not None:
        updates.append("title = ?")
        params.append(title)
    if content is not None:
        updates.append("content = ?")
        params.append(content)
    if tags is not None:
        updates.append("tags = ?")
        params.append(tags)
    params.append(nid)
    cursor.execute(f"UPDATE notes SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM notes WHERE id = ?", (nid,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_note(nid: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ?", (nid,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# ----------------- Tasks CRUD -----------------

def list_tasks() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def create_task(title: str, description: str = "", priority: str = "medium", due_date: str = "") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    tid = f"task_{int(datetime.now().timestamp()*1000)}_{uuid.uuid4().hex[:6]}"
    now = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO tasks (id, title, description, status, priority, due_date, created_at, updated_at)
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
    """, (tid, title, description, priority, due_date, now, now))
    conn.commit()
    conn.close()
    return {
        "id": tid,
        "title": title,
        "description": description,
        "status": "pending",
        "priority": priority,
        "due_date": due_date,
        "created_at": now,
        "updated_at": now
    }

def update_task(
    tid: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    due_date: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    updates = ["updated_at = ?"]
    params = [now]
    if title is not None:
        updates.append("title = ?")
        params.append(title)
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if priority is not None:
        updates.append("priority = ?")
        params.append(priority)
    if due_date is not None:
        updates.append("due_date = ?")
        params.append(due_date)
    params.append(tid)
    cursor.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (tid,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_task(tid: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (tid,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# ----------------- Settings CRUD -----------------

def get_setting(key: str, default: Any = None) -> Any:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        try:
            return json.loads(row["value"])
        except Exception:
            return row["value"]
    return default

def set_setting(key: str, value: Any):
    conn = get_connection()
    cursor = conn.cursor()
    val_str = json.dumps(value) if not isinstance(value, str) else value
    cursor.execute("""
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    """, (key, val_str))
    conn.commit()
    conn.close()

# Auto-initialize on import
init_db()
