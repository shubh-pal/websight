import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

const EXAMPLES = [
  'https://stripe.com',
  'https://linear.app',
  'https://vercel.com',
  'https://notion.so',
];

const WEB_MODELS = [
  { id: 'gemini-2.5-flash',      provider: 'gemini',    label: 'Gemini 2.5 Flash',  badge: '⚡ Fast',     badgeColor: '#1ef5a0', desc: 'Fast & capable · Google',  tier: 'free' },
  { id: 'gemini-2.5-flash-lite', provider: 'gemini',    label: 'Gemini Flash Lite', badge: '🚀 Fastest', badgeColor: '#a8f5d0', desc: 'Fastest output · Google',  tier: 'free' },
  { id: 'claude-sonnet-4-6',     provider: 'anthropic', label: 'Claude Sonnet 4',   badge: '◈ Balanced', badgeColor: '#a897ff', desc: 'High quality · Anthropic', tier: 'paid' },
  { id: 'claude-opus-4-5',       provider: 'anthropic', label: 'Claude Opus',       badge: '✦ Premium',  badgeColor: '#f5a623', desc: 'Best Claude · Anthropic',  tier: 'paid' },
  { id: 'claude-haiku-4-5',      provider: 'anthropic', label: 'Claude Haiku',      badge: '⚡ Light',   badgeColor: '#d4a0ff', desc: 'Fast & cheap · Anthropic', tier: 'paid' },
];

const MODEL_PROVIDER = Object.fromEntries(WEB_MODELS.map(m => [m.id, m.provider]));

