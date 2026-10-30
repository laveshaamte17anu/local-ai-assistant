# 🤖 Local AI Assistant

A 100% private, local AI assistant powered by **FastAPI**, **React 19 / Vite**, **SQLite (WAL mode)**, **faster-whisper**, and **Ollama**.

No cloud APIs, no external telemetry, and no data leaves your machine.

---

## ✨ Features

- **Reliable Local AI Engine**: Direct integration with Ollama (`http://localhost:11434`) supporting live token streaming via Server-Sent Events (SSE).
- **Zero Mock / Placeholder Responses**: Real AI responses from your installed local models with honest connection status checks (`Connected`, `Checking`, `Disconnected`, `Model Unavailable`).
- **Deep Reasoning Filter**: Automatic clean streaming and stripping of `<think>...</think>` internal reasoning tags for models like Qwen 3.
- **Context-Aware Conversations**: Configurable context window preserving user and assistant message sequence, separating system instructions from user inputs.
- **SQLite Persistence (WAL mode)**: All conversations, messages, documents, notes, and tasks persist safely across restarts in `backend/data/localai.db`.
- **Full-Text Search**: Search past conversations by title or full message content.
- **Message Editing & Branch Trimming**: Edit previous user messages; the backend automatically trims subsequent branched messages and regenerates context-aware responses.
- **Document Assistant (Local RAG)**: Upload PDF, DOCX, TXT, MD, CSV, or JSON files. Automatic text extraction, chunking, BM25 keyword retrieval, and grounding in model prompts with source citations.
- **Specialized AI Modes & Templates**:
  - **Coding Assistant**: Explain code, find bugs, generate examples, explain error traces.
  - **Study Assistant**: Explain concepts simply, generate quizzes and practice questions, step-by-step tutorials.
  - **Writing Assistant**: Email drafting, text polishing, summarizing, brainstorming.
- **Notes & Task Manager**: Integrated panel for creating, updating, completing, and deleting personal notes and to-do items.
- **Exporting**: Export any conversation to Markdown (`.md`), Plain Text (`.txt`), or JSON.
- **Voice Input & Local TTS**: In-browser microphone recording with local Whisper (`faster-whisper` CPU int8) and browser speech synthesis.
- **Syntax-Highlighted Code Blocks**: Built-in zero-dependency syntax highlighting for Python, JavaScript/TypeScript, SQL, and Bash/Shell with one-click code copy.

---

## 🏗️ Architecture

```text
       ┌────────────────────────────────────────────────────────┐
       │                React 19 Frontend (Vite)                │
       │   Chat, Markdown, Sidebar, Notes, Templates, Settings  │
       └────────────────────────┬───────────────────────────────┘
                                │ HTTP / SSE Streams (port 8002)
       ┌────────────────────────▼───────────────────────────────┐
       │                  FastAPI Backend Server                │
       │  /api/chat/stream, /api/documents, /api/notes, etc.   │
       └───┬────────────────────┬───────────────────────────┬───┘
           │                    │                           │
┌──────────▼──────────┐ ┌───────▼─────────────┐ ┌───────────▼───────────┐
│     Local Ollama    │ │  SQLite Database    │ │   faster-whisper      │
│ http://localhost:   │ │  (WAL Mode)         │ │   (Local CPU int8)    │
│ 11434               │ │  backend/data/      │ │   In-memory / safe    │
│ qwen2.5:1.5b        │ │  localai.db         │ │   temp audio files    │
│ qwen3:4b            │ └─────────────────────┘ └───────────────────────┘
└─────────────────────┘
```

---

## ⚙️ Prerequisites & Setup

### 1. Requirements
- **Python**: 3.10+ installed
- **Node.js**: v18+ installed
- **Ollama**: Installed and running from [ollama.com](https://ollama.com/)

### 2. Ollama Models Setup
Ensure Ollama is running (`ollama serve`). Pull your preferred model(s):

```bash
# Recommended fast model:
ollama pull qwen2.5:1.5b

# Or deeper reasoning model:
ollama pull qwen3:4b
```

### 3. Backend Setup
From the project root:

```bash
# Optional: create and activate virtual environment
python -m venv backend/venv
backend\venv\Scripts\activate   # On Windows
# source backend/venv/bin/activate  # On Linux/macOS

# Install Python dependencies
pip install -r requirements.txt
```

### 4. Frontend Setup
From the project root:

```bash
cd frontend
npm install
cd ..
```

### 5. Environment Configuration
Create a `.env` file in the project root (or copy `.env.example`):

```ini
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_TIMEOUT=180
WHISPER_MODEL=base
BACKEND_PORT=8002
```

---

## 🚀 Running the Application

### Option A: 1-Click Startup (Windows)
Double-click `run.bat` or run:
```cmd
run.bat
```
This automatically starts:
1. FastAPI backend on `http://127.0.0.1:8002`
2. Vite frontend on `http://localhost:5174`
3. Launches your default browser to `http://localhost:5174`

### Option B: Manual Startup

**Terminal 1 — Backend:**
```bash
# Using the venv python
backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8002 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Visit **`http://localhost:5174`** in your browser.

---

## 🧪 Testing & Verification

### Run Automated Backend & Persistence Tests
```bash
backend\venv\Scripts\pytest tests/
```
Tests cover:
- Health and status endpoints (`/api/health`, `/api/status`)
- Ollama client connectivity and dynamic model resolution
- Qwen3 `<think>` tag stripping filter
- Conversation creation, listing, search, renaming, message trimming, and deletion
- SQLite message persistence and message retrieval
- In-memory document chunking and BM25 retrieval
- Notes & Tasks CRUD operations

### Run Frontend Build & Lint Checks
```bash
cd frontend
npm run lint
npm run build
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/status` | Detailed Ollama and SQLite connection status |
| `GET` | `/api/models` | List of installed Ollama models and current default |
| `POST` | `/api/chat` | Non-streaming chat completion |
| `POST` | `/api/chat/stream` | Server-Sent Events (SSE) token streaming chat |
| `GET` | `/api/conversations` | List conversations (supports `?search=query`) |
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations/{id}` | Get conversation with all messages |
| `PATCH` | `/api/conversations/{id}` | Rename conversation title |
| `DELETE` | `/api/conversations/{id}` | Delete conversation and its messages |
| `POST` | `/api/conversations/{id}/messages/{msg_id}/trim` | Trim conversation history after an edited message |
| `POST` | `/api/documents/upload` | Upload document (PDF, DOCX, TXT, MD, CSV, JSON) |
| `GET` | `/api/documents/{id}/chunks` | Retrieve chunked text extracts from uploaded document |
| `GET` | `/api/notes` | List saved notes |
| `POST` | `/api/notes` | Create a note |
| `DELETE` | `/api/notes/{id}` | Delete a note |
| `GET` | `/api/tasks` | List to-do tasks |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/{id}` | Toggle task completed state |
| `DELETE` | `/api/tasks/{id}` | Delete a task |
| `POST` | `/api/transcribe` | Transcribe voice audio via faster-whisper |

---

## 🛡️ Privacy & Security
- **100% Local**: All inference, database storage, document parsing, and transcription are executed on your local machine.
- **Path Traversal Protection**: Uploaded file names are strictly sanitized with secure temporary file handling.
- **No Leaked Stack Traces**: Production error responses return structured, sanitized JSON error payloads.
