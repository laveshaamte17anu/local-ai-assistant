import React from 'react';

export default function StatusIndicator({ status, statusMessage }) {
  // Status states: connected, ready, checking, disconnected, model_unavailable, listening, transcribing, thinking, speaking, error
  const cleanLabel = (statusMessage || '').replace(/^(\u26A0\uFE0F|[●🔴🤔⏳🔊⚡\s])+/u, '').trim();

  return (
    <div
      className={`status-pill status-${status || 'ready'}`}
      title={`System status: ${cleanLabel || status}`}
      role="status"
      aria-live="polite"
    >
      <span className="status-dot-indicator" aria-hidden="true" />
      <span className="status-label-text">{cleanLabel || 'ready'}</span>
    </div>
  );
}
