import React from 'react';
import { Sparkles, Smile, BookOpen, Bot } from 'lucide-react';
import { QUICK_SUGGESTIONS } from '../utils/greeting';

const SUGGESTION_ICONS = {
  'Tell me a fun fact': Sparkles,
  'Tell me a joke': Smile,
  'Teach me something': BookOpen,
};

export default function GreetingSection({
  greeting,
  onSelectSuggestion,
  activeModel,
}) {
  return (
    <section className="greeting-hero" aria-label="Welcome greeting">
      <div className="greeting-header">
        <div className="greeting-avatar-badge" aria-hidden="true">
          <Bot size={22} />
        </div>
        <div className="greeting-text-block">
          <div className="greeting-badge-pill">
            <span className="greeting-pulse-dot" />
            <span>AI Companion • Offline & Private</span>
          </div>
          <h1 className="greeting-title">{greeting}</h1>
          <p className="greeting-subtitle">
            Running locally with {activeModel || 'local model'}. Pick a quick topic below or type your own question.
          </p>
        </div>
      </div>

      <div className="greeting-suggestions-bar">
        <span className="greeting-suggestion-label">Quick start:</span>
        <div className="greeting-suggestion-buttons">
          {QUICK_SUGGESTIONS.map((item) => {
            const Icon = SUGGESTION_ICONS[item.label] || Sparkles;
            return (
              <button
                key={item.label}
                type="button"
                className="greeting-suggestion-btn"
                onClick={() => onSelectSuggestion?.(item.prompt)}
                title={`Ask: "${item.prompt}"`}
              >
                <Icon size={14} className="greeting-suggestion-icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

