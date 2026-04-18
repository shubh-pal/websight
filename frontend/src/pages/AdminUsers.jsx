import AdminLayout, { adminStyles } from '../components/AdminLayout';
import useAdminOverview from '../hooks/useAdminOverview';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminUsers() {
  const { data, loading, error, loadOverview } = useAdminOverview();

  return (
    <AdminLayout
      title="Users"
      actions={<button onClick={loadOverview} style={styles.secondaryButton}>Refresh</button>}
    >
      <div style={adminStyles.eyebrow}>User Accounts</div>
      <h2 style={adminStyles.heroTitle}>All users and signup details</h2>
      <p style={adminStyles.heroSubtitle}>Review account details, auth method, plan, role, and creation timestamps from a dedicated users page.</p>
      {error ? <div style={adminStyles.errorCard}>{error}</div> : null}
      {loading ? <div style={adminStyles.loadingCard}>Loading users...</div> : null}
      {!loading && !error ? (
        <section style={adminStyles.tableSection}>
          <div style={adminStyles.tableSectionHeader}>
            <h2 style={adminStyles.tableSectionTitle}>Users</h2>
            <span style={adminStyles.tableSectionMeta}>{data?.users?.length || 0} latest user accounts</span>
          </div>
          <div style={adminStyles.tableWrap}>
            <table style={adminStyles.table}>
              <thead>
                <tr>
                  {['Email', 'Name', 'Plan', 'Auth', 'Role', 'Created'].map((column) => <th key={column} style={adminStyles.th}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data?.users || []).map((account) => (
                  <tr key={account.id}>
                    <td style={adminStyles.td}>{account.email}</td>
                    <td style={adminStyles.td}>{account.name || '—'}</td>
                    <td style={adminStyles.td}>{account.plan || 'free'}</td>
                    <td style={adminStyles.td}>{account.auth_method || 'unknown'}</td>
                    <td style={adminStyles.td}>{account.is_admin ? 'admin' : 'user'}</td>
                    <td style={adminStyles.td}>{formatDate(account.created_at)}</td>
                  </tr>
                ))}
                {!data?.users?.length ? <tr><td style={adminStyles.emptyCell} colSpan={6}>No user accounts found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
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
};
