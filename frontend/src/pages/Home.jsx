import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const EXAMPLES = [
  'https://stripe.com',
  'https://linear.app',
  'https://vercel.com',
  'https://notion.so',
];

const MODELS = [
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    badge: '⚡ Fast',
    badgeColor: '#1ef5a0',
    desc: 'Fastest Gemini output',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    badge: '🚀 Smart',
    badgeColor: '#00d4e8',
    desc: 'Best Gemini quality',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet',
    badge: '◈ Balanced',
    badgeColor: '#a897ff',
    desc: 'High quality + fast',
  },
  {
    id: 'claude-opus-4-5',
    label: 'Claude Opus',
    badge: '✦ Best',
    badgeColor: '#f5a623',
    desc: 'Maximum quality output',
  },
];

export default function Home() {
  const [url, setUrl]           = useState('');
  const [framework, setFramework] = useState('react');
  const [model, setModel]       = useState('gemini-2.5-flash');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [recentProjects, setRecentProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(data => setRecentProjects(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/redesign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), framework, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      navigate(`/result/${data.jobId}?url=${encodeURIComponent(url)}&fw=${framework}&model=${model}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Ambient grid */}
      <div style={styles.grid} aria-hidden />

      {/* Top bar */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <LogoMark />
          <span style={styles.logoText}>WebSight</span>
        </div>
        <a
          href="https://github.com"
          style={styles.ghLink}
          target="_blank"
          rel="noreferrer"
        >
          <GithubIcon /> GitHub
        </a>
      </header>

      {/* Hero */}
      <main style={styles.main}>
        <div style={styles.badge}>
          <span style={styles.badgeDot} />
          AI-powered · React &amp; Angular output
        </div>

        <h1 style={styles.heading}>
          Redesign any website<br />
          <span style={styles.headingAccent}>in seconds.</span>
        </h1>

        <p style={styles.sub}>
          Paste a URL or capture a tab with the Chrome extension.
          WebSight scrapes the site, extracts its design system, then
          generates a complete, runnable project — not just mockups.
        </p>

        {/* Input card */}
        <form onSubmit={handleSubmit} style={styles.card}>
          <div style={styles.inputRow}>
            <span style={styles.inputIcon}>↗</span>
            <input
              style={styles.input}
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Framework pills */}
          <div style={styles.fwRow}>
            <span style={styles.fwLabel}>Output framework</span>
            <div style={styles.pills}>
              {['react', 'angular'].map(fw => (
                <button
                  key={fw}
                  type="button"
                  onClick={() => setFramework(fw)}
                  style={{
                    ...styles.pill,
                    ...(framework === fw ? styles.pillActive : {}),
                  }}
                >
                  {fw === 'react' ? '⚛ React + Vite' : '🅰 Angular'}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          <div style={styles.modelRow}>
            <span style={styles.fwLabel}>AI model</span>
            <div style={styles.modelGrid}>
              {MODELS.map(m => {
                const active = model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m.id)}
                    style={{ ...styles.modelCard, ...(active ? styles.modelCardActive : {}) }}
                  >
                    <div style={styles.modelTop}>
                      <span style={styles.modelName}>{m.label}</span>
                      <span style={{ ...styles.modelBadge, color: m.badgeColor, borderColor: m.badgeColor + '44', background: m.badgeColor + '12' }}>
                        {m.badge}
                      </span>
                    </div>
                    <span style={styles.modelDesc}>{m.desc}</span>
                    {active && <span style={styles.modelCheck}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? (
              <>
                <span style={styles.spinner} />
                Starting job…
              </>
            ) : (
              <>
                Generate Project <span style={styles.btnArrow}>→</span>
              </>
            )}
          </button>
        </form>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div style={styles.recentSection}>
            <h3 style={styles.recentTitle}>Recent Projects</h3>
            <div style={styles.recentGrid}>
              {recentProjects.slice(0, 3).map(p => (
                <Link key={p.id} to={`/result/${p.id}`} style={styles.recentCard}>
                  <div style={styles.recentCardTop}>
                    <span style={styles.recentName}>{p.projectName || 'Untitled'}</span>
                    <span style={styles.recentStatus}>{p.status === 'done' ? '✓' : '...'}</span>
                  </div>
                  {p.tokens && (
                    <div style={styles.recentTokens}>
                      <div style={{...styles.colorDot, background: p.tokens.primaryColor}} />
                      <div style={{...styles.colorDot, background: p.tokens.secondaryColor}} />
                      <div style={{...styles.colorDot, background: p.tokens.accentColor}} />
                    </div>
                  )}
                  <div style={styles.recentMeta}>
                    {p.framework} · {p.model.replace('claude-', '').replace('gemini-', '')}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Example links */}
        <div style={styles.examples}>
          <span style={styles.examplesLabel}>Or try an example:</span>
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              type="button"
              onClick={() => setUrl(ex)}
              style={styles.exampleBtn}
            >
              {ex.replace('https://', '')}
            </button>
          ))}
        </div>

        {/* How it works */}
        <div style={styles.steps}>
          {[
            { n: '01', title: 'Scrape', desc: 'Puppeteer renders the full DOM, extracts colors, fonts, nav structure.' },
            { n: '02', title: 'Analyze', desc: 'Claude extracts a coherent design system — tokens, component list, page map.' },
            { n: '03', title: 'Generate', desc: 'Multi-step AI: tokens → shared components → pages. Everything references the same system.' },
            { n: '04', title: 'Download', desc: 'Get a ZIP with a runnable Vite or Angular project. npm install && npm run dev.' },
          ].map(s => (
            <div key={s.n} style={styles.step}>
              <div style={styles.stepNum}>{s.n}</div>
              <div style={styles.stepTitle}>{s.title}</div>
              <div style={styles.stepDesc}>{s.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ── Icons ── */
function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#7c6af7" />
      <path d="M7 14h14M14 7v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3" fill="#fff" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4 11.5 11.5 0 0 1 3 .4c2.28-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/* ── Styles ── */
const styles = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(124,106,247,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,106,247,0.04) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 40px',
    borderBottom: '1px solid var(--border)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  ghLink: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: 'var(--text-2)',
    padding: '6px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-2)',
    transition: 'all 0.2s',
  },
  main: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 680,
    margin: '0 auto',
    padding: '80px 24px 120px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--violet-bright)',
    background: 'rgba(124,106,247,0.1)',
    border: '1px solid rgba(124,106,247,0.25)',
    borderRadius: 99,
    padding: '5px 14px',
    marginBottom: 28,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.03em',
  },
  badgeDot: {
    width: 7, height: 7,
    borderRadius: '50%',
    background: 'var(--violet-bright)',
    boxShadow: '0 0 6px var(--violet-bright)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(36px, 6vw, 58px)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    color: 'var(--text)',
    marginBottom: 20,
  },
  headingAccent: {
    background: 'linear-gradient(135deg, #7c6af7 0%, #00d4e8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  sub: {
    fontSize: 16,
    color: 'var(--text-2)',
    lineHeight: 1.7,
    maxWidth: 520,
    marginBottom: 44,
  },
  card: {
    width: '100%',
    background: 'var(--bg-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-xl)',
    padding: '6px',
    marginBottom: 20,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--bg-3)',
    borderRadius: 14,
    padding: '12px 18px',
    marginBottom: 6,
    border: '1px solid var(--border)',
  },
  inputIcon: {
    fontSize: 18,
    color: 'var(--text-3)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text)',
    fontSize: 15,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.01em',
    '::placeholder': { color: 'var(--text-3)' },
  },
  fwRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    marginBottom: 6,
  },
  modelRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '6px 12px',
    marginBottom: 6,
  },
  modelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
  },
  modelCard: {
    position: 'relative',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 10px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  modelCardActive: {
    background: 'rgba(124,106,247,0.1)',
    borderColor: 'rgba(124,106,247,0.45)',
  },
  modelTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  modelName: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  modelBadge: {
    fontSize: 9,
    borderRadius: 4,
    padding: '1px 5px',
    border: '1px solid',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: 'var(--font-mono)',
  },
  modelDesc: {
    fontSize: 10,
    color: 'var(--text-3)',
    lineHeight: 1.4,
  },
  modelCheck: {
    position: 'absolute',
    top: 6,
    right: 7,
    fontSize: 10,
    color: 'var(--violet-bright)',
    fontWeight: 700,
  },
  fwLabel: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  pills: { display: 'flex', gap: 6 },
  pill: {
    fontSize: 12,
    color: 'var(--text-2)',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '5px 12px',
    transition: 'all 0.15s',
    cursor: 'pointer',
  },
  pillActive: {
    color: 'var(--violet-bright)',
    background: 'var(--violet-glow)',
    borderColor: 'rgba(124,106,247,0.4)',
  },
  error: {
    fontSize: 13,
    color: 'var(--red)',
    padding: '6px 12px',
    textAlign: 'left',
  },
  btn: {
    width: '100%',
    padding: '14px 24px',
    background: 'var(--violet)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'all 0.2s',
    letterSpacing: '-0.01em',
  },
  btnArrow: { fontSize: 18 },
  spinner: {
    width: 16, height: 16,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  examples: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 64,
  },
  examplesLabel: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  exampleBtn: {
    fontSize: 12,
    color: 'var(--cyan)',
    background: 'rgba(0,212,232,0.06)',
    border: '1px solid rgba(0,212,232,0.2)',
    borderRadius: 6,
    padding: '4px 10px',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  steps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    width: '100%',
    textAlign: 'left',
  },
  step: {
    background: 'var(--bg-1)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 18px',
  },
  stepNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--violet)',
    marginBottom: 8,
    letterSpacing: '0.05em',
  },
  stepTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--text)',
    marginBottom: 6,
  },
  stepDesc: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 },
  recentSection: { width: '100%', marginBottom: 44, textAlign: 'left' },
  recentTitle: { fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  recentGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  recentCard: { 
    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, 
    textDecoration: 'none', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 6 
  },
  recentCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  recentName: { fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  recentStatus: { fontSize: 11, color: 'var(--green)' },
  recentTokens: { display: 'flex', gap: 4, margin: '2px 0' },
  colorDot: { width: 10, height: 10, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' },
  recentMeta: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
};
