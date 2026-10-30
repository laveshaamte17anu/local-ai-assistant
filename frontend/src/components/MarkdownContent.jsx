import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

/**
 * Lightweight, safe syntax highlighter for supported programming languages.
 */
function highlightCode(code, language = 'text') {
  if (!code) return '';
  const lang = (language || '').toLowerCase().trim();
  const isPy = lang === 'python' || lang === 'py';
  const isSql = lang === 'sql';
  const isJs = ['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'json'].includes(lang);
  const isBash = ['bash', 'sh', 'shell', 'cmd', 'batch'].includes(lang);

  const lines = code.split('\n');

  if (!isPy && !isSql && !isJs && !isBash) {
    return lines.map((l, idx) => (
      <div key={idx} className="code-line">{l || ' '}</div>
    ));
  }

  const commentPattern = (isPy || isBash) ? '(#.*$)' : isSql ? '(--.*$)' : '(\\/\\/.*$)';
  const keywordList = isPy
    ? 'def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|with|lambda|yield|async|await|pass|raise|break|continue|in|is|not|and|or'
    : isSql
    ? 'SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|CREATE|TABLE|ALTER|DROP|PRAGMA|VALUES|SET|AND|OR|NOT|NULL|DISTINCT|COUNT'
    : isBash
    ? 'echo|cd|ls|mkdir|rm|cp|mv|cat|grep|chmod|chown|export|source|if|then|else|fi|for|do|done|while|case|esac'
    : 'const|let|var|function|return|if|else|for|while|import|export|from|default|class|extends|new|this|typeof|async|await|try|catch|finally|switch|case|break';

  const tokenRegex = new RegExp(
    `(${commentPattern})|("(?:\\\\[\\s\\S]|[^"\\\\])*"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|\`(?:\\\\[\\s\\S]|[^\`\\\\])*\`)|(\\b(?:${keywordList})\\b)|(\\b(?:true|false|null|undefined|True|False|None)\\b)|(\\b\\d+(?:\\.\\d+)?\\b)`,
    isSql ? 'gi' : 'g'
  );

  return lines.map((line, lineIdx) => {
    const parts = [];
    let lastIndex = 0;
    let match;
    tokenRegex.lastIndex = 0;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      const [full, comment, , str, kw, boolVal, num] = match;
      if (comment) {
        parts.push(<span key={match.index} className="tok-comment">{comment}</span>);
      } else if (str) {
        parts.push(<span key={match.index} className="tok-string">{str}</span>);
      } else if (kw) {
        parts.push(<span key={match.index} className="tok-keyword">{kw}</span>);
      } else if (boolVal) {
        parts.push(<span key={match.index} className="tok-builtin">{boolVal}</span>);
      } else if (num) {
        parts.push(<span key={match.index} className="tok-number">{num}</span>);
      } else {
        parts.push(full);
      }
      lastIndex = match.index + full.length;
    }
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return (
      <div key={lineIdx} className="code-line">
        {parts.length > 0 ? parts : ' '}
      </div>
    );
  });
}

/**
 * Custom CodeBlock with language header, line numbers option, and copy button.
 */
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy code to clipboard', e);
    }
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-language">{language || 'code'}</span>
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
          aria-label="Copy code block"
        >
          {copied ? (
            <>
              <Check size={13} className="copied-icon" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-content">
        <code>{highlightCode(code, language)}</code>
      </pre>
    </div>
  );
}

/**
 * Custom Table renderer for Markdown tables.
 */
