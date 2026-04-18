import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('shubhpalan@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/auth/admin/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) navigate('/admin', { replace: true });
      })
      .catch(() => {});
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Admin login failed');

      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <div style={styles.badge}>Admin Access</div>
        <h1 style={styles.title}>Sign in to the control room</h1>
        <p style={styles.subtitle}>Separate admin authentication for analytics, users, generated websites, and contacts.</p>

        {error ? <div style={styles.error}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label style={styles.label}>
            Password
            <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Signing in...' : 'Enter Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: 'radial-gradient(circle at top, #172554 0%, #0f172a 38%, #020617 100%)',
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 24,
    padding: 32,
    boxShadow: '0 30px 80px rgba(2, 6, 23, 0.42)',
    color: '#f8fafc',
  },
  badge: {
    display: 'inline-flex',
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(56, 189, 248, 0.12)',
    color: '#7dd3fc',
    fontSize: 12,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 700,
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: '14px 0 24px',
    color: '#cbd5e1',
    lineHeight: 1.6,
  },
  form: {
    display: 'grid',
    gap: 16,
  },
  label: {
    display: 'grid',
    gap: 8,
    fontSize: 14,
    color: '#cbd5e1',
  },
  input: {
    width: '100%',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: 14,
    padding: '14px 16px',
    background: '#0f172a',
    color: '#f8fafc',
    outline: 'none',
  },
  button: {
    border: 'none',
    borderRadius: 14,
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(127, 29, 29, 0.5)',
    border: '1px solid rgba(248, 113, 113, 0.35)',
    color: '#fecaca',
  },
};
