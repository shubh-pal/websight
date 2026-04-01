import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    keyLabel: 'Anthropic Key',
    placeholder: 'sk-ant-api03-…',
    hint: 'Get your free key at console.anthropic.com',
    hintUrl: 'https://console.anthropic.com/settings/keys',
    models: 'Claude Opus, Sonnet, Haiku',
    color: '#f5a623',
  },
  {
    id: 'gemini',
    label: 'Google AI',
    keyLabel: 'Google AI Key',
    placeholder: 'AIza…',
    hint: 'Get your free key at aistudio.google.com',
    hintUrl: 'https://aistudio.google.com/app/apikey',
    models: 'Gemini 2.5 Pro, Flash, Flash Lite',
    color: '#00d4e8',
  },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Stored hints from the server (what's already saved)
  const [savedKeys, setSavedKeys] = useState({}); // { anthropic: { configured: true, hint: '••••a3F9' }, ... }

  // Draft values the user is typing — only present if they're editing that provider
  const [drafts, setDrafts] = useState({ anthropic: '', gemini: '' });
  const [showKey, setShowKey]   = useState({ anthropic: false, gemini: false });
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');
  const [removing, setRemoving] = useState({}); // { anthropic: true/false }
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load existing key hints on mount
  useEffect(() => {
    if (!user) return;
    fetch('/auth/keys', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then(data => setSavedKeys(data))
      .catch(() => {});
  }, [user]);

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');

    // Only send providers where the user typed something
    const body = {};
    if (drafts.anthropic.trim()) body.anthropic = drafts.anthropic.trim();
    if (drafts.gemini.trim())    body.gemini    = drafts.gemini.trim();

    if (Object.keys(body).length === 0) {
      setSaveMsg('No changes to save — enter a key first.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/auth/keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      // Refresh hints
      const hints = await fetch('/auth/keys', { credentials: 'include' }).then(r => r.json());
      setSavedKeys(hints);
      // Clear drafts for saved providers
      setDrafts(prev => ({
        anthropic: body.anthropic ? '' : prev.anthropic,
        gemini:    body.gemini    ? '' : prev.gemini,
      }));
      setSaveMsg('Keys saved successfully ✓');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err) {
      setSaveMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(providerId) {
    setRemoving(prev => ({ ...prev, [providerId]: true }));
    try {
      const res = await fetch(`/auth/keys/${providerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove key');
      setSavedKeys(prev => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
    } catch (err) {
      setSaveMsg('Error removing key: ' + err.message);
    } finally {
      setRemoving(prev => ({ ...prev, [providerId]: false }));
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  const hasAnyKey = Object.keys(savedKeys).length > 0;

  return (
    <div style={styles.root}>
      <Navbar />
      <div style={styles.container}>

        <div style={styles.pageHeader}>
          <h1 style={styles.heading}>Settings</h1>
          <p style={styles.subheading}>WebSight is free to use — connect your own AI account to get started.</p>
        </div>

        {/* Setup status banner */}
        {!hasAnyKey && (
          <div style={styles.setupBanner}>
            <span style={styles.setupIcon}>🔑</span>
            <div>
              <div style={styles.setupBannerTitle}>Connect an AI account to start generating</div>
              <div style={styles.setupBannerSub}>Your keys are securely encrypted and never shared.</div>
            </div>
          </div>
        )}

        <div style={styles.layout}>
          {/* Left: Profile */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Profile</h2>
            <div style={styles.profileRow}>
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} style={styles.avatar} />
                : <div style={styles.avatarFallback}>{user?.name?.charAt(0).toUpperCase()}</div>
              }
              <div>
                <div style={styles.profileName}>{user?.name || 'User'}</div>
                <div style={styles.profileEmail}>{user?.email}</div>
              </div>
            </div>

            <div style={styles.divider} />

            <div style={styles.keyStatus}>
              {PROVIDERS.map(p => (
                <div key={p.id} style={styles.keyStatusRow}>
                  <span style={styles.keyStatusDot(!!savedKeys[p.id])} />
                  <span style={styles.keyStatusLabel}>{p.label}</span>
                  <span style={styles.keyStatusValue}>
                    {savedKeys[p.id] ? savedKeys[p.id].hint : 'not set'}
                  </span>
                </div>
              ))}
            </div>

            <div style={styles.divider} />

            <div style={styles.buttonStack}>
              <Link to="/" style={styles.primaryBtn}>← Back to Generator</Link>
              <button style={styles.secondaryBtn} onClick={handleLogout}>Sign Out</button>
            </div>
          </div>

          {/* Right: AI Connections */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>AI Connections</h2>
            <p style={styles.cardDesc}>
              Connect your AI accounts to enable website generation. Your keys are stored securely and only used for your own projects.
            </p>

            <div style={styles.providerList}>
              {PROVIDERS.map(p => {
                const isSaved = !!savedKeys[p.id];
                const draft   = drafts[p.id];
                return (
                  <div key={p.id} style={styles.providerBlock}>
                    <div style={styles.providerHeader}>
                      <div style={styles.providerMeta}>
                        <span style={styles.providerDot(p.color)} />
                        <div>
                          <div style={styles.providerName}>{p.label}</div>
                          <div style={styles.providerModels}>{p.models}</div>
                        </div>
                      </div>
                      {isSaved && (
                        <div style={styles.savedBadge}>
                          <span style={styles.savedDot} />
                          {savedKeys[p.id].hint}
                        </div>
                      )}
                    </div>

                    <div style={styles.inputRow}>
                      <input
                        type={showKey[p.id] ? 'text' : 'password'}
                        placeholder={isSaved ? `Update key (current: ${savedKeys[p.id].hint})` : p.placeholder}
                        value={draft}
                        onChange={e => setDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                        style={styles.input}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        onClick={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        style={styles.eyeBtn}
                        title={showKey[p.id] ? 'Hide' : 'Show'}
                      >
                        {showKey[p.id] ? '🙈' : '👁'}
                      </button>
                    </div>

                    <div style={styles.providerFooter}>
                      <a href={p.hintUrl} target="_blank" rel="noopener noreferrer" style={styles.keyLink}>
                        {p.hint} ↗
                      </a>
                      {isSaved && (
                        <button
                          onClick={() => handleRemove(p.id)}
                          disabled={removing[p.id]}
                          style={styles.removeBtn}
                        >
                          {removing[p.id] ? 'Removing…' : 'Remove key'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.saveRow}>
              <button
                onClick={handleSave}
                disabled={saving || (!drafts.anthropic.trim() && !drafts.gemini.trim())}
                style={{
                  ...styles.saveBtn,
                  opacity: saving || (!drafts.anthropic.trim() && !drafts.gemini.trim()) ? 0.5 : 1,
                  cursor:  saving || (!drafts.anthropic.trim() && !drafts.gemini.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save Keys'}
              </button>
              {saveMsg && (
                <span style={{
                  ...styles.saveMsg,
                  color: saveMsg.startsWith('Error') ? 'var(--red)' : 'var(--green)',
                }}>
                  {saveMsg}
                </span>
              )}
            </div>

            <div style={styles.encryptionNote}>
              🔒 Keys are encrypted with AES-256-GCM before storage — we cannot read them.
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={styles.dangerCard}>
          <h2 style={styles.dangerTitle}>Danger Zone</h2>
          <p style={styles.dangerDesc}>Permanently delete your account and all associated data.</p>
          <button onClick={() => setShowDeleteModal(true)} style={styles.dangerBtn}>
            Delete Account
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Delete Account</h3>
            <p style={styles.modalDesc}>Contact support to permanently delete your account and all data.</p>
            <div style={styles.modalBtns}>
              <button onClick={() => setShowDeleteModal(false)} style={styles.modalCancel}>Cancel</button>
              <a href="mailto:support@websight.app" style={styles.modalContact}>Contact Support</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--bg)' },
  container: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px' },

  pageHeader: { marginBottom: 32 },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(26px, 4vw, 40px)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
  },

  setupBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    background: 'rgba(245,166,35,0.08)',
    border: '1px solid rgba(245,166,35,0.3)',
    borderRadius: 'var(--radius)',
    padding: '16px 20px',
    marginBottom: 28,
  },
  setupIcon: { fontSize: 22, flexShrink: 0, lineHeight: 1.4 },
  setupBannerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f5a623',
    fontFamily: 'var(--font-display)',
    marginBottom: 4,
  },
  setupBannerSub: {
    fontSize: 13,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
  },

  layout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: 24,
    marginBottom: 28,
  },
  card: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
  },
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 20,
  },
  cardDesc: {
    fontSize: 13,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
    lineHeight: 1.6,
    marginBottom: 24,
  },

  // Profile
  profileRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-2)', flexShrink: 0 },
  avatarFallback: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'var(--violet)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 700, flexShrink: 0,
  },
  profileName: { fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 3 },
  profileEmail: { fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  divider: { height: 1, background: 'var(--border)', margin: '18px 0' },

  keyStatus: { display: 'flex', flexDirection: 'column', gap: 10 },
  keyStatusRow: { display: 'flex', alignItems: 'center', gap: 8 },
  keyStatusDot: configured => ({
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: configured ? 'var(--green)' : 'var(--text-3)',
    boxShadow: configured ? '0 0 6px rgba(30,245,160,0.5)' : 'none',
  }),
  keyStatusLabel: { fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-display)', flex: 1 },
  keyStatusValue: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },

  buttonStack: { display: 'flex', flexDirection: 'column', gap: 10 },
  primaryBtn: {
    padding: '11px 16px',
    background: 'var(--violet)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 14, fontWeight: 600,
    textAlign: 'center',
    fontFamily: 'var(--font-display)',
    display: 'block',
  },
  secondaryBtn: {
    padding: '11px 16px',
    background: 'transparent',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
  },

  // Provider blocks
  providerList: { display: 'flex', flexDirection: 'column', gap: 20 },
  providerBlock: {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '16px',
  },
  providerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  providerMeta: { display: 'flex', alignItems: 'center', gap: 10 },
  providerDot: color => ({
    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
    background: color, boxShadow: `0 0 8px ${color}88`,
  }),
  providerName: { fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 1.2 },
  providerModels: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 },
  savedBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(30,245,160,0.1)',
    border: '1px solid rgba(30,245,160,0.25)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)',
  },
  savedDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 },

  inputRow: { display: 'flex', alignItems: 'center', position: 'relative' },
  input: {
    flex: 1,
    padding: '10px 40px 10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  eyeBtn: {
    position: 'absolute', right: 10,
    background: 'none', border: 'none',
    fontSize: 15, cursor: 'pointer',
    color: 'var(--text-3)', padding: '4px 6px',
  },

  providerFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  keyLink: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textDecoration: 'none' },
  removeBtn: {
    fontSize: 12, color: 'var(--red)',
    background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: 'var(--font-display)', padding: 0,
  },

  saveRow: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 20 },
  saveBtn: {
    padding: '11px 24px',
    background: 'var(--green)',
    color: '#000',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 14, fontWeight: 700,
    fontFamily: 'var(--font-display)',
    transition: 'all 0.2s',
  },
  saveMsg: { fontSize: 13, fontFamily: 'var(--font-display)' },

  encryptionNote: {
    marginTop: 16,
    fontSize: 12,
    color: 'var(--text-3)',
    background: 'rgba(160,160,176,0.06)',
    border: '1px solid rgba(160,160,176,0.15)',
    borderRadius: 6,
    padding: '8px 12px',
    fontFamily: 'var(--font-mono)',
  },

  // Danger zone
  dangerCard: {
    background: 'var(--bg-2)',
    border: '2px solid rgba(255,80,80,0.4)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
  },
  dangerTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--red)', marginBottom: 8 },
  dangerDesc: { fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-display)', marginBottom: 16 },
  dangerBtn: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--red)',
    border: '1px solid var(--red)',
    borderRadius: 'var(--radius)',
    fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
  },

  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    maxWidth: 400, width: '100%', margin: '0 20px',
  },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 10 },
  modalDesc: { fontSize: 14, color: 'var(--text-2)', fontFamily: 'var(--font-display)', marginBottom: 20 },
  modalBtns: { display: 'flex', gap: 12 },
  modalCancel: {
    flex: 1, padding: '10px 16px',
    background: 'var(--bg-3)', color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-display)',
  },
  modalContact: {
    flex: 1, padding: '10px 16px',
    background: 'var(--violet)', color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 13, fontWeight: 600,
    fontFamily: 'var(--font-display)',
    textDecoration: 'none', textAlign: 'center',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
