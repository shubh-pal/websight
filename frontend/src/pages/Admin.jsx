import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function truncate(value, max = 90) {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function StatCard({ label, value, note }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value ?? 0}</div>
      <div style={styles.statNote}>{note}</div>
    </div>
  );
}

function TableSection({ title, meta, columns, rows, emptyMessage }) {
  return (
    <section style={styles.tableSection}>
      <div style={styles.tableSectionHeader}>
        <h2 style={styles.tableSectionTitle}>{title}</h2>
        <span style={styles.tableSectionMeta}>{meta}</span>
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} style={styles.td}>{cell}</td>)}
              </tr>
            )) : (
              <tr>
                <td style={styles.emptyCell} colSpan={columns.length}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadOverview() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/overview', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));

      if (res.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }

      if (!res.ok) {
        throw new Error(body.error || 'Failed to load admin overview');
      }

      setData(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function handleLogout() {
    await fetch('/auth/admin/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    navigate('/admin/login', { replace: true });
  }

  const summary = data?.summary || {};

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.brand}>WebSight Admin</div>
          <div style={styles.sidebarCaption}>Operations</div>
          <nav style={styles.sidebarNav}>
            <a href="#overview" style={styles.sidebarLink}>Overview</a>
            <a href="#users" style={styles.sidebarLink}>Users</a>
            <a href="#websites" style={styles.sidebarLink}>Generated Websites</a>
            <a href="#contacts" style={styles.sidebarLink}>Contacts</a>
          </nav>
        </div>
        <div style={styles.sidebarFoot}>
          <Link to="/" style={styles.sidebarSecondaryLink}>Open main app</Link>
        </div>
      </aside>

      <div style={styles.mainShell}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.topbarEyebrow}>Separate Admin Dashboard</div>
            <h1 style={styles.topbarTitle}>Control room</h1>
          </div>
          <div style={styles.topbarActions}>
            <button onClick={loadOverview} style={styles.secondaryButton}>Refresh</button>
            <button onClick={handleLogout} style={styles.primaryButton}>Sign out</button>
          </div>
        </header>

        <main style={styles.content}>
          <section id="overview" style={styles.hero}>
            <div>
              <div style={styles.eyebrow}>Admin Console</div>
              <h2 style={styles.heroTitle}>Platform tracking and account oversight</h2>
              <p style={styles.heroSubtitle}>
                Monitor unique visitors, total accounts, generated websites, contacts, and signup momentum from an isolated admin surface.
              </p>
            </div>
          </section>

          {error ? <div style={styles.errorCard}>{error}</div> : null}

          <section style={styles.statsGrid}>
            <StatCard label="Unique Visitors" value={summary.uniqueVisitors} note={`${summary.totalVisits || 0} total visits`} />
            <StatCard label="Users" value={summary.totalAccounts} note={`${summary.adminAccounts || 0} admin account`} />
            <StatCard label="Signups" value={summary.totalSignups} note={`${summary.signupsLast7Days || 0} in last 7 days`} />
            <StatCard label="Generated Websites" value={summary.totalGeneratedWebsites} note="latest project snapshot" />
            <StatCard label="Contacts" value={summary.totalContacts} note="latest contact submissions" />
            <StatCard label="30-Day Signups" value={summary.signupsLast30Days} note="rolling 30-day count" />
          </section>

          {loading ? <div style={styles.loadingCard}>Loading admin data...</div> : null}

          {!loading && !error ? (
            <>
              <div id="users">
                <TableSection
                  title="Users"
                  meta={`${data?.users?.length || 0} latest user accounts`}
                  columns={['Email', 'Name', 'Plan', 'Auth', 'Role', 'Created']}
                  rows={(data?.users || []).map((account) => ([
                    account.email,
                    account.name || '—',
                    account.plan || 'free',
                    account.auth_method || 'unknown',
                    account.is_admin ? 'admin' : 'user',
                    formatDate(account.created_at),
                  ]))}
                  emptyMessage="No user accounts found."
                />
              </div>

              <div id="websites">
                <TableSection
                  title="Generated Websites"
                  meta={`${data?.jobs?.length || 0} latest generated websites`}
                  columns={['Project', 'Source URL', 'Owner', 'Status', 'Model', 'Created', 'Logs']}
                  rows={(data?.jobs || []).map((job) => ([
                    job.project_name || job.id,
                    truncate(job.url || '—', 70),
                    job.user_email || job.user_name || 'Anonymous',
                    job.status || 'unknown',
                    job.model || '—',
                    formatDate(job.created_at),
                    truncate((job.logs || []).length ? job.logs.map((log) => `${new Date(log.time).toLocaleTimeString()} ${log.message}`).join(' | ') : job.error || 'No runtime logs captured', 140),
                  ]))}
                  emptyMessage="No generated websites found."
                />
              </div>

              <TableSection
                title="Recent Signups"
                meta={`${data?.signups?.length || 0} newest signups`}
                columns={['Email', 'Name', 'Created', 'Plan', 'Auth']}
                rows={(data?.signups || []).map((signup) => ([
                  signup.email,
                  signup.name || '—',
                  formatDate(signup.created_at),
                  signup.plan || 'free',
                  signup.auth_method || 'unknown',
                ]))}
                emptyMessage="No signup records yet."
              />

              <TableSection
                title="Visitors"
                meta={`${data?.visitors?.length || 0} recent unique visitors`}
                columns={['Visitor ID', 'Linked User', 'Visits', 'First Seen', 'Last Seen', 'Latest Path']}
                rows={(data?.visitors || []).map((visitor) => ([
                  truncate(visitor.visitor_id, 18),
                  visitor.linked_email || visitor.linked_name || 'Anonymous',
                  visitor.visit_count,
                  formatDate(visitor.first_seen_at),
                  formatDate(visitor.last_seen_at),
                  visitor.latest_path || '—',
                ]))}
                emptyMessage="No visitor data yet."
              />

              <div id="contacts">
                <TableSection
                  title="Contacts"
                  meta={`${data?.contacts?.length || 0} latest contact submissions`}
                  columns={['Name', 'Email', 'Message', 'Created']}
                  rows={(data?.contacts || []).map((contact) => ([
                    contact.name,
                    contact.email,
                    truncate(contact.message, 120),
                    formatDate(contact.created_at),
                  ]))}
                  emptyMessage="No contact submissions found."
                />
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

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
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: '#f8fafc',
    marginBottom: 28,
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
  secondaryButton: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 12,
    padding: '12px 16px',
    background: '#111827',
    color: '#e2e8f0',
    cursor: 'pointer',
  },
  content: {
    padding: 28,
  },
  hero: {
    marginBottom: 24,
  },
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
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 16,
    marginBottom: 24,
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
};
