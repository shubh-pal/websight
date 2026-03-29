import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState({
    anthropic: '',
    google: '',
    openai: '',
    groq: '',
  });
  const [showKeys, setShowKeys] = useState({
    anthropic: false,
    google: false,
    openai: false,
    groq: false,
  });
  const [savingKeys, setSavingKeys] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  function toggleShowKey(provider) {
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  }

  async function handleSaveKeys() {
    setSavingKeys(true);
    setKeySaveMessage('');
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(apiKeys),
      });
      if (!res.ok) throw new Error('Failed to save API keys');
      setKeySaveMessage('API keys saved successfully');
      setTimeout(() => setKeySaveMessage(''), 3000);
    } catch (err) {
      setKeySaveMessage('Error: ' + err.message);
    } finally {
      setSavingKeys(false);
    }
  }

  const planBadgeStyle = user?.plan === 'PRO'
    ? { ...styles.planBadge, background: 'rgba(168,151,255,0.2)', color: 'var(--violet-bright)', borderColor: 'rgba(168,151,255,0.4)' }
    : { ...styles.planBadge, background: 'rgba(160,160,176,0.2)', color: 'var(--text-2)', borderColor: 'rgba(160,160,176,0.4)' };

  return (
    <div style={styles.root}>
      <Navbar />
      <div style={styles.container}>
        <h1 style={styles.heading}>Settings</h1>

        <div style={styles.twoColumn}>
          {/* Left Column - Profile */}
          <div>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Profile</h2>

              {/* Avatar */}
              <div style={styles.profileSection}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} style={styles.avatar} />
                ) : (
                  <div style={styles.avatarPlaceholder}>
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={styles.profileInfo}>
                  <div style={styles.profileName}>{user?.name || 'User'}</div>
                  <div style={styles.profileEmail}>{user?.email}</div>
                </div>
              </div>

              <div style={styles.divider} />

              {/* Plan Badge */}
              <div style={styles.planSection}>
                <span style={planBadgeStyle}>
                  {user?.plan === 'PRO' ? '✦ PRO' : '◆ FREE'}
                </span>
              </div>

              {/* Buttons */}
              <div style={styles.buttonGroup}>
                <a href="/pricing" style={styles.primaryButton}>
                  Manage Plan
                </a>
                <button style={styles.secondaryButton} onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - API Keys */}
          <div>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>API Keys</h2>
              <p style={styles.cardDescription}>
                Use your own API keys to bypass platform limits
              </p>

              {/* API Key Inputs */}
              <div style={styles.apiKeysSection}>
                {[
                  { key: 'anthropic', label: 'Anthropic API Key', provider: 'Anthropic' },
                  { key: 'google', label: 'Google AI API Key', provider: 'Google AI' },
                  { key: 'openai', label: 'OpenAI API Key', provider: 'OpenAI' },
                  { key: 'groq', label: 'Groq API Key', provider: 'Groq' },
                ].map(({ key, label, provider }) => (
                  <div key={key} style={styles.keyInputGroup}>
                    <label style={styles.inputLabel}>{label}</label>
                    <div style={styles.inputWrapper}>
                      <input
                        type={showKeys[key] ? 'text' : 'password'}
                        placeholder={`Enter your ${provider} API key...`}
                        value={apiKeys[key]}
                        onChange={(e) => setApiKeys(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        style={styles.input}
                      />
                      <button
                        onClick={() => toggleShowKey(key)}
                        style={styles.showButton}
                        title={showKeys[key] ? 'Hide' : 'Show'}
                      >
                        {showKeys[key] ? '👁' : '👁‍🗨'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Button and Message */}
              <div style={styles.saveSection}>
                <button
                  onClick={handleSaveKeys}
                  disabled={savingKeys}
                  style={{
                    ...styles.saveButton,
                    opacity: savingKeys ? 0.6 : 1,
                    cursor: savingKeys ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingKeys ? 'Saving...' : 'Save Keys'}
                </button>
                {keySaveMessage && (
                  <div style={{
                    ...styles.message,
                    color: keySaveMessage.includes('successfully') ? 'var(--green)' : 'var(--red)'
                  }}>
                    {keySaveMessage}
                  </div>
                )}
              </div>

              <p style={styles.warning}>
                ⚠ Keys are stored encrypted and never shared
              </p>
              <p style={styles.warningSecondary}>
                ⚠ These override the platform default
              </p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={styles.dangerCard}>
          <div style={styles.dangerCardHeader}>
            <h2 style={styles.dangerCardTitle}>Danger Zone</h2>
          </div>
          <p style={styles.dangerCardDescription}>
            Permanently delete your account and all associated data
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={styles.dangerButton}
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Delete Account</h3>
            <p style={styles.modalText}>
              Contact support to delete your account
            </p>
            <div style={styles.modalButtons}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={styles.modalCancelButton}
              >
                Cancel
              </button>
              <a href="mailto:support@websight.com" style={styles.modalContactButton}>
                Contact Support
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '40px 24px',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(28px, 4vw, 42px)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    marginBottom: 32,
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: 24,
    marginBottom: 32,
  },
  card: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
  },
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 16,
  },
  cardDescription: {
    fontSize: 13,
    color: 'var(--text-2)',
    marginBottom: 20,
    fontFamily: 'var(--font-display)',
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--border-2)',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--violet)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    flexShrink: 0,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
    fontFamily: 'var(--font-display)',
  },
  profileEmail: {
    fontSize: 13,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '20px 0',
  },
  planSection: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
  },
  planBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 12px',
    border: '1px solid',
    borderRadius: 6,
    fontFamily: 'var(--font-mono)',
  },
  buttonGroup: {
    display: 'flex',
    gap: 12,
    flexDirection: 'column',
  },
  primaryButton: {
    padding: '12px 16px',
    background: 'var(--violet)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    border: 'none',
    cursor: 'pointer',
    display: 'block',
  },
  secondaryButton: {
    padding: '12px 16px',
    background: 'transparent',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
  apiKeysSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 20,
  },
  keyInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    fontFamily: 'var(--font-display)',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    padding: '10px 40px 10px 12px',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    transition: 'all 0.2s',
  },
  showButton: {
    position: 'absolute',
    right: 10,
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    color: 'var(--text-3)',
    padding: '4px 6px',
    transition: 'all 0.2s',
  },
  saveSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  saveButton: {
    padding: '12px 16px',
    background: 'var(--green)',
    color: '#000',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
  message: {
    fontSize: 13,
    fontFamily: 'var(--font-display)',
  },
  warning: {
    fontSize: 12,
    color: 'var(--green)',
    background: 'rgba(30,245,160,0.08)',
    border: '1px solid rgba(30,245,160,0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    marginBottom: 8,
    fontFamily: 'var(--font-mono)',
  },
  warningSecondary: {
    fontSize: 12,
    color: 'var(--text-3)',
    background: 'rgba(160,160,176,0.08)',
    border: '1px solid rgba(160,160,176,0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    fontFamily: 'var(--font-mono)',
  },
  dangerCard: {
    background: 'var(--bg-2)',
    border: '2px solid var(--red)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
  },
  dangerCardHeader: {
    marginBottom: 12,
  },
  dangerCardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--red)',
  },
  dangerCardDescription: {
    fontSize: 13,
    color: 'var(--text-2)',
    marginBottom: 16,
    fontFamily: 'var(--font-display)',
  },
  dangerButton: {
    padding: '12px 20px',
    background: 'transparent',
    color: 'var(--red)',
    border: '1px solid var(--red)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    maxWidth: 400,
    width: '100%',
    margin: '0 20px',
  },
  modalTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: 'var(--text-2)',
    marginBottom: 20,
    fontFamily: 'var(--font-display)',
  },
  modalButtons: {
    display: 'flex',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: '10px 16px',
    background: 'var(--bg-3)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    textDecoration: 'none',
  },
  modalContactButton: {
    flex: 1,
    padding: '10px 16px',
    background: 'var(--violet)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    textDecoration: 'none',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
