import { Link } from 'react-router-dom';
import AdminLayout, { adminStyles } from '../components/AdminLayout';
import useAdminOverview from '../hooks/useAdminOverview';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function truncate(value, max = 110) {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export default function AdminWebsites() {
  const { data, loading, error, loadOverview } = useAdminOverview();

  return (
    <AdminLayout
      title="Generated Websites"
      actions={<button onClick={loadOverview} style={styles.secondaryButton}>Refresh</button>}
    >
      <div style={adminStyles.eyebrow}>Generated Projects</div>
      <h2 style={adminStyles.heroTitle}>Inspect generated websites like a user would</h2>
      <p style={adminStyles.heroSubtitle}>Review project history, source URLs, runtime logs, and jump directly into the full result experience with a dedicated View action.</p>
      {error ? <div style={adminStyles.errorCard}>{error}</div> : null}
      {loading ? <div style={adminStyles.loadingCard}>Loading generated websites...</div> : null}
      {!loading && !error ? (
        <section style={adminStyles.tableSection}>
          <div style={adminStyles.tableSectionHeader}>
            <h2 style={adminStyles.tableSectionTitle}>Generated Websites</h2>
            <span style={adminStyles.tableSectionMeta}>{data?.jobs?.length || 0} latest generated websites</span>
          </div>
          <div style={adminStyles.tableWrap}>
            <table style={adminStyles.table}>
              <thead>
                <tr>
                  {['Project', 'Source URL', 'Owner', 'Status', 'Model', 'Created', 'Logs', 'Action'].map((column) => <th key={column} style={adminStyles.th}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data?.jobs || []).map((job) => {
                  const query = new URLSearchParams();
                  if (job.url) query.set('url', job.url);
                  if (job.framework) query.set('fw', job.framework);
                  if (job.model) query.set('model', job.model);
                  const viewPath = `/admin/websites/${job.id}${query.toString() ? `?${query.toString()}` : ''}`;

                  return (
                    <tr key={job.id}>
                      <td style={adminStyles.td}>{job.project_name || job.id}</td>
                      <td style={adminStyles.td}>{truncate(job.url || '—', 70)}</td>
                      <td style={adminStyles.td}>{job.user_email || job.user_name || 'Anonymous'}</td>
                      <td style={adminStyles.td}>{job.status || 'unknown'}</td>
                      <td style={adminStyles.td}>{job.model || '—'}</td>
                      <td style={adminStyles.td}>{formatDate(job.created_at)}</td>
                      <td style={adminStyles.td}>
                        {truncate(
                          (job.logs || []).length
                            ? job.logs.map((log) => `${new Date(log.time).toLocaleTimeString()} ${log.message}`).join(' | ')
                            : job.error || 'No runtime logs captured',
                          140
                        )}
                      </td>
                      <td style={adminStyles.td}>
                        <Link to={viewPath} style={adminStyles.actionButton}>View</Link>
                      </td>
                    </tr>
                  );
                })}
                {!data?.jobs?.length ? <tr><td style={adminStyles.emptyCell} colSpan={8}>No generated websites found.</td></tr> : null}
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
