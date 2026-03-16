import { useState, useEffect } from 'react';

/**
 * Lightweight syntax highlighter — no external deps.
 * Handles JSX/TSX, CSS, JSON, HTML, JS well enough for preview.
 */
function highlight(code, ext) {
  if (!code) return '';

  const escape = str => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let html = escape(code);

  if (ext === 'json') {
    html = html
      .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="hl-key">$1</span>$2')
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="hl-str">$1</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="hl-num">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span class="hl-kw">$1</span>');
    return html;
  }

  if (ext === 'css') {
    html = html
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
      .replace(/(--[\w-]+)/g, '<span class="hl-var">$1</span>')
      .replace(/(#[0-9a-fA-F]{3,8})/g, '<span class="hl-str">$1</span>')
      .replace(/([.#]?[\w-]+)(\s*\{)/g, '<span class="hl-fn">$1</span>$2')
      .replace(/([\w-]+)(\s*:)/g, '<span class="hl-key">$1</span>$2');
    return html;
  }

  // JS / JSX / TSX / TS
  html = html
    .replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
    .replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="hl-template">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="hl-str">$1</span>')
    .replace(/\b(import|export|default|from|const|let|var|function|return|if|else|for|while|class|extends|new|this|typeof|instanceof|async|await|try|catch|throw|null|undefined|true|false|void|type|interface|enum|implements)\b/g, '<span class="hl-kw">$1</span>')
    .replace(/\b([A-Z][A-Za-z0-9]*)\b(?=\s*[\(<])/g, '<span class="hl-type">$1</span>')
    .replace(/\b([a-z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, '<span class="hl-fn">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>');

  return html;
}

export default function CodePreview({ filePath, content, loading }) {
  const [copied, setCopied] = useState(false);
  const ext = filePath?.split('.').pop()?.toLowerCase() || 'js';

  function copy() {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const highlighted = highlight(content || '', ext);
  const lines = (content || '').split('\n');

  if (!filePath) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>⬡</div>
        <p style={s.emptyText}>Select a file to view its contents</p>
      </div>
    );
  }

  return (
    <div style={s.root}>
      {/* Tab bar */}
      <div style={s.tabBar}>
        <div style={s.tab}>
          <span style={s.tabDot} />
          <span style={s.tabName}>{filePath?.split('/').pop()}</span>
        </div>
        <span style={s.tabPath}>{filePath}</span>
        <button onClick={copy} style={s.copyBtn} title="Copy to clipboard">
          {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
        </button>
      </div>

      {/* Code area */}
      {loading ? (
        <div style={s.loadingWrap}>
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{ ...s.skeleton, width: `${30 + Math.random() * 60}%`, animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      ) : (
        <div style={s.codeWrap}>
          {/* Line numbers */}
          <div style={s.lineNums} aria-hidden>
            {lines.map((_, i) => (
              <div key={i} style={s.lineNum}>{i + 1}</div>
            ))}
          </div>
          {/* Code */}
          <pre
            style={s.pre}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      )}

      <style>{`
        .hl-kw       { color: #c792ea; }
        .hl-str      { color: #c3e88d; }
        .hl-template { color: #f78c6c; }
        .hl-comment  { color: #546e7a; font-style: italic; }
        .hl-fn       { color: #82aaff; }
        .hl-type     { color: #ffcb6b; }
        .hl-num      { color: #f78c6c; }
        .hl-key      { color: #89ddff; }
        .hl-var      { color: #c792ea; }
      `}</style>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

const s = {
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0d0d12',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    background: '#0d0d12',
  },
  emptyIcon: { fontSize: 32, color: 'var(--text-3)' },
  emptyText: { fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-1)',
    padding: '0 12px',
    flexShrink: 0,
    minHeight: 38,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 14px 8px 0',
    borderBottom: '2px solid var(--violet)',
    marginBottom: -1,
  },
  tabDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--violet)',
    flexShrink: 0,
  },
  tabName: { fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)' },
  tabPath: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    paddingLeft: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    color: 'var(--text-2)',
    background: 'transparent',
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    transition: 'all 0.15s',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'var(--font-mono)',
  },
  codeWrap: {
    flex: 1,
    display: 'flex',
    overflow: 'auto',
  },
  lineNums: {
    padding: '16px 0',
    minWidth: 44,
    textAlign: 'right',
    paddingRight: 14,
    paddingLeft: 12,
    background: 'transparent',
    borderRight: '1px solid var(--border)',
    userSelect: 'none',
    flexShrink: 0,
  },
  lineNum: {
    fontSize: 12,
    lineHeight: '1.7',
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
  pre: {
    flex: 1,
    padding: '16px 20px',
    margin: 0,
    fontSize: 12.5,
    lineHeight: 1.7,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text)',
    whiteSpace: 'pre',
    overflow: 'visible',
    background: 'transparent',
    tabSize: 2,
  },
  loadingWrap: {
    flex: 1,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  skeleton: {
    height: 12,
    borderRadius: 4,
    background: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-4) 50%, var(--bg-3) 75%)',
    backgroundSize: '400px 100%',
    animation: 'shimmer 1.4s ease-in-out infinite',
  },
};
