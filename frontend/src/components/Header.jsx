import React from 'react';
import {
  Menu,
  Volume2,
  VolumeX,
  Download,
  Trash2,
  Settings,
  CheckSquare,
  ChevronDown,
  Bot
} from 'lucide-react';
import StatusIndicator from './StatusIndicator';

export default function Header({
  status,
  statusMessage,
  activeModel,
  onSelectModel,
  availableModels = [],
  conversationTitle,
  mode = 'chat',
  isSidebarOpen,
  onToggleSidebar,
  voiceEnabled,
  onToggleVoice,
  onClearChat,
  onOpenExport,
  onOpenSettings,
  onToggleNotesTasks,
  isNotesTasksOpen,
  hasMessages,
  isBuddyVisible = true,
  onToggleBuddy,
}) {
  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <Menu size={17} />
        </button>

        <div className="header-title-block">
          <span className="header-conversation-title">
            {conversationTitle || 'New Conversation'}
          </span>
          <span className="header-mode-badge">{mode}</span>
        </div>

        {/* Dynamic Model Dropdown */}
        {availableModels && availableModels.length > 0 && (
          <div className="header-model-selector-wrapper">
            <select
              value={activeModel || availableModels[0]}
              onChange={(e) => onSelectModel?.(e.target.value)}
              className="header-model-dropdown"
              title="Select local AI model"
              aria-label="Select local AI model"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="dropdown-arrow-icon" />
          </div>
        )}
      </div>

      <div className="header-right">
        <StatusIndicator status={status} statusMessage={statusMessage} />

        {/* Animated AI Buddy Companion Toggle */}
        <button
          type="button"
          className={`header-tool-btn ${isBuddyVisible ? 'active-rust' : ''}`}
          onClick={onToggleBuddy}
          title={isBuddyVisible ? 'Hide AI Buddy' : 'Show AI Buddy'}
          aria-label={isBuddyVisible ? 'Hide AI Buddy' : 'Show AI Buddy'}
        >
          <Bot size={15} />
        </button>

        <button
          type="button"
          className={`header-tool-btn ${isNotesTasksOpen ? 'active-rust' : ''}`}
          onClick={onToggleNotesTasks}
          title="Notes & Tasks manager"
          aria-label="Notes & Tasks manager"
        >
          <CheckSquare size={15} />
        </button>

        <button
          type="button"
          className={`header-tool-btn ${voiceEnabled ? 'active-rust' : ''}`}
          onClick={onToggleVoice}
          title={voiceEnabled ? 'Voice output on' : 'Voice output muted'}
          aria-label="Toggle voice output"
        >
          {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>

        {hasMessages && (
          <button
            type="button"
            className="header-tool-btn"
            onClick={onOpenExport}
            title="Export conversation"
            aria-label="Export conversation"
          >
            <Download size={15} />
          </button>
        )}

        {hasMessages && (
          <button
            type="button"
            className="header-tool-btn"
            onClick={onClearChat}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 size={15} />
          </button>
        )}

        <button
          type="button"
          className="header-tool-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
