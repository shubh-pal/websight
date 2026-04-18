import AdminLayout, { adminStyles } from '../components/AdminLayout';
import useAdminOverview from '../hooks/useAdminOverview';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function truncate(value, max = 120) {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export default function AdminContacts() {
  const { data, loading, error, loadOverview } = useAdminOverview();

  return (
    <AdminLayout
      title="Contacts"
      actions={<button onClick={loadOverview} style={styles.secondaryButton}>Refresh</button>}
    >
      <div style={adminStyles.eyebrow}>Inbound Messages</div>
      <h2 style={adminStyles.heroTitle}>Contact submissions</h2>
      <p style={adminStyles.heroSubtitle}>Review incoming contact requests from a dedicated page instead of mixing them into the dashboard.</p>
      {error ? <div style={adminStyles.errorCard}>{error}</div> : null}
      {loading ? <div style={adminStyles.loadingCard}>Loading contacts...</div> : null}
      {!loading && !error ? (
        <section style={adminStyles.tableSection}>
          <div style={adminStyles.tableSectionHeader}>
            <h2 style={adminStyles.tableSectionTitle}>Contacts</h2>
            <span style={adminStyles.tableSectionMeta}>{data?.contacts?.length || 0} latest contact submissions</span>
          </div>
          <div style={adminStyles.tableWrap}>
            <table style={adminStyles.table}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Message', 'Created'].map((column) => <th key={column} style={adminStyles.th}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data?.contacts || []).map((contact) => (
                  <tr key={contact.id}>
                    <td style={adminStyles.td}>{contact.name}</td>
                    <td style={adminStyles.td}>{contact.email}</td>
                    <td style={adminStyles.td}>{truncate(contact.message, 160)}</td>
                    <td style={adminStyles.td}>{formatDate(contact.created_at)}</td>
                  </tr>
                ))}
                {!data?.contacts?.length ? <tr><td style={adminStyles.emptyCell} colSpan={4}>No contact submissions found.</td></tr> : null}
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
