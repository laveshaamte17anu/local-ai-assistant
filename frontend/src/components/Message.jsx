import React, { useState } from 'react';
import { Copy, Check, Volume2, Square, RotateCcw, Edit2, X, Send, Play, Pause } from 'lucide-react';
import MarkdownContent from './MarkdownContent';

export default function Message({
  message,
  activeModel,
  onSpeak,
  onPauseSpeak,
  onResumeSpeak,
  onStopSpeak,
  speechPlaybackState = 'idle',
  isSpeakingThis,
  onRegenerate,
  onEditMessage,
  isStreaming = false,
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy message:', err);
    }
  };

  const handleSaveEdit = (e) => {
    e?.preventDefault();
    if (!editText.trim()) return;
    onEditMessage?.(message.id, editText.trim());
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  const formattedTime = message.created_at || message.timestamp
    ? new Date(message.created_at || message.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  return (
    <article className={`message-entry ${isUser ? 'user-entry' : 'assistant-entry'} ${isSpeakingThis ? 'speaking-active-entry' : ''}`}>
      <div className="message-meta">
        <span className="author-label">{isUser ? 'You' : 'LocalAI'}</span>
        {!isUser && (message.model || activeModel) && (
          <span className="model-subtag">{message.model || activeModel}</span>
        )}
        {!isUser && isSpeakingThis && (
          <span className={`speaking-status-pill ${speechPlaybackState === 'paused' ? 'paused' : 'speaking'}`}>
            {speechPlaybackState === 'paused' ? (
              <>
                <span className="paused-icon-dot" />
                <span>Audio Paused</span>
              </>
            ) : (
              <>
                <span className="audio-live-waves" aria-hidden="true">
                  <span className="wave-tick" />
                  <span className="wave-tick" />
                  <span className="wave-tick" />
                </span>
                <span>Reading Aloud...</span>
              </>
            )}
          </span>
        )}
        {formattedTime && <time className="message-timestamp">{formattedTime}</time>}
      </div>

      <div className="message-body">
        {isUser ? (
          isEditing ? (
            <form className="message-edit-form" onSubmit={handleSaveEdit}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="message-edit-textarea"
                rows={Math.max(2, editText.split('\n').length)}
                autoFocus
              />
              <div className="message-edit-actions">
                <button
                  type="submit"
                  className="msg-btn-primary"
                  title="Save & regenerate"
                >
                  <Send size={12} />
                  <span>Update</span>
                </button>
                <button
                  type="button"
                  className="msg-btn-secondary"
                  onClick={handleCancelEdit}
                >
                  <X size={12} />
                  <span>Cancel</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="user-text">{message.content}</div>
          )
        ) : !message.content && isStreaming ? (
          <div className="assistant-thinking-indicator">
            <span className="thinking-pulse-dot" />
            <span className="thinking-text">Thinking...</span>
          </div>
        ) : (
          <MarkdownContent content={message.content} isStreaming={isStreaming} />
        )}
      </div>

      <div className="message-actions">
        <button
          type="button"
          className="msg-action-btn"
          onClick={handleCopy}
          title="Copy text"
          aria-label="Copy text"
        >
          {copied ? (
            <>
              <Check size={12} className="rust" />
              <span className="rust">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>

        {isUser && onEditMessage && !isEditing && (
          <button
            type="button"
            className="msg-action-btn"
            onClick={() => setIsEditing(true)}
            title="Edit message"
            aria-label="Edit message"
          >
            <Edit2 size={12} />
            <span>Edit</span>
          </button>
        )}

        {!isUser && onRegenerate && !isStreaming && (
          <button
            type="button"
            className="msg-action-btn"
            onClick={() => onRegenerate(message)}
            title="Regenerate response"
            aria-label="Regenerate response"
          >
            <RotateCcw size={12} />
            <span>Regenerate</span>
          </button>
        )}

        {/* Voice Playback Controls for Assistant Messages */}
        {!isUser && message.content && (
          isSpeakingThis ? (
            <div className="voice-playback-control-cluster" role="group" aria-label="Speech playback controls">
              {speechPlaybackState === 'speaking' ? (
                <button
                  type="button"
                  className="msg-action-btn active-speaking"
                  onClick={onPauseSpeak}
                  title="Pause speech playback"
                  aria-label="Pause speech playback"
                >
                  <Pause size={12} />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="msg-action-btn active-paused"
                  onClick={onResumeSpeak}
                  title="Resume speech playback"
                  aria-label="Resume speech playback"
                >
                  <Play size={12} />
                  <span>Resume</span>
                </button>
              )}
              <button
                type="button"
                className="msg-action-btn stop-speaking-btn"
                onClick={onStopSpeak}
                title="Stop speech playback"
                aria-label="Stop speech playback"
              >
                <Square size={11} />
                <span>Stop</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="msg-action-btn"
              onClick={() => onSpeak?.(message.content, message.id)}
              title="Speak this response aloud"
              aria-label="Speak response aloud"
              disabled={isStreaming}
            >
              <Volume2 size={12} />
              <span>Speak</span>
            </button>
          )
        )}
      </div>
    </article>
  );
}

