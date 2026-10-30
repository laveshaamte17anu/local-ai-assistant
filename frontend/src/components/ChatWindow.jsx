import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Code2, FileText, GraduationCap, PenTool, Sparkles } from 'lucide-react';
import Message from './Message';
import GreetingSection from './GreetingSection';

const MODE_PROMPTS = {
  chat: [
    {
      category: 'System concepts',
      text: 'How does CPU int8 quantization work in local model inference?',
      short: 'How CPU int8 quantization works',
    },
    {
      category: 'Architecture',
      text: 'Explain SQLite WAL mode vs rollback journal for concurrent local desktop applications.',
      short: 'SQLite WAL mode vs rollback journal',
    },
    {
      category: 'Algorithms',
      text: 'Explain the difference between Dijkstra and A* search algorithms with examples.',
      short: 'Dijkstra vs A* search algorithms',
    },
    {
      category: 'Productivity',
      text: 'Give me 5 practical strategies to reduce context switching during deep software work.',
      short: 'Strategies to reduce context switching',
    },
  ],
  coding: [
    {
      category: 'Code review',
      text: 'Review this Python function for edge cases, error handling, and performance:\n\ndef process_items(items):\n    return [item.strip().lower() for item in items if item]',
      short: 'Review Python function for edge cases',
    },
    {
      category: 'Bug finding',
      text: 'Explain common memory leak causes in React applications and how to detect them using DevTools.',
      short: 'React memory leaks & DevTools detection',
    },
    {
      category: 'Refactoring',
      text: 'Show how to refactor deeply nested callback or promise chains into async/await with error boundaries in JavaScript.',
      short: 'Refactor callback chains to async/await',
    },
    {
      category: 'Unit tests',
      text: 'Generate pytest unit test cases including fixtures and edge cases for a user authentication token validator.',
      short: 'Generate pytest unit test cases with fixtures',
    },
  ],
  document: [
    {
      category: 'Document Q&A',
      text: 'What are the main findings and conclusions in the uploaded document?',
      short: 'Summarize key findings in document',
    },
    {
      category: 'Data extraction',
      text: 'Extract all dates, key metrics, and action items mentioned across the uploaded document.',
      short: 'Extract dates, metrics & action items',
    },
    {
      category: 'Comparison',
      text: 'Compare the recommendations in the document with standard industry best practices.',
      short: 'Compare recommendations to best practices',
    },
    {
      category: 'FAQ generation',
      text: 'Create a 5-question FAQ with answers based directly on this document.',
      short: 'Create a 5-question FAQ from document',
    },
  ],
  study: [
    {
      category: 'ELI5 Concept',
      text: 'Explain how Transformers and Attention Mechanisms work in simple words with a relatable analogy.',
      short: 'Explain Transformer Attention (ELI5)',
    },
    {
      category: 'Quiz Generator',
      text: 'Generate a 5-question multiple choice quiz on Python generators and decorators, with step-by-step answer explanations.',
      short: 'Quiz on Python generators & decorators',
    },
    {
      category: 'Step-by-step',
      text: 'Walk me through how HTTPS handshakes and TLS certificate validation work step-by-step.',
      short: 'HTTPS & TLS handshake step-by-step',
    },
    {
      category: 'Study plan',
      text: 'Create a structured 2-week study plan to master SQL window functions and query optimization.',
      short: '2-week SQL window functions study plan',
    },
  ],
  writing: [
    {
      category: 'Email draft',
      text: 'Draft a professional, courteous email to a project stakeholder explaining a 2-day timeline delay due to database optimization.',
      short: 'Draft stakeholder timeline update email',
    },
    {
      category: 'Polish & Rewrite',
      text: 'Rewrite the following paragraph to be more concise, assertive, and executive-ready:\n\n"We were kind of thinking that maybe if we have enough time we could possibly look into fixing the caching layer."',
      short: 'Rewrite paragraph to be executive-ready',
    },
    {
      category: 'Release notes',
      text: 'Draft release notes for version 2.0 introducing local document search, streaming responses, and SQLite persistence.',
      short: 'Draft v2.0 feature release notes',
    },
    {
      category: 'Brainstorming',
      text: 'Brainstorm 5 innovative feature ideas for an offline-first local AI assistant running on consumer laptops.',
      short: 'Brainstorm local AI assistant features',
    },
  ],
};

