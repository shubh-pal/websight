import { Link, NavLink, useNavigate } from 'react-router-dom';

export default function AdminLayout({ title, eyebrow, actions, children }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await fetch('/auth/admin/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    navigate('/admin/login', { replace: true });
  }

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <Link to="/admin/dashboard" style={styles.brand}>WebSight Admin</Link>
          <div style={styles.sidebarCaption}>Operations</div>
          <nav style={styles.sidebarNav}>
            <AdminNavLink to="/admin/dashboard">Dashboard</AdminNavLink>
            <AdminNavLink to="/admin/users">Users</AdminNavLink>
            <AdminNavLink to="/admin/websites">Generated Websites</AdminNavLink>
            <AdminNavLink to="/admin/contacts">Contacts</AdminNavLink>
          </nav>
        </div>
        <div style={styles.sidebarFoot}>
          <Link to="/" style={styles.sidebarSecondaryLink}>Open main app</Link>
        </div>
      </aside>

      <div style={styles.mainShell}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.topbarEyebrow}>{eyebrow || 'Separate Admin Dashboard'}</div>
            <h1 style={styles.topbarTitle}>{title}</h1>
          </div>
          <div style={styles.topbarActions}>
            {actions}
            <button onClick={handleLogout} style={styles.primaryButton}>Sign out</button>
          </div>
        </header>

        <main style={styles.content}>{children}</main>
      </div>
    </div>
  );
}

function AdminNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.sidebarLink,
        ...(isActive ? styles.sidebarLinkActive : null),
      })}
    >
      {children}
    </NavLink>
  );
}

export const adminStyles = {
  eyebrow: {
    color: '#7dd3fc',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 12,
  },
  heroTitle: {
    margin: 0,
    fontSize: 'clamp(32px, 5vw, 58px)',
    lineHeight: 0.98,
    letterSpacing: '-0.05em',
    color: '#f8fafc',
  },
  heroSubtitle: {
    maxWidth: 780,
    color: '#94a3b8',
    fontSize: 16,
    lineHeight: 1.6,
    marginTop: 14,
  },
  errorCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    background: 'rgba(127, 29, 29, 0.45)',
    border: '1px solid rgba(248, 113, 113, 0.34)',
    color: '#fecaca',
  },
  loadingCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    color: '#e2e8f0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 16,
    margin: '24px 0',
  },
  statCard: {
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(17, 24, 39, 0.95))',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: 20,
    padding: 20,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    marginBottom: 14,
  },
  statValue: {
    fontSize: 34,
    color: '#f8fafc',
    fontWeight: 800,
    letterSpacing: '-0.04em',
  },
  statNote: {
    marginTop: 10,
    color: '#cbd5e1',
    fontSize: 13,
  },
  tableSection: {
    marginTop: 24,
    background: 'rgba(15, 23, 42, 0.84)',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
  },
  tableSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  tableSectionTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: '-0.03em',
  },
  tableSectionMeta: {
    fontSize: 13,
    color: '#94a3b8',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: 900,
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    fontSize: 12,
    color: '#7dd3fc',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
  },
  td: {
    padding: '12px 10px',
    fontSize: 14,
    color: '#e2e8f0',
    verticalAlign: 'top',
    borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
  },
  emptyCell: {
    padding: 18,
    textAlign: 'center',
    color: '#94a3b8',
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
};

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '260px minmax(0, 1fr)',
    background: '#08111f',
    color: '#e2e8f0',
  },
  sidebar: {
    background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
    borderRight: '1px solid rgba(148, 163, 184, 0.14)',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 20,
  },
  brand: {
    display: 'inline-block',
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: '#f8fafc',
    marginBottom: 28,
    textDecoration: 'none',
  },
  sidebarCaption: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    marginBottom: 12,
  },
  sidebarNav: {
    display: 'grid',
    gap: 10,
  },
  sidebarLink: {
    padding: '12px 14px',
    borderRadius: 14,
    textDecoration: 'none',
    color: '#cbd5e1',
    background: 'rgba(15, 23, 42, 0.75)',
  },
  sidebarLinkActive: {
    background: 'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(124,58,237,0.24))',
    border: '1px solid rgba(125, 211, 252, 0.16)',
    color: '#f8fafc',
  },
  sidebarFoot: {
    paddingTop: 16,
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
  },
  sidebarSecondaryLink: {
    color: '#7dd3fc',
    textDecoration: 'none',
    fontSize: 14,
  },
  mainShell: {
    minWidth: 0,
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    padding: '22px 28px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
    background: 'rgba(2, 6, 23, 0.86)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backdropFilter: 'blur(12px)',
  },
  topbarEyebrow: {
    color: '#7dd3fc',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  topbarTitle: {
    margin: '6px 0 0',
    fontSize: 28,
    letterSpacing: '-0.03em',
  },
  topbarActions: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    border: 'none',
    borderRadius: 12,
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  content: {
    padding: 28,
  },
};
