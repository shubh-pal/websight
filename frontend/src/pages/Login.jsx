import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { user, loginUrl } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

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
          <p style={styles.tagline}>Sign in to save your projects</p>

          {/* Google sign-in button */}
          <a href={loginUrl} style={styles.signInBtn}>
            <GoogleIcon />
            Continue with Google
          </a>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#7c6af7" />
      <path d="M7 14h14M14 7v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3" fill="#fff" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11.5" fill="white" opacity="0.1" />
      <path d="M20 12a8 8 0 0 0-14.09-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 12a8 8 0 0 0 14.09 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.6" />
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
    padding: '48px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  logoMark: {
    marginBottom: 24,
    display: 'flex',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: 'var(--text-2)',
    marginBottom: 32,
    fontWeight: 500,
  },
  signInBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 20px',
    background: 'var(--violet)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 'var(--radius)',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.2s',
    letterSpacing: '-0.01em',
  },
};