const HOW_IT_WORKS = [
  { n: '01', title: 'Paste a URL', desc: 'Drop any website URL into the input — or use the Chrome extension to capture a tab including authenticated pages.' },
  { n: '02', title: 'AI Scrapes & Analyzes', desc: 'Puppeteer renders the full page. Claude reads everything: layout, palette, fonts, component structure, copy.' },
  { n: '03', title: 'Code is Generated', desc: 'A multi-step AI pipeline: design tokens first, then shared components, then full pages — all internally consistent.' },
  { n: '04', title: 'Download & Run', desc: "Get a ZIP with a complete Vite (React) project. One install command and you're live locally." },
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [framework, setFramework] = useState('react');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bypassCache, setBypassCache] = useState(false);
  const [recentProjects, setRecentProjects] = useState([]);
  const [savedKeys, setSavedKeys] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) { setRecentProjects([]); setSavedKeys(null); return; }
    Promise.all([
      fetch('/api/jobs').then(r => r.json()).catch(() => []),
      fetch('/auth/keys', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
    ]).then(([jobs, keys]) => {
      setRecentProjects(Array.isArray(jobs) ? jobs : []);
      setSavedKeys(keys);
    });
  }, [user]);

  const availableModels = savedKeys === null ? [] : WEB_MODELS.filter(m => savedKeys[m.provider]);
  const selectedProvider = MODEL_PROVIDER[model];
  const isModelAvailable = savedKeys && savedKeys[selectedProvider];
  if (savedKeys !== null && !isModelAvailable && availableModels.length > 0 && availableModels[0].id !== model) {
    setModel(availableModels[0].id);
  }
  const needsKey = user && savedKeys !== null && availableModels.length === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;

    if (!user) {
      navigate('/login');
      return;
    }

    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/redesign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ url: url.trim(), framework, model, bypassCache }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      navigate(`/result/${data.jobId}?url=${encodeURIComponent(url)}&fw=${framework}&model=${model}`);
    } catch (err) { setError(err.message); setLoading(false); }
  }

  async function handleContactSubmit(e) {
    e.preventDefault();
    setContactLoading(true); setContactError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setContactSuccess(true);
      setContactName(''); setContactEmail(''); setContactMessage('');
    } catch (err) {
      setContactError(err.message);
    } finally {
      setContactLoading(false);
    }
  }

  return (
    <div style={s.root}>
      <div style={s.grid} aria-hidden />
      <div style={s.topGlow} aria-hidden />
      <Navbar />

      {/* ══════════ HERO ══════════ */}
      <section id="hero" style={{ ...s.hero, opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'none' : 'translateY(20px)', transition: 'opacity 0.65s ease, transform 0.65s ease' }}>
        <div style={s.heroBadge}>
          <span style={s.badgeDot} />
          Free to use · AI-powered · Open source
        </div>

        <h1 style={s.heroH1}>
          Redesign any website<br />
          <span style={s.heroAccent}>in seconds.</span>
        </h1>

        <p style={s.heroSub}>
          Paste a URL. WebSight scrapes the live page, extracts its full design system,
          then generates a <strong style={{ color: 'var(--text)' }}>complete, runnable project</strong> — not mockups. Real code you can ship.
        </p>

        {needsKey && (
          <div style={s.keyBanner}>
            <span>🔑</span>
            <span style={{ color: '#f5c842', flex: 1 }}>No API key configured.</span>
            <Link to="/settings" style={{ color: '#f5a623', fontWeight: 700 }}>Add in Settings →</Link>
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.inputCard}>
          <div style={s.inputRow}>
            <span style={s.inputIcon}>↗</span>
            <input style={s.input} type="url" placeholder="https://example.com"
              value={url} onChange={e => setUrl(e.target.value)} required autoFocus />
          </div>

          <div style={s.fwRow}>
            <span style={s.fwLabel}>Output framework</span>
            <div style={s.pills}>
              {['react'].map(fw => (
                <button key={fw} type="button" onClick={() => setFramework(fw)}
                  style={{ ...s.pill, ...(framework === fw ? s.pillActive : {}) }}>
                  {fw === 'react' ? '⚛ React + Vite' : '🅰 Angular'}
                </button>
              ))}
            </div>
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" style={s.submitBtn} disabled={loading}>
            {loading ? <><span style={s.spinner} />Starting job…</> : <>Generate Project <span style={{ fontSize: 18 }}>→</span></>}
          </button>

          <div style={s.modelBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={s.modelBarLabel}>Model</span>
              <span style={s.modelBarValue}>{WEB_MODELS.find(m => m.id === model)?.label || model}</span>
            </div>
            <button type="button" style={s.modelBarBtn} onClick={() => setShowModelPicker(true)}>⚙ Update</button>
          </div>

          <label style={s.cacheRow}>
            <span style={s.cacheCheckbox}>
              <input type="checkbox" checked={bypassCache} onChange={e => setBypassCache(e.target.checked)} style={s.cacheInput} />
              <span style={{ ...s.cacheBox, ...(bypassCache ? s.cacheBoxChecked : {}) }}>
                {bypassCache && <span style={s.cacheCheck}>✓</span>}
              </span>
            </span>
            <span style={s.cacheLabelText}>Bypass cache<span style={{ opacity: 0.5 }}> — force fresh generation</span></span>
          </label>
        </form>

        <div style={s.examples}>
          <span style={s.examplesLabel}>Try an example:</span>
          {EXAMPLES.map(ex => (
            <button key={ex} type="button" onClick={() => setUrl(ex)} style={s.exampleBtn}>
              {ex.replace('https://', '')}
            </button>
          ))}
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.sectionLabel}>How it works</div>
          <h2 style={s.sectionH2}>From URL to running code in four steps</h2>
          <p style={s.sectionSub}>No config. No templates. No hand-holding. Just AI doing the heavy lifting.</p>

          <div style={s.stepsGrid}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.n} style={{ ...s.stepCard, ...(i === HOW_IT_WORKS.length - 1 ? { borderBottom: 'none' } : {}) }}>
                <div style={s.stepNum}>{step.n}</div>
                <div style={s.stepContent}>
                  <div style={s.stepTitle}>{step.title}</div>
                  <div style={s.stepDesc}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CONTACT ══════════ */}
      <section style={{ ...s.section, background: 'var(--bg-1)' }} id="contact">
        <div style={s.sectionInner}>
          <div style={s.sectionLabel}>Get in touch</div>
          <h2 style={s.sectionH2}>Let's talk</h2>
          <p style={s.sectionSub}>Have feedback, want access, or just want to say hi? Reach out — I'd love to hear from you.</p>

          <div style={s.contactLayout}>
            {/* Left: social links */}
            <div style={s.contactLinks}>
              <a href="https://www.linkedin.com/in/shubhpalan/" target="_blank" rel="noopener noreferrer" style={s.contactLink}>
                <span style={{ ...s.contactLinkIcon, background: 'rgba(10,102,194,0.15)', border: '1px solid rgba(10,102,194,0.35)' }}>
                  <LinkedInIcon />
                </span>
                <div>
                  <div style={s.contactLinkLabel}>LinkedIn</div>
                  <div style={s.contactLinkValue}>shubhpalan</div>
                </div>
              </a>
              <a href="mailto:shubhpalan@gmail.com" style={s.contactLink}>
                <span style={{ ...s.contactLinkIcon, background: 'rgba(124,106,247,0.12)', border: '1px solid rgba(124,106,247,0.3)' }}>
                  <EmailIcon />
                </span>
                <div>
                  <div style={s.contactLinkLabel}>Email</div>
                  <div style={s.contactLinkValue}>shubhpalan@gmail.com</div>
                </div>
              </a>
              <div style={s.contactNote}>
                <span style={s.contactNoteDot} />
                Usually responds within 24 hours
              </div>
            </div>

            {/* Right: contact form */}
            <div style={s.contactFormWrap}>
              {contactSuccess ? (
                <div style={s.contactSuccess}>
                  <span style={{ fontSize: 28 }}>✓</span>
                  <div style={s.contactSuccessTitle}>Message sent!</div>
                  <div style={s.contactSuccessSub}>Thanks for reaching out. I'll get back to you soon.</div>
                  <button style={s.contactSuccessBtn} onClick={() => setContactSuccess(false)}>Send another</button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={s.contactForm}>
                  <div style={s.contactFieldRow}>
                    <div style={s.contactField}>
                      <label style={s.contactFieldLabel}>Name</label>
                      <input style={s.contactInput} type="text" placeholder="Your name" value={contactName}
                        onChange={e => setContactName(e.target.value)} required />
                    </div>
                    <div style={s.contactField}>
                      <label style={s.contactFieldLabel}>Email</label>
                      <input style={s.contactInput} type="email" placeholder="your@email.com" value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)} required />
                    </div>
                  </div>
                  <div style={s.contactField}>
                    <label style={s.contactFieldLabel}>Message</label>
                    <textarea style={s.contactTextarea} placeholder="What's on your mind?" value={contactMessage}
                      onChange={e => setContactMessage(e.target.value)} required rows={4} />
                  </div>
                  {contactError && <p style={s.error}>{contactError}</p>}
                  <button type="submit" style={s.contactSubmit} disabled={contactLoading}>
                    {contactLoading ? <><span style={s.spinner} />Sending…</> : <>Send message →</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section style={s.ctaSection}>
        <div style={s.ctaGlow} aria-hidden />
        <div style={s.ctaInner}>
          <div style={s.sectionLabel}>Get started</div>
          <h2 style={{ ...s.sectionH2, marginBottom: 16 }}>Free to use. Bring your own key.</h2>
          <p style={{ ...s.sectionSub, marginBottom: 40 }}>
            Grab a free Gemini API key from Google AI Studio and start redesigning any website immediately.
            Zero cost. Zero setup. Just results.
          </p>
          <div style={s.ctaBtns}>
            <a href="#hero" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={s.ctaPrimary}>
              Try it now →
            </a>
            <a href="#contact" onClick={e => { e.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); }} style={s.ctaSecondary}>
              Get in touch
            </a>
          </div>
          <p style={s.ctaNote}>No credit card required · Free Gemini tier available</p>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerLeft}>
            <div style={s.footerLogo}>
              <LogoMark />
              <span style={s.footerLogoText}>WebSight</span>
            </div>
            <p style={s.footerTagline}>AI-powered website redesign. Scrape → Analyze → Generate → Run.</p>
          </div>
          <div style={s.footerLinks}>
            <Link to="/login" style={s.footerLink}>Sign In</Link>
            <Link to="/settings" style={s.footerLink}>Settings</Link>
            <Link to="/dashboard" style={s.footerLink}>Dashboard</Link>
            <a href="https://www.linkedin.com/in/shubhpalan/" target="_blank" rel="noopener noreferrer" style={s.footerLink}>LinkedIn</a>
          </div>
        </div>
      </footer>

      {/* ══════════ MODEL MODAL ══════════ */}
      {showModelPicker && (
        <div style={s.modalOverlay} onClick={() => setShowModelPicker(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>⚙ Model Settings</span>
              <button style={s.modalClose} onClick={() => setShowModelPicker(false)}>✕</button>
            </div>
            <div style={s.modalSection}>
              <label style={s.modalLabel}>Web Generation Model</label>
              <p style={s.modalHint}>Only models with a configured API key are shown.</p>
              {availableModels.length === 0 ? (
                <div style={s.noModels}>
                  <span style={{ fontSize: 18 }}>🔑</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>No API keys configured yet.</span>
                </div>
              ) : (
                <>
                  <select value={model} onChange={e => setModel(e.target.value)} style={s.modalSelect}>
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id}>({m.tier === 'free' ? 'Free' : 'Paid'}) {m.label} — {m.desc}</option>
                    ))}
                  </select>
                  {availableModels.find(m => m.id === model) && (() => {
                    const sel = availableModels.find(m => m.id === model);
                    return (
                      <div style={s.modelPreview}>
                        <span style={{ ...s.modelPreviewBadge, color: sel.badgeColor, borderColor: sel.badgeColor + '44', background: sel.badgeColor + '15' }}>{sel.badge}</span>
                        <span style={s.modelPreviewDesc}>{sel.desc}</span>
                        <span style={{ ...s.tierBadge, background: sel.tier === 'free' ? 'rgba(30,245,160,0.1)' : 'rgba(245,166,35,0.1)', color: sel.tier === 'free' ? 'var(--green)' : '#f5a623', borderColor: sel.tier === 'free' ? 'rgba(30,245,160,0.3)' : 'rgba(245,166,35,0.3)' }}>
                          {sel.tier === 'free' ? 'Free tier' : 'Paid'}
                        </span>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            <div style={s.modalFooter}>
              <Link to="/settings" style={s.settingsLink} onClick={() => setShowModelPicker(false)}>🔑 Manage API Keys →</Link>
              <button style={s.modalSave} onClick={() => setShowModelPicker(false)}>Save & Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#7c6af7" />
      <path d="M7 14h14M14 7v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3" fill="#fff" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  root: { minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' },
  grid: {
    position: 'fixed', inset: 0,
    backgroundImage: `linear-gradient(rgba(124,106,247,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,106,247,0.04) 1px, transparent 1px)`,
    backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0,
  },
  topGlow: {
    position: 'fixed', top: '-30vh', left: '50%', transform: 'translateX(-50%)',
    width: '80vw', height: '70vh',
    background: 'radial-gradient(ellipse at center, rgba(124,106,247,0.13) 0%, transparent 68%)',
    pointerEvents: 'none', zIndex: 0,
  },

  // Hero
  hero: {
    position: 'relative', zIndex: 1,
    maxWidth: 700, margin: '0 auto',
    padding: '100px 24px 88px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
  },
  heroBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11,
    color: 'var(--violet-bright)', background: 'rgba(124,106,247,0.10)',
    border: '1px solid rgba(124,106,247,0.25)', borderRadius: 99,
    padding: '5px 16px', marginBottom: 32, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
  },
  badgeDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: 'var(--violet-bright)', boxShadow: '0 0 6px var(--violet-bright)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  heroH1: {
    fontFamily: 'var(--font-display)', fontSize: 'clamp(38px, 6.5vw, 64px)',
    fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08,
    color: 'var(--text)', marginBottom: 24,
  },
  heroAccent: {
    background: 'linear-gradient(135deg, #7c6af7 0%, #00d4e8 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  heroSub: { fontSize: 17, color: 'var(--text-2)', lineHeight: 1.75, maxWidth: 540, marginBottom: 48 },

  keyBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)',
    borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 16,
    fontSize: 13, width: '100%',
  },
  inputCard: {
    width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-xl)', padding: '6px', marginBottom: 20,
  },
  inputRow: {
    display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-3)',
    borderRadius: 14, padding: '13px 18px', marginBottom: 6, border: '1px solid var(--border)',
  },
  inputIcon: { fontSize: 18, color: 'var(--text-3)', flexShrink: 0 },
  input: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font-mono)', letterSpacing: '0.01em',
  },
  fwRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', marginBottom: 6 },
  fwLabel: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  pills: { display: 'flex', gap: 6 },
  pill: { fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', transition: 'all 0.15s', cursor: 'pointer' },
  pillActive: { color: 'var(--violet-bright)', background: 'var(--violet-glow)', borderColor: 'rgba(124,106,247,0.4)' },
  error: { fontSize: 13, color: 'var(--red)', padding: '6px 12px', textAlign: 'left' },
  submitBtn: {
    width: '100%', padding: '14px 24px', background: 'var(--violet)', color: '#fff',
    fontSize: 15, fontWeight: 600, borderRadius: 14, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10, transition: 'all 0.2s', letterSpacing: '-0.01em', border: 'none', cursor: 'pointer',
  },
  spinner: { width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' },
  modelBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 2 },
  modelBarLabel: { fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' },
  modelBarValue: { fontSize: 12, color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)' },
  modelBarBtn: { fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s' },
  cacheRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 4px', cursor: 'pointer', userSelect: 'none' },
  cacheCheckbox: { position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  cacheInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
  cacheBox: { width: 14, height: 14, borderRadius: 4, border: '1px solid var(--border-2)', background: 'var(--bg-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  cacheBoxChecked: { background: 'rgba(124,106,247,0.2)', borderColor: 'rgba(124,106,247,0.6)' },
  cacheCheck: { fontSize: 9, color: 'var(--violet-bright)', fontWeight: 700, lineHeight: 1 },
  cacheLabelText: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  examples: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  examplesLabel: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  exampleBtn: { fontSize: 12, color: 'var(--cyan)', background: 'rgba(0,212,232,0.06)', border: '1px solid rgba(0,212,232,0.2)', borderRadius: 6, padding: '4px 10px', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s' },

  // Sections
  section: { position: 'relative', zIndex: 1, padding: '96px 24px', borderTop: '1px solid var(--border)' },
  sectionInner: { maxWidth: 1000, margin: '0 auto' },
  sectionLabel: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--violet-bright)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 },
  sectionH2: { fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3.8vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 12, lineHeight: 1.15 },
  sectionSub: { fontSize: 16, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 560, marginBottom: 52 },

  // How it works
  stepsGrid: { display: 'flex', flexDirection: 'column', gap: 0 },
  stepCard: { display: 'flex', gap: 28, alignItems: 'flex-start', padding: '30px 0', borderBottom: '1px solid var(--border)' },
  stepNum: { fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--violet-bright)', background: 'rgba(124,106,247,0.12)', border: '1px solid rgba(124,106,247,0.3)', borderRadius: 8, padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 },
  stepContent: { flex: 1, paddingTop: 2 },
  stepTitle: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 8 },
  stepDesc: { fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65 },

  // Contact
  contactLayout: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 48, alignItems: 'start' },
  contactLinks: { display: 'flex', flexDirection: 'column', gap: 16 },
  contactLink: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    textDecoration: 'none', transition: 'border-color 0.2s, transform 0.15s',
    color: 'var(--text)',
  },
  contactLinkIcon: {
    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, color: 'var(--text-2)',
  },
  contactLinkLabel: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 },
  contactLinkValue: { fontSize: 14, color: 'var(--text)', fontWeight: 600 },
  contactNote: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', paddingLeft: 4 },
  contactNoteDot: { width: 6, height: 6, borderRadius: '50%', background: '#1ef5a0', boxShadow: '0 0 6px #1ef5a0', flexShrink: 0 },

  // Contact form
  contactFormWrap: { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px' },
  contactForm: { display: 'flex', flexDirection: 'column', gap: 16 },
  contactFieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  contactField: { display: 'flex', flexDirection: 'column', gap: 6 },
  contactFieldLabel: { fontSize: 12, color: 'var(--text-2)', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  contactInput: {
    background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none',
    fontFamily: 'var(--font-body)', transition: 'border-color 0.15s',
  },
  contactTextarea: {
    background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none',
    fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.6,
    transition: 'border-color 0.15s',
  },
  contactSubmit: {
    padding: '13px 24px', background: 'var(--violet)', color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity 0.2s',
    alignSelf: 'flex-start',
  },
  contactSuccess: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '48px 24px', textAlign: 'center',
    color: '#1ef5a0',
  },
  contactSuccessTitle: { fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text)' },
  contactSuccessSub: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 },
  contactSuccessBtn: {
    marginTop: 8, padding: '9px 20px', background: 'transparent', color: 'var(--text-2)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    fontWeight: 500, transition: 'all 0.15s',
  },

  // CTA
  ctaSection: { position: 'relative', zIndex: 1, padding: '120px 24px', textAlign: 'center', borderTop: '1px solid var(--border)', overflow: 'hidden' },
  ctaGlow: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', background: 'radial-gradient(ellipse at center, rgba(124,106,247,0.1) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 },
  ctaInner: { maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1 },
  ctaBtns: { display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' },
  ctaPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: 'var(--violet)', color: '#fff', borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', letterSpacing: '-0.01em' },
  ctaSecondary: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: 'transparent', color: 'var(--text)', borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--border-2)', transition: 'all 0.2s', cursor: 'pointer' },
  ctaNote: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },

  // Footer
  footer: { borderTop: '1px solid var(--border)', padding: '48px 24px', position: 'relative', zIndex: 1 },
  footerInner: { maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', justifyContent: 'space-between' },
  footerLeft: { display: 'flex', flexDirection: 'column', gap: 8 },
  footerLogo: { display: 'flex', alignItems: 'center', gap: 10 },
  footerLogoText: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' },
  footerTagline: { fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  footerLinks: { display: 'flex', gap: 24 },
  footerLink: { fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', transition: 'color 0.2s' },

  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 32px', width: 480, maxWidth: '94vw', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 20 },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  modalClose: { background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 16, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 },
  modalSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  modalLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  modalHint: { fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.4 },
  modalSelect: { width: '100%', padding: '10px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-body)' },
  modelPreview: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' },
  modelPreviewBadge: { fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '2px 7px', borderRadius: 4, border: '1px solid', whiteSpace: 'nowrap' },
  modelPreviewDesc: { fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4, flex: 1 },
  tierBadge: { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, border: '1px solid', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' },
  noModels: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 8 },
  modalFooter: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  settingsLink: { display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, transition: 'all 0.15s' },
  modalSave: { width: '100%', padding: '12px', background: 'var(--violet)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s' },
};
