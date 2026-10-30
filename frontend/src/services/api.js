const API_BASE = '/api';

/**
 * Checks system health.
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches comprehensive status details.
 */
export async function fetchSystemStatus() {
  const response = await fetch(`${API_BASE}/status`);
  if (!response.ok) {
    throw new Error(`Status check failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Checks local model availability.
 */
export async function checkModelStatus(modelName = null) {
  const url = modelName ? `${API_BASE}/model?name=${encodeURIComponent(modelName)}` : `${API_BASE}/model`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Model status check failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches available models from local Ollama.
 */
export async function fetchModels() {
  const response = await fetch(`${API_BASE}/models`);
  if (!response.ok) {
    throw new Error(`Failed to fetch models with status ${response.status}`);
  }
  return response.json();
}

/**
 * Streams chat response using SSE over HTTP ReadableStream.
 * Supports cancellation via AbortSignal.
 */
export async function streamChatMessage({
  message,
  conversationId,
  history = [],
  model = null,
  mode = 'chat',
  systemPrompt = null,
  signal = null,
  onToken,
  onDone,
  onError
}) {
  const payload = {
    message,
    conversation_id: conversationId,
    history,
    model,
    mode,
    system_prompt: systemPrompt
  };

  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Chat request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';
    let usedModel = model;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.model) {
              usedModel = data.model;
            }
            if (data.token) {
              accumulatedText += data.token;
              onToken?.(data.token, accumulatedText, usedModel);
            }
            if (data.done) {
              const finalText = data.full_text || accumulatedText;
              onDone?.(finalText, data.model || usedModel);
              return { fullText: finalText, model: data.model || usedModel };
            }
          } catch {
            // If data wasn't JSON or parse error, ignore or continue
          }
        }
      }
    }

    onDone?.(accumulatedText, usedModel);
    return { fullText: accumulatedText, model: usedModel };
  } catch (err) {
    if (err.name === 'AbortError') {
      onError?.(new Error('Generation stopped by user.'));
      return { aborted: true };
    }
    onError?.(err);
    throw err;
  }
}

/**
 * Non-streaming fallback chat request.
 */
export async function sendChatMessage(message, conversationId = null, history = [], model = null, mode = 'chat') {
  const payload = { message, conversation_id: conversationId, history, model, mode };
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Conversations CRUD
 */
export async function fetchConversations(search = '') {
  const url = search ? `${API_BASE}/conversations?search=${encodeURIComponent(search)}` : `${API_BASE}/conversations`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load conversations.');
  return response.json();
}

export async function fetchConversation(id) {
  const response = await fetch(`${API_BASE}/conversations/${id}`);
  if (!response.ok) throw new Error('Failed to load conversation details.');
  return response.json();
}

export async function createConversation(data = {}) {
  const response = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create conversation.');
  return response.json();
}

export async function updateConversation(id, data = {}) {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update conversation.');
  return response.json();
}

export async function deleteConversation(id) {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete conversation.');
  return response.json();
}

export async function clearConversationMessages(id) {
  const response = await fetch(`${API_BASE}/conversations/${id}/clear`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to clear conversation.');
  return response.json();
}

export async function regenerateResponse(conversationId, model = null) {
  const url = model
    ? `${API_BASE}/conversations/${conversationId}/regenerate?model=${encodeURIComponent(model)}`
    : `${API_BASE}/conversations/${conversationId}/regenerate`;
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to regenerate response.');
  }
  return response.json();
}

export async function trimConversationMessages(conversationId, messageId) {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages/${messageId}/trim`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to trim conversation.');
  }
  return response.json();
}

/**
 * Document Assistant API
 */
export async function uploadDocument(conversationId, file) {
  const formData = new FormData();
  formData.append('conversation_id', conversationId);
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload document.');
  }
  return response.json();
}

export async function fetchDocuments(conversationId) {
  const response = await fetch(`${API_BASE}/documents/${conversationId}`);
  if (!response.ok) throw new Error('Failed to fetch documents.');
  return response.json();
}

export async function deleteDocument(docId) {
  const response = await fetch(`${API_BASE}/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete document.');
  return response.json();
}

/**
 * Notes API
 */
export async function fetchNotes() {
  const response = await fetch(`${API_BASE}/notes`);
  if (!response.ok) throw new Error('Failed to fetch notes.');
  return response.json();
}

export async function createNote(data) {
  const response = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create note.');
  return response.json();
}

export async function updateNote(id, data) {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update note.');
  return response.json();
}

export async function deleteNote(id) {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete note.');
  return response.json();
}

/**
 * Tasks API
 */
export async function fetchTasks() {
  const response = await fetch(`${API_BASE}/tasks`);
  if (!response.ok) throw new Error('Failed to fetch tasks.');
  return response.json();
}

export async function createTask(data) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create task.');
  return response.json();
}

export async function updateTask(id, data) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update task.');
  return response.json();
}

export async function deleteTask(id) {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete task.');
  return response.json();
}

/**
 * Settings API
 */
export async function fetchSettings() {
  const response = await fetch(`${API_BASE}/settings`);
  if (!response.ok) throw new Error('Failed to fetch settings.');
  return response.json();
}

export async function saveSetting(key, value) {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  if (!response.ok) throw new Error('Failed to save setting.');
  return response.json();
}

/**
 * Whisper STT Audio Transcription
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'voice_input.webm');

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Could not understand the audio. Please try again.');
  }

  return response.json();
}

/**
 * Clears legacy conversation history.
 */
export async function clearChatHistory() {
  const response = await fetch(`${API_BASE}/clear`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Clear chat failed with status ${response.status}`);
  }
  return response.json();
}
