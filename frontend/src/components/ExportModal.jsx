import React, { useState } from 'react';
import { Download, FileText, Code2, FileCode, Check, X } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, conversation, activeModel }) {
  const [copiedFormat, setCopiedFormat] = useState(null);

  if (!isOpen || !conversation) return null;

  const messages = conversation.messages || [];
  const title = conversation.title || 'Conversation';
  const safeFilename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'chat';

  const generateMarkdown = () => {
    let md = `# ${title}\n\n`;
    md += `*Generated on ${new Date().toLocaleString()} using LocalAI (${activeModel})*\n\n---\n\n`;
    messages.forEach((m) => {
      const role = m.role === 'user' ? '👤 User' : '🤖 LocalAI Assistant';
      md += `### ${role}\n\n${m.content}\n\n`;
    });
    return md;
  };

  const generateText = () => {
    let txt = `${title}\n${'='.repeat(title.length)}\nDate: ${new Date().toLocaleString()}\nModel: ${activeModel}\n\n`;
    messages.forEach((m) => {
      const role = m.role === 'user' ? 'USER' : 'ASSISTANT';
      txt += `[${role}]\n${m.content}\n\n`;
    });
    return txt;
  };

  const generateJSON = () => {
    return JSON.stringify(
      {
        title,
        exportedAt: new Date().toISOString(),
        model: activeModel,
        messages,
      },
      null,
      2
    );
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format) => {
    if (format === 'markdown') {
      downloadFile(generateMarkdown(), `${safeFilename}.md`, 'text/markdown');
    } else if (format === 'text') {
      downloadFile(generateText(), `${safeFilename}.txt`, 'text/plain');
    } else if (format === 'json') {
      downloadFile(generateJSON(), `${safeFilename}.json`, 'application/json');
    }
    setCopiedFormat(format);
    setTimeout(() => {
      setCopiedFormat(null);
      onClose();
    }, 800);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
      <div className="modal-card export-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Download size={18} className="modal-icon rust" />
            <h3 id="export-modal-title">Export transcript</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close export dialog">
            <X size={17} />
          </button>
        </div>

        <p className="modal-subtitle">
          Export &ldquo;{title}&rdquo; ({messages.length} {messages.length === 1 ? 'message' : 'messages'})
        </p>

        <div className="export-options-grid">
          <button
            type="button"
            className="export-option-card"
            onClick={() => handleExport('markdown')}
          >
            <div className="export-icon-box">
              <FileCode size={18} />
            </div>
            <div className="export-text">
              <span className="export-name">Markdown (.md)</span>
              <span className="export-desc">Headers, lists, and code blocks preserved</span>
            </div>
            {copiedFormat === 'markdown' ? <Check size={16} className="rust" /> : <Download size={15} />}
          </button>

          <button
            type="button"
            className="export-option-card"
            onClick={() => handleExport('text')}
          >
            <div className="export-icon-box">
              <FileText size={18} />
            </div>
            <div className="export-text">
              <span className="export-name">Plain Text (.txt)</span>
              <span className="export-desc">Clean transcript without markup</span>
            </div>
            {copiedFormat === 'text' ? <Check size={16} className="rust" /> : <Download size={15} />}
          </button>

          <button
            type="button"
            className="export-option-card"
            onClick={() => handleExport('json')}
          >
            <div className="export-icon-box">
              <Code2 size={18} />
            </div>
            <div className="export-text">
              <span className="export-name">JSON (.json)</span>
              <span className="export-desc">Raw messages array with roles and timestamps</span>
            </div>
            {copiedFormat === 'json' ? <Check size={16} className="rust" /> : <Download size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
