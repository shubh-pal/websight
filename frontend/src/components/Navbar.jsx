import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  const avatarUrl = user?.avatarUrl;
  const userName = user?.name || 'User';
  const plan = user?.plan || 'FREE';
  const firstLetter = userName.charAt(0).toUpperCase();

  return (
    <nav style={styles.navbar}>
      {/* Left: Logo */}
      <Link to="/" style={styles.logoSection}>
        <LogoMark />
        <span style={styles.logoText}>WebSight</span>
      </Link>

      {/* Center: Nav links */}
      <div style={styles.navLinks}>
        <Link to="/dashboard" style={styles.navLink}>Dashboard</Link>
        <Link to="/" style={styles.navLink}>New Project</Link>
      </div>

      {/* Right: User section */}
      <div style={styles.rightSection}>
        {user ? (
          <>
            {/* Avatar */}
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} style={styles.avatar} />
            ) : (
              <div style={styles.avatarPlaceholder}>{firstLetter}</div>
            )}

            {/* User name */}
            <span style={styles.userName}>{userName}</span>

            {/* Plan badge */}
            <span style={{
              ...styles.planBadge,
              ...(plan === 'PRO' ? styles.planBadgePro : styles.planBadgeFree),
            }}>
              {plan}
            </span>

            {/* Sign out button */}
            <button onClick={handleLogout} style={styles.signOutBtn}>
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" style={styles.signInBtn}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#7c6af7" />
      <path d="M7 14h14M14 7v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3" fill="#fff" />
    </svg>
  );
}

const styles = {
  navbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 40px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    gap: 30,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
    color: 'var(--text)',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  navLinks: {
    display: 'flex',
    gap: 24,
    flex: 1,
    justifyContent: 'center',
  },
  navLink: {
    fontSize: 14,
    color: 'var(--text-2)',
    textDecoration: 'none',
    transition: 'color 0.2s',
    fontWeight: 500,
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid var(--border)',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--violet)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    border: '1px solid var(--border)',
  },
  userName: {
    fontSize: 13,
    color: 'var(--text)',
    fontWeight: 500,
  },
  planBadge: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    padding: '4px 9px',
    borderRadius: 5,
    letterSpacing: '0.02em',
  },
  planBadgeFree: {
    background: 'rgba(124,106,247,0.12)',
    color: 'var(--violet-bright)',
    border: '1px solid rgba(124,106,247,0.3)',
  },
  planBadgePro: {
    background: 'rgba(0,212,232,0.12)',
    color: 'var(--cyan)',
    border: '1px solid rgba(0,212,232,0.3)',
  },
  signOutBtn: {
    fontSize: 12,
    color: 'var(--text-2)',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    padding: '6px 14px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: 500,
  },
  signInBtn: {
    fontSize: 13,
    color: '#fff',
    background: 'var(--violet)',
    padding: '8px 18px',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'all 0.2s',
    display: 'inline-block',
  },
};
