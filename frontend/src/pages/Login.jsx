import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { user, login, signup, loginUrl } = useAuth();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        // navigate('/dashboard') happens via useEffect
      } else {
        const res = await signup(email, password, name);
        setMessage(res.message || 'Signup successful! Please log in.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Ambient grid */}
      <div style={styles.grid} aria-hidden />

      {/* Content */}
      <div style={styles.container}>
        <div style={styles.card}>
          {/* Logo */}
          <div style={styles.logoMark}>
            <LogoMark />
          </div>

          {/* Title */}
          <h1 style={styles.heading}>WebSight</h1>

          {/* Tagline */}
          <p style={styles.tagline}>{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>

          {message && <div style={styles.successMsg}>{message}</div>}
          {error && <div style={styles.errorMsg}>{error}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            {!isLogin && (
              <div style={styles.field}>
                <label style={styles.label}>Full Name</label>
                <input style={styles.input} type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div style={styles.field}>
              <label style={styles.label}>Email Address</label>
              <input style={styles.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <span style={styles.dividerLine} />
          </div>

          {/* Google sign-in button */}
          <a href={loginUrl} style={styles.googleBtn}>
            <GoogleIcon />
            Continue with Google
          </a>

          <div style={styles.toggle}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button style={styles.toggleBtn} onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }}>
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#7c6af7" />
      <path d="M7 14h14M14 7v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3" fill="#fff" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-10.3l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  container: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    padding: '24px',
  },
  card: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-xl)',
    padding: '40px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  logoMark: {
    marginBottom: 20,
    display: 'flex',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: 'var(--text-2)',
    marginBottom: 28,
    fontWeight: 500,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    textAlign: 'left',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    background: 'var(--violet)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    marginTop: 8,
    transition: 'opacity 0.2s',
  },
  divider: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    margin: '24px 0',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  dividerText: {
    fontSize: 12,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-mono)',
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 20px',
    background: '#fff',
    color: '#1f2937',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 10,
    border: '1px solid #d1d5db',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  toggle: {
    marginTop: 24,
    fontSize: 14,
    color: 'var(--text-2)',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--violet-bright)',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontSize: 14,
  },
  errorMsg: {
    width: '100%',
    padding: '10px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'left',
  },
  successMsg: {
    width: '100%',
    padding: '10px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: 8,
    color: '#22c55e',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'left',
  },
};
