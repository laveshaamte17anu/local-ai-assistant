import React, { useState, useMemo, useEffect } from 'react';
import { fetchConversations } from '../services/api';
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Settings,
  Volume2,
  VolumeX,
  PanelLeftClose,
  Search
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onClose,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  activeModel,
  onOpenSettings,
  voiceEnabled,
  onToggleVoice,
  ollamaRunning,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [searchResults, setSearchResults] = useState(null);

  const startEditing = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title || '');
  };

  const saveEditing = (id, e) => {
    e?.stopPropagation();
    if (editingTitle && editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const confirmDelete = (id, e) => {
    e?.stopPropagation();
    onDeleteConversation(id);
    setDeletingId(null);
  };

  // Debounced server-side message and title search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetchConversations(searchQuery.trim());
        setSearchResults(res.conversations || []);
      } catch (e) {
        console.warn('Search query failed:', e);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter conversations if searching
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    if (searchResults !== null) return searchResults;
    const query = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title && c.title.toLowerCase().includes(query));
  }, [conversations, searchQuery, searchResults]);

  // Group conversations by recency
  const { today, pastWeek, older } = useMemo(() => {
    const todayList = [];
    const pastWeekList = [];
    const olderList = [];

    filteredConversations.forEach((conv, index) => {
      if (index < 5) {
        todayList.push(conv);
      } else if (index < 15) {
        pastWeekList.push(conv);
      } else {
        olderList.push(conv);
      }
    });

    return { today: todayList, pastWeek: pastWeekList, older: olderList };
  }, [filteredConversations]);

  const renderConversationItem = (conv) => {
    const isActive = conv.id === activeConversationId;
    const isEditing = editingId === conv.id;
    const isDeleting = deletingId === conv.id;

    if (isDeleting) {
      return (
        <div
          key={conv.id}
          className="conversation-item delete-confirm-mode"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="delete-confirm-text">Delete chat?</span>
          <div className="delete-confirm-actions">
            <button
              type="button"
              className="conv-action-btn delete-yes"
              onClick={(e) => confirmDelete(conv.id, e)}
              title="Confirm Delete"
            >
              <Check size={12} />
              <span>Yes</span>
            </button>
            <button
              type="button"
              className="conv-action-btn cancel"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingId(null);
              }}
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={conv.id}
        className={`conversation-item ${isActive ? 'active' : ''}`}
        onClick={() => {
          onSelectConversation(conv.id);
          if (window.innerWidth < 768) {
            onClose();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelectConversation(conv.id);
        }}
      >
        <MessageSquare size={14} className="conv-icon" />

        {isEditing ? (
          <div className="conv-edit-box" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEditing(conv.id, e);
                if (e.key === 'Escape') cancelEditing(e);
              }}
              autoFocus
              className="conv-edit-input"
            />
            <button
              type="button"
              className="conv-action-btn check"
              onClick={(e) => saveEditing(conv.id, e)}
              aria-label="Save title"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              className="conv-action-btn cancel"
              onClick={cancelEditing}
              aria-label="Cancel editing"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <span className="conv-title">{conv.title || 'New Conversation'}</span>
            <div className="conv-hover-actions">
              <button
                type="button"
                className="conv-action-btn"
                onClick={(e) => startEditing(conv, e)}
                title="Rename conversation"
                aria-label="Rename conversation"
              >
                <Edit2 size={12} />
              </button>
              <button
                type="button"
                className="conv-action-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingId(conv.id);
                }}
                title="Delete conversation"
                aria-label="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-dot" />
            <span className="brand-name">LocalAI</span>
            <span className="brand-tag">Ollama v3</span>
          </div>
          <button
            type="button"
            className="sidebar-close-toggle"
            onClick={onClose}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <div className="sidebar-top-actions">
          <button
            type="button"
            className="new-chat-btn"
            onClick={onNewChat}
            title="Start new conversation (Ctrl+N)"
          >
            <Plus size={15} />
            <span>New Conversation</span>
            <kbd className="shortcut-kbd">^N</kbd>
          </button>

          {/* Search conversations */}
          <div className="sidebar-search-box">
            <Search size={13} className="search-icon" />
            <input
              type="text"
              placeholder="Search chats & messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation list grouped */}
        <div className="sidebar-history-container">
          {conversations.length === 0 ? (
            <div className="empty-history">No conversations yet</div>
          ) : (
            <div className="history-groups">
              {today.length > 0 && (
                <div className="history-group">
                  <span className="group-label">Today</span>
                  {today.map(renderConversationItem)}
                </div>
              )}

              {pastWeek.length > 0 && (
                <div className="history-group">
                  <span className="group-label">Previous 7 Days</span>
                  {pastWeek.map(renderConversationItem)}
                </div>
              )}

              {older.length > 0 && (
                <div className="history-group">
                  <span className="group-label">Older</span>
                  {older.map(renderConversationItem)}
                </div>
              )}

              {filteredConversations.length === 0 && searchQuery && (
                <div className="empty-history">
                  No conversations match "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar bottom footer */}
        <div className="sidebar-footer">
          <div
            className="sidebar-model-row"
            onClick={onOpenSettings}
            title="Active local model • Click for settings"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpenSettings();
            }}
          >
            <span
              className={`status-dot-sm ${ollamaRunning ? 'online' : 'offline'}`}
              aria-hidden="true"
            />
            <span className="model-name-text">{activeModel || 'qwen2.5:1.5b'}</span>
          </div>

          <div className="sidebar-footer-tools">
            <button
              type="button"
              className={`footer-tool-btn ${voiceEnabled ? 'active-rust' : ''}`}
              onClick={onToggleVoice}
              title={voiceEnabled ? 'Voice output on' : 'Voice output muted'}
              aria-label="Toggle voice"
            >
              {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>Voice</span>
            </button>

            <button
              type="button"
              className="footer-tool-btn"
              onClick={onOpenSettings}
              title="Settings (Ctrl+,)"
              aria-label="Open settings"
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
