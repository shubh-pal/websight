import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import ProgressSteps from '../components/ProgressSteps';
import TokenBadges from '../components/TokenBadges';
import StackBlitzPreview from '../components/StackBlitzPreview';

export default function Result() {
  const { jobId } = useParams();
  const [params] = useSearchParams();
  const sourceUrl = params.get('url') || '';
  const framework = params.get('fw') || 'react';
  const modelParam = params.get('model') || '';

  const [job, setJob]           = useState(null);
  const [logs, setLogs]         = useState([]);
  const [fileMap, setFileMap]   = useState(null);
  const [view, setView]         = useState('preview'); // 'preview' | 'tokens' | 'logs'
  const [panelOpen, setPanelOpen] = useState(true); // top info panel collapsed/expanded

  const logsEndRef = useRef(null);
  const sseRef     = useRef(null);

  // ── SSE subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/jobs/${jobId}/events`);
    sseRef.current = es;

    es.onmessage = e => {
      try {
        const data = JSON.parse(e.data);
        setJob(prev => ({ ...prev, ...data }));
        if (data.logs) setLogs(data.logs);
        // Auto-load files when job is done
        if (data.status === 'done' && !fileMap) {
          loadFiles();
          setPanelOpen(false); // auto-collapse for max preview space
        }
      } catch (_) {}
    };

    es.onerror = () => {
      es.close();
      // Fallback: poll once
      fetch(`/api/jobs/${jobId}`)
        .then(r => r.json())
        .then(data => {
          setJob(data);
          if (data.status === 'done') loadFiles();
        })
        .catch(() => {});
    };

    return () => es.close();
  }, [jobId]);

  // ── Scroll logs ───────────────────────────────────────────────────────────
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── Load full file map ─────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const res  = await fetch(`/api/jobs/${jobId}/files`);
      const data = await res.json();
      if (data.files) {
        setFileMap(data.files);
        setView('preview');
      }
    } catch (_) {}
  }, [jobId]);

  async function handleApplyEdit(command) {
    if (!command.trim()) return;
    try {
      setView('logs');
      await fetch(`/api/redesign/${jobId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
    } catch (_) {}
  }

  const isDone    = job?.status === 'done';
  const isError   = job?.status === 'error';
  const isRunning = job?.status === 'running' || job?.status === 'pending';

  return (
    <div style={s.root}>
      {/* ── Top bar ── */}
      <header style={s.topBar}>
        <Link to="/" style={s.backBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          New
        </Link>

        <div style={s.breadcrumb}>
          <span style={s.breadcrumbItem}>websight</span>
          <span style={s.breadcrumbSep}>/</span>
          <span style={{ ...s.breadcrumbItem, color: 'var(--text-2)' }}>
            {job?.projectName || new URL(sourceUrl.startsWith('http') ? sourceUrl : 'https://x.com').hostname}
          </span>
          {framework && (
            <span style={s.fwBadge}>{framework === 'react' ? '⚛ React' : '🅰 Angular'}</span>
          )}
          {modelParam && (
            <span style={{
              ...s.fwBadge,
              color: modelParam.startsWith('gemini') ? 'var(--green)' : 'var(--amber)',
              background: modelParam.startsWith('gemini') ? 'rgba(30,245,160,0.07)' : 'rgba(245,166,35,0.07)',
              borderColor: modelParam.startsWith('gemini') ? 'rgba(30,245,160,0.2)' : 'rgba(245,166,35,0.2)',
            }}>
              {modelParam.startsWith('gemini') ? '⚡' : '✦'} {modelParam}
            </span>
          )}
          {job?.fromCache && (
            <span style={{
              ...s.fwBadge,
              color: '#1ef5a0',
              background: 'rgba(30,245,160,0.07)',
              borderColor: 'rgba(30,245,160,0.22)',
            }}>
              ⚡ cached
            </span>
          )}
        </div>

        {/* Collapse / expand top panel toggle */}
        {isDone && job?.tokens && (
          <button
            onClick={() => setPanelOpen(o => !o)}
            title={panelOpen ? 'Collapse info panel' : 'Expand info panel'}
            style={s.collapseBtn}
          >
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: panelOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.22s ease' }}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {panelOpen ? 'Collapse' : 'Design tokens'}
          </button>
        )}

        {isDone && (
          <a href={`/api/jobs/${jobId}/download`} style={s.downloadBtn}>
            <DownloadIcon />
            Download ZIP
          </a>
        )}
      </header>

      {/* ── Collapsible top panel (progress during run / tokens when done) ── */}
      <div style={{
        overflow: 'hidden',
        maxHeight: panelOpen ? '200px' : '0px',
        transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
      }}>
        {/* Progress bar (running state) */}
        {(isRunning || isError) && (
          <div style={s.progressBanner}>
            <ProgressSteps step={job?.step || 0} stepName={job?.stepName} status={job?.status} />
          </div>
        )}

        {/* Token badges (done state) */}
        {isDone && job?.tokens && (
          <div style={s.tokenBanner}>
            <div style={s.tokenInner}>
              <span style={s.tokenTitle}>
                <span style={s.greenDot} />
                {job.projectName}
              </span>
              <TokenBadges tokens={job.tokens} />
            </div>
          </div>
        )}
      </div>

      {/* ── IDE Layout ── */}
      <div style={s.ide}>
        {/* Main content — full width, no sidebar */}
        <main style={s.mainArea}>
          {/* View switcher */}
          <div style={s.viewTabs}>
            {[
              ['preview', 'Preview', true],
              ['logs',    'Logs'],
              ...(isDone ? [['tokens', 'Tokens']] : []),
            ].map(([v, label, highlight]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  ...s.viewTab,
                  ...(view === v ? s.viewTabActive : {}),
                  ...(highlight && isDone && view !== v ? s.viewTabHighlight : {}),
                }}
              >
                {v === 'preview' && isDone && view !== 'preview' && (
                  <span style={s.previewDot} />
                )}
                {v === 'logs' && isRunning && <span style={s.logsDot} />}
                {label}
                {v === 'logs' && <span style={s.logsCount}>{logs.length}</span>}
              </button>
            ))}
          </div>

          {/* ── All panels stay mounted — toggled via display, never unmounted ── */}

          {/* Preview — always mounted once fileMap is available so StackBlitz never reloads */}
          <div style={{ ...s.previewArea, display: view === 'preview' ? 'flex' : 'none' }}>
            {fileMap && (
              <StackBlitzPreview
                files={fileMap}
                projectName={job?.projectName}
                tokens={job?.tokens}
              />
            )}
          </div>

          {/* Logs view */}
          <div style={{ ...s.logsArea, display: view === 'logs' ? 'flex' : 'none' }}>
            {logs.length === 0 ? (
              <div style={s.logsEmpty}>
                {isRunning
                  ? <><span style={s.spinnerSm} /> Waiting for logs…</>
                  : 'No logs yet.'}
              </div>
            ) : (
              <div style={s.logsList}>
                {logs.map((log, i) => (
                  <div key={i} style={s.logLine}>
                    <span style={s.logTime}>{new Date(log.time).toLocaleTimeString()}</span>
                    <span style={{
                      ...s.logMsg,
                      color: log.message.startsWith('Error') ? 'var(--red)'
                        : log.message.startsWith('🎉') ? 'var(--green)'
                        : 'var(--text-2)',
                    }}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          {/* Tokens view */}
          {isDone && (
            <div style={{ ...s.tokensArea, display: view === 'tokens' ? 'flex' : 'none' }}>
              <TokensDetail tokens={job?.tokens} />
            </div>
          )}

          {/* AI Edit input — floats over preview, always visible when done */}
          {isDone && (
            <div style={s.editBar}>
              <div style={s.editIcon}>✨</div>
              <input
                style={s.editInput}
                placeholder="Suggest an edit (e.g. 'Make the hero section dark', 'Add a price table')"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    handleApplyEdit(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button
                style={s.editBtn}
                onClick={(e) => {
                  const input = e.currentTarget.previousSibling;
                  if (input.value.trim()) {
                    handleApplyEdit(input.value);
                    input.value = '';
                  }
                }}
              >
                Update
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildClientTree(files) {
  const root = {};
  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = 'file';
  }
  return root;
}

// ── Token detail view ─────────────────────────────────────────────────────

function TokensDetail({ tokens }) {
  if (!tokens) return null;
  const entries = Object.entries(tokens).filter(([k]) => !['navLinks', 'pages', 'components'].includes(k));
  const arrays  = Object.entries(tokens).filter(([k]) => ['navLinks', 'pages', 'components'].includes(k));

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 20, color: 'var(--text)' }}>
        Design Tokens
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            {String(val).match(/^#[0-9a-fA-F]{3,8}$/) && (
              <div style={{ width: 24, height: 24, borderRadius: 4, background: val, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key}</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)', marginTop: 2 }}>{String(val)}</div>
            </div>
          </div>
        ))}
      </div>
      {arrays.map(([key, val]) => Array.isArray(val) && (
        <div key={key} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {val.map((item, i) => (
              <div key={i} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
                {typeof item === 'string' ? item : JSON.stringify(item)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-1)',
    flexShrink: 0,
    minHeight: 46,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: 'var(--text-2)',
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  breadcrumb: { flex: 1, display: 'flex', alignItems: 'center', gap: 6 },
  breadcrumbItem: { fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  breadcrumbSep:  { fontSize: 13, color: 'var(--text-3)', opacity: 0.4 },
  fwBadge: {
    fontSize: 11,
    color: 'var(--cyan)',
    background: 'rgba(0,212,232,0.08)',
    border: '1px solid rgba(0,212,232,0.2)',
    borderRadius: 5,
    padding: '2px 8px',
    fontFamily: 'var(--font-mono)',
  },
  collapseBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--text-3)',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '5px 10px',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'color 0.15s, background 0.15s',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 13,
    color: '#0d0d0d',
    background: 'var(--green)',
    border: 'none',
    borderRadius: 7,
    padding: '7px 14px',
    fontWeight: 600,
    transition: 'all 0.15s',
    flexShrink: 0,
    textDecoration: 'none',
  },
  progressBanner: {
    padding: '20px 40px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-1)',
    flexShrink: 0,
  },
  tokenBanner: {
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-1)',
    flexShrink: 0,
  },
  tokenInner: {
    maxWidth: 'var(--max-w)',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  tokenTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--text)',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--green)',
    boxShadow: '0 0 8px var(--green)',
  },
  ide: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  viewTabs: {
    display: 'flex',
    gap: 2,
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-1)',
    flexShrink: 0,
  },
  viewTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--text-3)',
    background: 'transparent',
    border: 'none',
    padding: '5px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    transition: 'all 0.15s',
  },
  viewTabActive: {
    background: 'var(--bg-3)',
    color: 'var(--text)',
  },
  viewTabHighlight: {
    color: 'var(--green)',
    background: 'rgba(30,245,160,0.06)',
    border: '1px solid rgba(30,245,160,0.2)',
    borderRadius: 6,
  },
  previewDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--green)',
    boxShadow: '0 0 5px var(--green)',
    flexShrink: 0,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  logsDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--amber)',
    animation: 'pulse 1.2s infinite',
    flexShrink: 0,
  },
  logsCount: {
    fontSize: 10,
    background: 'var(--bg-4)',
    borderRadius: 99,
    padding: '1px 6px',
    color: 'var(--text-3)',
  },
  previewArea: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  logsArea: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0f',
  },
  logsEmpty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    fontSize: 12,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
  logsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 0',
  },
  logLine: {
    display: 'flex',
    gap: 14,
    padding: '3px 16px',
    alignItems: 'baseline',
  },
  logTime: {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    flexShrink: 0,
    minWidth: 75,
  },
  logMsg: {
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.6,
  },
  tokensArea: {
    flex: 1,
    overflow: 'hidden',
    flexDirection: 'column',
    background: 'var(--bg)',
  },
  spinnerSm: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid var(--border-2)',
    borderTopColor: 'var(--violet)',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  editBar: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: 600,
    background: 'rgba(15,15,20,0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(124,106,247,0.3)',
    borderRadius: 14,
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 100,
  },
  editIcon: { fontSize: 16, marginLeft: 10 },
  editInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 13,
    padding: '8px 4px',
  },
  editBtn: {
    background: 'var(--violet)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};