export default function ChatWindow({
  messages = [],
  status,
  activeModel,
  greeting,
  onSelectPrompt,
  onSpeakMessage,
  onPauseSpeakMessage,
  onResumeSpeakMessage,
  onStopSpeakMessage,
  speechPlaybackState = 'idle',
  speakingMessageId = null,
  speakingContent,
  onRegenerate,
  onEditMessage,
  isStreaming = false,
  streamingMessageId = null,
  mode = 'chat',
  onSelectMode,
  attachedDocuments = [],
  onUploadClick,
}) {

  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  useEffect(() => {
    if (!showScrollBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, status, showScrollBottom]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 140);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  const currentPrompts = MODE_PROMPTS[mode] || MODE_PROMPTS.chat;

  return (
    <main
      className="chat-window-scroll-area"
      ref={scrollContainerRef}
      onScroll={handleScroll}
      tabIndex={0}
      aria-label="Conversation transcript"
    >
      <div className="chat-window-inner">
        {/* Mode Switcher Banner */}
        <div className="mode-tabs-bar" role="tablist" aria-label="Assistant modes">
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => onSelectMode?.('chat')}
            role="tab"
            aria-selected={mode === 'chat'}
          >
            <Sparkles size={13} />
            <span>General</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'coding' ? 'active' : ''}`}
            onClick={() => onSelectMode?.('coding')}
            role="tab"
            aria-selected={mode === 'coding'}
          >
            <Code2 size={13} />
            <span>Coding</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'document' ? 'active' : ''}`}
            onClick={() => onSelectMode?.('document')}
            role="tab"
            aria-selected={mode === 'document'}
          >
            <FileText size={13} />
            <span>Document</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'study' ? 'active' : ''}`}
            onClick={() => onSelectMode?.('study')}
            role="tab"
            aria-selected={mode === 'study'}
          >
            <GraduationCap size={13} />
            <span>Study</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${mode === 'writing' ? 'active' : ''}`}
            onClick={() => onSelectMode?.('writing')}
            role="tab"
            aria-selected={mode === 'writing'}
          >
            <PenTool size={13} />
            <span>Writing</span>
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="empty-state-wrapper">
            <GreetingSection
              greeting={greeting}
              onSelectSuggestion={onSelectPrompt}
              activeModel={activeModel}
            />

            <div className="empty-state-header">
              <div className="empty-badge-pill">
                <span className="empty-pulse-dot" />
                <span>100% On-Device AI • No Cloud APIs</span>
              </div>
              <h2 className="empty-title">
                {mode === 'coding' && 'Coding Assistant'}
                {mode === 'document' && 'Document Assistant'}
                {mode === 'study' && 'Study & Learning Assistant'}
                {mode === 'writing' && 'Writing & Editing Assistant'}
                {mode === 'chat' && 'Local AI Voice & Text Assistant'}
              </h2>
              <p className="empty-desc">
                {mode === 'coding' && 'Explain algorithms, find subtle bugs, generate clean tests, and optimize Python, JavaScript, SQL, and C++ code locally.'}
                {mode === 'document' && 'Upload PDF, DOCX, TXT, or Markdown documents to search, summarize, and ask grounded questions without sending files to the cloud.'}
                {mode === 'study' && 'Learn complex concepts with simple analogies, generate quizzes with step-by-step explanations, and master any subject.'}
                {mode === 'writing' && 'Draft executive emails, polish tone and flow, summarize reports, and brainstorm ideas using local LLM models.'}
                {mode === 'chat' && 'Running Ollama language models and faster-whisper speech recognition directly on your CPU. Private, fast, and offline.'}
              </p>

              {mode === 'document' && attachedDocuments.length === 0 && (
                <div className="doc-upload-cta">
                  <button
                    type="button"
                    className="doc-cta-btn"
                    onClick={onUploadClick}
                  >
                    <FileText size={14} />
                    <span>Upload Document (PDF, DOCX, TXT)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="empty-prompts-section">
              <span className="prompts-heading">Suggested prompts ({mode})</span>
              <div className="prompts-list">
                {currentPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="prompt-item-btn"
                    onClick={() => onSelectPrompt(item.text)}
                  >
                    <span className="prompt-item-cat">{item.category}</span>
                    <span className="prompt-item-text">{item.short}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="messages-stream">
            {messages.map((msg, idx) => {
              const isThisStreaming = isStreaming && (msg.id === streamingMessageId || idx === messages.length - 1);
              const isSpeakingThis = (speakingMessageId && msg.id === speakingMessageId) || (speakingContent && speakingContent === msg.content);
              return (
                <Message
                  key={msg.id || idx}
                  message={msg}
                  activeModel={activeModel}
                  onSpeak={onSpeakMessage}
                  onPauseSpeak={onPauseSpeakMessage}
                  onResumeSpeak={onResumeSpeakMessage}
                  onStopSpeak={onStopSpeakMessage}
                  speechPlaybackState={speechPlaybackState}
                  isSpeakingThis={isSpeakingThis}
                  onRegenerate={onRegenerate}
                  onEditMessage={onEditMessage}
                  isStreaming={isThisStreaming}
                />
              );
            })}

            {status === 'thinking' && !isStreaming && (
              <div className="thinking-row">
                <span className="thinking-dot" />
                <span className="thinking-text">
                  Thinking with {activeModel || 'local model'}...
                </span>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} className="scroll-anchor" />
      </div>

      {showScrollBottom && (
        <button
          type="button"
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          title="Jump to bottom"
          aria-label="Jump to bottom"
        >
          <ArrowDown size={14} />
        </button>
      )}
    </main>
  );
}
