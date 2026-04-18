import AdminLayout, { adminStyles } from '../components/AdminLayout';
import useAdminOverview from '../hooks/useAdminOverview';

function StatCard({ label, value, note }) {
  return (
    <div style={adminStyles.statCard}>
      <div style={adminStyles.statLabel}>{label}</div>
      <div style={adminStyles.statValue}>{value ?? 0}</div>
      <div style={adminStyles.statNote}>{note}</div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function TableSection({ title, meta, columns, rows, emptyMessage }) {
  return (
    <section style={adminStyles.tableSection}>
      <div style={adminStyles.tableSectionHeader}>
        <h2 style={adminStyles.tableSectionTitle}>{title}</h2>
        <span style={adminStyles.tableSectionMeta}>{meta}</span>
      </div>
      <div style={adminStyles.tableWrap}>
        <table style={adminStyles.table}>
          <thead><tr>{columns.map((column) => <th key={column} style={adminStyles.th}>{column}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} style={adminStyles.td}>{cell}</td>)}
              </tr>
            )) : (
              <tr><td style={adminStyles.emptyCell} colSpan={columns.length}>{emptyMessage}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { data, loading, error, loadOverview } = useAdminOverview();
  const summary = data?.summary || {};
  const lookerStudioEmbedUrl = import.meta.env.VITE_LOOKER_STUDIO_EMBED_URL || '';

  return (
    <AdminLayout
      title="Dashboard"
      actions={<button onClick={loadOverview} style={styles.secondaryButton}>Refresh</button>}
    >
      <div style={adminStyles.eyebrow}>Admin Console</div>
      <h2 style={adminStyles.heroTitle}>Platform tracking and account oversight</h2>
      <p style={adminStyles.heroSubtitle}>
        Monitor unique visitors, total accounts, generated websites, contacts, and signup momentum from a proper multi-page admin area.
      </p>

      {error ? <div style={adminStyles.errorCard}>{error}</div> : null}

      <section style={adminStyles.statsGrid}>
        <StatCard label="Unique Visitors" value={summary.uniqueVisitors} note={`${summary.totalVisits || 0} total visits`} />
        <StatCard label="Users" value={summary.totalAccounts} note={`${summary.adminAccounts || 0} admin account`} />
        <StatCard label="Signups" value={summary.totalSignups} note={`${summary.signupsLast7Days || 0} in last 7 days`} />
        <StatCard label="Generated Websites" value={summary.totalGeneratedWebsites} note="latest project snapshot" />
        <StatCard label="Contacts" value={summary.totalContacts} note="latest contact submissions" />
        <StatCard label="30-Day Signups" value={summary.signupsLast30Days} note="rolling 30-day count" />
      </section>

      {loading ? <div style={adminStyles.loadingCard}>Loading admin data...</div> : null}

      {!loading && !error ? (
        <>
          {lookerStudioEmbedUrl ? (
            <section style={styles.embedSection}>
              <div style={styles.embedHeader}>
                <div>
                  <div style={adminStyles.eyebrow}>Google Analytics</div>
                  <h3 style={styles.embedTitle}>Looker Studio report</h3>
                  <p style={styles.embedCopy}>
                    Embedded Looker Studio report for Google Analytics.
                  </p>
                </div>
              </div>
              <div style={styles.embedFrameWrap}>
                <iframe
                  title="Looker Studio Analytics"
                  src={lookerStudioEmbedUrl}
                  style={styles.embedFrame}
                  frameBorder="0"
                  allowFullScreen
                />
              </div>
            </section>
          ) : null}

          <TableSection
            title="Visitors"
            meta={`${data?.visitors?.length || 0} recent unique visitors`}
            columns={['Visitor ID', 'Linked User', 'Visits', 'First Seen', 'Last Seen', 'Latest Path']}
            rows={(data?.visitors || []).map((visitor) => ([
              visitor.visitor_id,
              visitor.linked_email || visitor.linked_name || 'Anonymous',
              visitor.visit_count,
              formatDate(visitor.first_seen_at),
              formatDate(visitor.last_seen_at),
              visitor.latest_path || '—',
            ]))}
            emptyMessage="No visitor data yet."
          />

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
        </>
      ) : null}
    </AdminLayout>
  );
}

const styles = {
  secondaryButton: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 12,
    padding: '12px 16px',
    background: '#111827',
    color: '#e2e8f0',
    cursor: 'pointer',
  },
  embedSection: {
    marginTop: 24,
    background: 'rgba(15, 23, 42, 0.84)',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
  },
  embedHeader: {
    marginBottom: 16,
  },
  embedTitle: {
    margin: '0 0 8px',
    fontSize: 24,
    letterSpacing: '-0.03em',
    color: '#f8fafc',
  },
  embedCopy: {
    margin: 0,
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 1.6,
  },
  embedFrameWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    background: '#020617',
  },
  embedFrame: {
    width: '100%',
    minHeight: '820px',
    display: 'block',
    background: '#fff',
  },
};