function MarkdownTable({ headers, rows }) {
  return (
    <div className="md-table-wrapper">
      <table className="md-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{formatInlineText(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx}>{formatInlineText(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Formats inline text: bold, italic, strikethrough, inline code, and links.
 */
function formatInlineText(text) {
  if (!text) return text;

  // Split on markdown links [label](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const linkParts = [];
  let lastIdx = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      linkParts.push({ type: 'text', content: text.substring(lastIdx, match.index) });
    }
    linkParts.push({ type: 'link', label: match[1], url: match[2] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    linkParts.push({ type: 'text', content: text.substring(lastIdx) });
  }

  return linkParts.map((lPart, lIdx) => {
    if (lPart.type === 'link') {
      return (
        <a
          key={`l-${lIdx}`}
          href={lPart.url}
          target="_blank"
          rel="noopener noreferrer"
          className="md-inline-link"
        >
          {lPart.label}
          <ExternalLink size={10} className="inline-link-icon" />
        </a>
      );
    }

    // Split on inline code `...`
    const codeParts = lPart.content.split(/(`[^`]+`)/g);

    return codeParts.map((part, pIdx) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code key={`${lIdx}-${pIdx}`} className="inline-code">
            {part.slice(1, -1)}
          </code>
        );
      }

      // Split on bold **...**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) {
          return <strong key={`${lIdx}-${pIdx}-${bIdx}`}>{bPart.slice(2, -2)}</strong>;
        }

        // Split on italic *...*
        const italicParts = bPart.split(/(\*[^*]+\*)/g);
        return italicParts.map((iPart, iIdx) => {
          if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
            return <em key={`${lIdx}-${pIdx}-${bIdx}-${iIdx}`}>{iPart.slice(1, -1)}</em>;
          }
          return iPart;
        });
      });
    });
  });
}

/**
 * Lightweight, safe, bespoke markdown renderer for LocalAI.
 * Formats code blocks, tables, lists, headers, blockquotes, and paragraphs.
 */
export default function MarkdownContent({ content, isStreaming = false }) {
  if (!content) return null;

  // Split by fenced code blocks: ```lang\ncode\n```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore) {
      elements.push({ type: 'text', content: textBefore });
    }

    const language = match[1] || 'text';
    const code = match[2].replace(/\n$/, '');
    elements.push({ type: 'code', language, code });

    lastIndex = match.index + match[0].length;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText) {
    // Check if remainingText has an unclosed code block (common during streaming)
    if (remainingText.includes('```')) {
      const parts = remainingText.split('```');
      if (parts[0]) elements.push({ type: 'text', content: parts[0] });
      const unclosedLang = parts[1].split('\n')[0] || 'code';
      const unclosedCode = parts[1].substring(unclosedLang.length).replace(/^\n/, '');
      elements.push({ type: 'code', language: unclosedLang, code: unclosedCode });
    } else {
      elements.push({ type: 'text', content: remainingText });
    }
  }

  return (
    <div className="markdown-body">
      {elements.map((elem, idx) => {
        if (elem.type === 'code') {
          return <CodeBlock key={idx} language={elem.language} code={elem.code} />;
        }

        // Parse lines for paragraphs, lists, headers, blockquotes, and tables
        const lines = elem.content.split('\n');
        const renderedBlocks = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];
          const trimmed = line.trim();

          // 1. Markdown Table detection: | Header 1 | Header 2 |
          if (
            trimmed.startsWith('|') &&
            trimmed.endsWith('|') &&
            i + 1 < lines.length &&
            lines[i + 1].trim().startsWith('|') &&
            lines[i + 1].includes('---')
          ) {
            const rawHeaders = trimmed
              .split('|')
              .slice(1, -1)
              .map((h) => h.trim());
            i += 2; // skip header line and separator line

            const tableRows = [];
            while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
              const cells = lines[i]
                .trim()
                .split('|')
                .slice(1, -1)
                .map((c) => c.trim());
              tableRows.push(cells);
              i++;
            }

            renderedBlocks.push(
              <MarkdownTable key={`tbl-${i}`} headers={rawHeaders} rows={tableRows} />
            );
            continue;
          }

          // 2. Unordered Bullet List: - item or * item
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const listItems = [];
            while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
              listItems.push(lines[i].trim().substring(2));
              i++;
            }
            renderedBlocks.push(
              <ul key={`ul-${i}`} className="md-list">
                {listItems.map((item, lIdx) => (
                  <li key={lIdx}>{formatInlineText(item)}</li>
                ))}
              </ul>
            );
            continue;
          }

          // 3. Ordered Numbered List: 1. item
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            const numberedItems = [];
            while (i < lines.length) {
              const curNumMatch = lines[i].trim().match(/^(\d+)\.\s+(.*)/);
              if (!curNumMatch) break;
              numberedItems.push({ num: curNumMatch[1], text: curNumMatch[2] });
              i++;
            }
            renderedBlocks.push(
              <div key={`ol-${i}`} className="md-ordered-list">
                {numberedItems.map((item, nIdx) => (
                  <div key={nIdx} className="md-numbered-item">
                    <span className="md-num">{item.num}.</span>
                    <span className="md-item-text">{formatInlineText(item.text)}</span>
                  </div>
                ))}
              </div>
            );
            continue;
          }

          // 4. Empty line spacer
          if (!trimmed) {
            i++;
            continue;
          }

          // 5. Horizontal rule
          if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            renderedBlocks.push(<hr key={`hr-${i}`} className="md-divider" />);
            i++;
            continue;
          }

          // 6. Headers
          if (trimmed.startsWith('#### ')) {
            renderedBlocks.push(
              <h5 key={`h4-${i}`} className="md-heading-4">
                {formatInlineText(trimmed.substring(5))}
              </h5>
            );
          } else if (trimmed.startsWith('### ')) {
            renderedBlocks.push(
              <h4 key={`h3-${i}`} className="md-heading-3">
                {formatInlineText(trimmed.substring(4))}
              </h4>
            );
          } else if (trimmed.startsWith('## ')) {
            renderedBlocks.push(
              <h3 key={`h2-${i}`} className="md-heading-2">
                {formatInlineText(trimmed.substring(3))}
              </h3>
            );
          } else if (trimmed.startsWith('# ')) {
            renderedBlocks.push(
              <h2 key={`h1-${i}`} className="md-heading-1">
                {formatInlineText(trimmed.substring(2))}
              </h2>
            );
          } else if (trimmed.startsWith('> ')) {
            renderedBlocks.push(
              <blockquote key={`quote-${i}`} className="md-blockquote">
                {formatInlineText(trimmed.substring(2))}
              </blockquote>
            );
          } else {
            renderedBlocks.push(
              <p key={`p-${i}`} className="md-paragraph">
                {formatInlineText(line)}
              </p>
            );
          }

          i++;
        }

        return <div key={idx} className="md-text-block">{renderedBlocks}</div>;
      })}

      {isStreaming && <span className="stream-cursor-pulse" aria-hidden="true" />}
    </div>
  );
}
