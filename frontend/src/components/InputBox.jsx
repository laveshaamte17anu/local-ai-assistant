import React, { useRef, useEffect } from 'react';
import { CornerDownLeft, X, Square, Paperclip, FileText, Trash2, Check, Languages } from 'lucide-react';
import MicButton from './MicButton';

export default function InputBox({
  text,
  onTextChange,
  onSendMessage,
  isRecording,
  onStartRecord,
  onStopRecord,
  onCancelRecord,
  interimSpeech = '',
  speechLanguage = 'en-IN',
  onSelectSpeechLanguage,
  isSpeechRecognitionSupported = true,
  disabled,
  isStreaming,
  onStopStreaming,
  activeModel,
  onUploadDocument,
  attachedDocuments = [],
  onDeleteDocument,
  mode = 'chat'
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 160)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isStreaming) {
      onStopStreaming?.();
      return;
    }
    if (!text || !text.trim() || disabled) return;
    onSendMessage(text.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onUploadDocument) {
      onUploadDocument(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleLanguage = () => {
    if (!onSelectSpeechLanguage) return;
    const nextLang = speechLanguage === 'en-IN' ? 'mr-IN' : 'en-IN';
    onSelectSpeechLanguage(nextLang);
  };

  const canSubmit = (text && text.trim().length > 0 && !disabled && !isRecording) || isStreaming;

  const getPlaceholder = () => {
    if (isRecording) {
      return speechLanguage === 'mr-IN'
        ? 'मराठीत बोला... (बोलणे संपल्यावर Finish दाबा)'
        : 'Listening... speak clearly in English (tap Finish when done)';
    }
    if (mode === 'coding') return 'Ask a coding question, paste code to review, or request a bug fix...';
    if (mode === 'document') return 'Ask questions about your uploaded documents...';
    if (mode === 'study') return 'Enter a concept to learn, request a quiz, or ask for an explanation...';
    if (mode === 'writing') return 'Describe what you want to write, rewrite, or brainstorm...';
    return 'Write a prompt or question... (Enter to send, Shift+Enter for new line)';
  };

  return (
    <footer className="composer-dock">
      <div className="composer-wrapper">
        {/* Attached Documents bar if any */}
        {attachedDocuments && attachedDocuments.length > 0 && (
          <div className="attached-docs-row" aria-label="Attached documents">
            <span className="attached-docs-label">Context Documents:</span>
            {attachedDocuments.map((doc) => (
              <div key={doc.id} className="attached-doc-chip" title={`${doc.filename} (${doc.chunk_count} chunks)`}>
                <FileText size={12} className="doc-chip-icon" />
                <span className="doc-chip-name">{doc.filename}</span>
                {onDeleteDocument && (
                  <button
                    type="button"
                    className="doc-chip-remove"
                    onClick={() => onDeleteDocument(doc.id)}
                    title="Remove document"
                    aria-label={`Remove ${doc.filename}`}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Recording / Listening Indicator Bar */}
        {isRecording && (
          <div className="recording-inline-bar" role="status" aria-live="polite">
            <div className="rec-left-section">
              <div className="rec-waveform" aria-hidden="true">
                <span className="rec-wave-bar bar-1" />
                <span className="rec-wave-bar bar-2" />
                <span className="rec-wave-bar bar-3" />
                <span className="rec-wave-bar bar-4" />
                <span className="rec-wave-bar bar-5" />
              </div>
              <div className="rec-status-details">
                <span className="rec-lang-pill">
                  {speechLanguage === 'mr-IN' ? 'मराठी (mr-IN)' : 'English (en-IN)'}
                </span>
                <span className="rec-label">
                  {interimSpeech ? `“${interimSpeech}”` : 'Listening... Speak now'}
                </span>
              </div>
            </div>

            <div className="rec-action-group">
              <button
                type="button"
                className="rec-done-btn"
                onClick={onStopRecord}
                title="Stop recording and edit text in composer"
              >
                <Check size={12} />
                <span>Done</span>
              </button>
              <button
                type="button"
                className="rec-discard-btn"
                onClick={onCancelRecord}
                title="Discard this recording"
                aria-label="Discard recording"
              >
                <X size={12} />
                <span>Discard</span>
              </button>
            </div>
          </div>
        )}

        <form className="writing-tool-box" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className={`writing-textarea ${isRecording ? 'recording-active' : ''}`}
            placeholder={getPlaceholder()}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled && !isStreaming}
            aria-label="Prompt message"
          />

          <div className="writing-toolbar">
            <div className="toolbar-left">
              <span className="model-indicator-tag">
                {activeModel || 'local model'}
              </span>
              {text.length > 0 && (
                <span className="char-count">{text.length} chars</span>
              )}
            </div>

            <div className="toolbar-right">
              {/* Voice Language Selector Toggle (EN / MR) */}
              <button
                type="button"
                className={`tool-sub-btn voice-lang-toggle-btn ${speechLanguage === 'mr-IN' ? 'lang-marathi' : 'lang-english'}`}
                onClick={toggleLanguage}
                title={`Speech Language: ${speechLanguage === 'mr-IN' ? 'मराठी (mr-IN)' : 'English (en-IN)'} - Click to switch`}
                aria-label={`Switch speech language, current is ${speechLanguage === 'mr-IN' ? 'Marathi' : 'English'}`}
                disabled={disabled || isStreaming || isRecording}
              >
                <Languages size={13} className="lang-icon" />
                <span className="lang-code-text">
                  {speechLanguage === 'mr-IN' ? 'MR' : 'EN'}
                </span>
              </button>

              {/* Document upload button */}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.txt,.md,.json,.csv"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="tool-sub-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Document (PDF, DOCX, TXT, MD)"
                aria-label="Attach Document"
                disabled={disabled || isStreaming}
              >
                <Paperclip size={14} />
              </button>

              {text && !isStreaming && (
                <button
                  type="button"
                  className="clear-text-btn"
                  onClick={() => onTextChange('')}
                  title="Clear text"
                  aria-label="Clear text"
                >
                  <X size={13} />
                </button>
              )}

              {/* Microphone Button with Pulse Glow */}
              <MicButton
                isRecording={isRecording}
                onStart={onStartRecord}
                onStop={onStopRecord}
                isSupported={isSpeechRecognitionSupported}
                disabled={disabled || isStreaming}
              />

              {isStreaming ? (
                <button
                  type="button"
                  className="send-action-btn stop-state"
                  onClick={onStopStreaming}
                  title="Stop generating (Esc)"
                  aria-label="Stop generating"
                >
                  <Square size={12} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className={`send-action-btn ${canSubmit ? 'ready' : 'idle'}`}
                  disabled={!canSubmit}
                  title="Send (Enter)"
                  aria-label="Send message"
                >
                  <span>Send</span>
                  <CornerDownLeft size={13} />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </footer>
  );
}

