import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function truncate(value, max = 64) {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/overview', { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || 'Failed to load admin dashboard');
        }
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = data?.summary || {};

  return (
    <div style={styles.page}>
      <Navbar />
      <main style={styles.main}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Admin Console</div>
            <h1 style={styles.title}>Platform tracking and account oversight</h1>
            <p style={styles.subtitle}>
              Monitor unique visitors, account growth, and recent signups from a separate authenticated route.
            </p>
          </div>
        </section>

        {loading ? (
          <div style={styles.stateCard}>Loading admin data...</div>
        ) : error ? (
          <div style={styles.errorCard}>{error}</div>
        ) : (
          <>
            <section style={styles.summaryGrid}>
              <StatCard label="Unique Visitors" value={summary.uniqueVisitors} sublabel={`${summary.totalVisits || 0} total visits`} />
              <StatCard label="Users" value={summary.totalAccounts} sublabel={`${summary.adminAccounts || 0} admin account`} />
              <StatCard label="Total Signups" value={summary.totalSignups} sublabel={`${summary.signupsLast30Days || 0} in last 30 days`} />
              <StatCard label="7-Day Signups" value={summary.signupsLast7Days} sublabel="recent conversion pulse" />
              <StatCard label="Generated Websites" value={summary.totalGeneratedWebsites} sublabel="latest project count snapshot" />
              <StatCard label="Contacts" value={summary.totalContacts} sublabel="latest contact submissions loaded" />
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Visitor Details</h2>
                <span style={styles.sectionMeta}>{data?.visitors?.length || 0} recent unique visitors</span>
              </div>
              <DataTable
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
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Users</h2>
                <span style={styles.sectionMeta}>{data?.users?.length || 0} latest user accounts</span>
              </div>
              <DataTable
                columns={['Email', 'Name', 'Plan', 'Auth', 'Role', 'Created']}
                rows={(data?.users || []).map((account) => ([
                  account.email,
                  account.name || '—',
                  account.plan || 'free',
                  account.auth_method || 'unknown',
                  account.is_admin ? 'admin' : 'user',
                  formatDate(account.created_at),
                ]))}
                emptyMessage="No accounts found."
              />
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Generated Websites</h2>
                <span style={styles.sectionMeta}>{data?.jobs?.length || 0} latest generated websites</span>
              </div>
              <DataTable
                columns={['Project', 'Source URL', 'Owner', 'Status', 'Model', 'Created', 'Logs']}
                rows={(data?.jobs || []).map((job) => ([
                  job.project_name || job.id,
                  job.url || '—',
                  job.user_email || job.user_name || 'Anonymous',
                  job.status || 'unknown',
                  job.model || '—',
                  formatDate(job.created_at),
                  (job.logs || []).length
                    ? job.logs.map((log) => `${new Date(log.time).toLocaleTimeString()} ${log.message}`).join(' | ')
                    : job.error || 'No runtime logs captured',
                ]))}
                emptyMessage="No generated websites found."
              />
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Recent Signups</h2>
                <span style={styles.sectionMeta}>{data?.signups?.length || 0} newest signups</span>
              </div>
              <DataTable
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
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Contacts</h2>
                <span style={styles.sectionMeta}>{data?.contacts?.length || 0} latest contact submissions</span>
              </div>
              <DataTable
                columns={['Name', 'Email', 'Message', 'Created']}
                rows={(data?.contacts || []).map((contact) => ([
                  contact.name,
                  contact.email,
                  truncate(contact.message, 120),
                  formatDate(contact.created_at),
                ]))}
                emptyMessage="No contact submissions found."
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, sublabel }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value ?? 0}</div>
      <div style={styles.statSublabel}>{sublabel}</div>
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} style={styles.th}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} style={styles.td}>{cell}</td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} style={styles.emptyCell}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0b1020 0%, #121932 42%, #0f1324 100%)',
  },
  main: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '32px 24px 56px',
    color: '#f8fafc',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'end',
    gap: 24,
    padding: '8px 0 28px',
  },
  eyebrow: {
    color: '#7dd3fc',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 'clamp(32px, 5vw, 54px)',
    lineHeight: 1,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: '14px 0 0',
    maxWidth: 760,
    color: '#a5b4fc',
    fontSize: 16,
    lineHeight: 1.6,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 24px 80px rgba(2, 6, 23, 0.32)',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: 14,
  },
  statValue: {
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: '#f8fafc',
  },
  statSublabel: {
    marginTop: 10,
    color: '#cbd5e1',
    fontSize: 13,
  },
  section: {
    marginTop: 24,
    background: 'rgba(15, 23, 42, 0.84)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: '-0.03em',
  },
  sectionMeta: {
    color: '#94a3b8',
    fontSize: 13,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 760,
  },
  th: {
    textAlign: 'left',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#7dd3fc',
    padding: '14px 12px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
  },
  td: {
    padding: '14px 12px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
    color: '#e2e8f0',
    fontSize: 14,
    verticalAlign: 'top',
  },
  emptyCell: {
    padding: 18,
    color: '#94a3b8',
    textAlign: 'center',
  },
  stateCard: {
    padding: 20,
    borderRadius: 18,
    background: 'rgba(15, 23, 42, 0.84)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
  },
  errorCard: {
    padding: 20,
    borderRadius: 18,
    background: 'rgba(127, 29, 29, 0.5)',
    border: '1px solid rgba(248, 113, 113, 0.35)',
    color: '#fecaca',
  },
};
