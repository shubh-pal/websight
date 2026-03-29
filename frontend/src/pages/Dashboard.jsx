import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    fetch('/api/jobs?userId=me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setJobs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Compute stats
  const totalJobs = jobs.length;
  const thisMonthJobs = jobs.filter(j => {
    const jobDate = new Date(j.createdAt);
    const now = new Date();
    return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
  }).length;

  const modelCounts = {};
  jobs.forEach(j => {
    const modelName = j.model?.replace(/^(gemini-|claude-|gpt-|llama-|groq-|deepseek-)/, '') || 'unknown';
    modelCounts[modelName] = (modelCounts[modelName] || 0) + 1;
  });
  const mostUsedModel = Object.keys(modelCounts).reduce((a, b) =>
    modelCounts[a] > modelCounts[b] ? a : b, 'N/A');

  const frameworkCounts = { react: 0, angular: 0 };
  jobs.forEach(j => {
    if (j.framework === 'react') frameworkCounts.react++;
    else if (j.framework === 'angular') frameworkCounts.angular++;
  });

  // Filter jobs
  const filteredJobs = jobs.filter(j => {
    const matchesSearch = j.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         j.projectName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const freeJobsUsed = thisMonthJobs;
  const freeJobsTotal = 3;
  const isFreeUser = user?.plan === 'free' || user?.plan === 'FREE';

  return (
    <div style={styles.root}>
      <Navbar />
      <div style={styles.container}>
        {/* Page Header */}
        <div style={styles.header}>
          <h1 style={styles.heading}>Your Projects</h1>
          <Link to="/" style={styles.newProjectBtn}>
            <span>New Project</span>
            <span>→</span>
          </Link>
        </div>

        {/* Stats Strip */}
        <div style={styles.statsStrip}>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{totalJobs}</div>
            <div style={styles.statLabel}>Total Projects</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{thisMonthJobs}</div>
            <div style={styles.statLabel}>This Month</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{mostUsedModel}</div>
            <div style={styles.statLabel}>Favorite Model</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{frameworkCounts.react}R / {frameworkCounts.angular}A</div>
            <div style={styles.statLabel}>Frameworks</div>
          </div>
        </div>

        {/* Free Plan Usage Quota */}
        {isFreeUser && (
          <div style={styles.quotaBox}>
            <div style={styles.quotaContent}>
              <div style={styles.quotaText}>
                {freeJobsUsed} of {freeJobsTotal} free jobs used this month
              </div>
              <div style={styles.quotaBarContainer}>
                <div style={{
                  ...styles.quotaBar,
                  width: `${(freeJobsUsed / freeJobsTotal) * 100}%`,
                  background: freeJobsUsed >= freeJobsTotal ? 'var(--red)' : 'var(--violet)',
                }} />
              </div>
            </div>
            <Link to="/pricing" style={styles.upgradeLink}>
              Upgrade to Pro →
            </Link>
          </div>
        )}

        {/* Search and Filters */}
        <div style={styles.filterSection}>
          <input
            type="text"
            placeholder="Search by URL or project name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          <div style={styles.filterChips}>
            {['All', 'done', 'processing', 'failed'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  ...styles.filterChip,
                  ...(statusFilter === status ? styles.filterChipActive : styles.filterChipInactive)
                }}
              >
                {status === 'done' ? '✓ Done' :
                 status === 'processing' ? '⟳ Processing' :
                 status === 'failed' ? '✗ Failed' :
                 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid or Empty State */}
        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading projects...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📦</div>
            <h2 style={styles.emptyTitle}>No projects yet</h2>
            <p style={styles.emptyDesc}>Paste a URL to get started</p>
            <Link to="/" style={styles.emptyButton}>Create Your First Project</Link>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredJobs.map(job => (
              <Link key={job.id} to={`/result/${job.id}`} style={styles.projectCard}>
                <div style={styles.cardTop}>
                  <div style={styles.urlSection}>
                    <div style={styles.url} title={job.url}>
                      {job.url || job.projectName || 'Untitled'}
                    </div>
                    {job.projectName && <div style={styles.projectName}>{job.projectName}</div>}
                  </div>
                </div>

                {/* Color Tokens */}
                {job.tokens && (
                  <div style={styles.tokenRow}>
                    {[job.tokens.primaryColor, job.tokens.secondaryColor, job.tokens.accentColor].map((color, idx) => (
                      color ? (
                        <div
                          key={idx}
                          style={{
                            ...styles.colorDot,
                            backgroundColor: color,
                          }}
                          title={color}
                        />
                      ) : null
                    ))}
                  </div>
                )}

                {/* Framework & Model Badge Row */}
                <div style={styles.badgeRow}>
                  <span style={styles.badge}>
                    {job.framework === 'react' ? '⚛' : '🅰'} {job.framework === 'react' ? 'React' : 'Angular'}
                  </span>
                  <span style={{
                    ...styles.badge,
                    ...styles.modelBadge
                  }}>
                    {job.model?.replace(/^(gemini-|claude-|gpt-|llama-|groq-|deepseek-)/, '') || job.model}
                  </span>
                </div>

                {/* Status & Timestamp */}
                <div style={styles.cardBottom}>
                  <span style={{
                    ...styles.statusChip,
                    ...(job.status === 'done' ? styles.statusDone :
                        job.status === 'processing' ? styles.statusProcessing :
                        styles.statusFailed)
                  }}>
                    {job.status === 'done' ? '✓ Done' :
                     job.status === 'processing' ? '⟳ Processing' :
                     '✗ Failed'}
                  </span>
                  <span style={styles.timestamp}>
                    {formatRelativeTime(job.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '40px 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(28px, 4vw, 42px)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  newProjectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: 'var(--violet)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  statBox: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--violet)',
    marginBottom: 6,
    fontFamily: 'var(--font-display)',
  },
  statLabel: {
    fontSize: 12,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  quotaBox: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 16,
  },
  quotaContent: {
    flex: 1,
  },
  quotaText: {
    fontSize: 13,
    color: 'var(--text-2)',
    marginBottom: 8,
    fontFamily: 'var(--font-mono)',
  },
  quotaBarContainer: {
    width: '100%',
    height: 6,
    background: 'var(--bg-3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  quotaBar: {
    height: '100%',
    borderRadius: 3,
    transition: 'all 0.3s',
  },
  upgradeLink: {
    fontSize: 13,
    color: 'var(--violet-bright)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    fontWeight: 600,
    transition: 'all 0.2s',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
  },
  filterSection: {
    marginBottom: 28,
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'var(--font-display)',
    marginBottom: 12,
    outline: 'none',
    transition: 'all 0.2s',
  },
  filterChips: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    padding: '8px 16px',
    border: '1px solid',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'transparent',
    fontFamily: 'var(--font-display)',
  },
  filterChipInactive: {
    borderColor: 'var(--border)',
    color: 'var(--text-2)',
  },
  filterChipActive: {
    borderColor: 'var(--violet)',
    color: 'var(--violet-bright)',
    background: 'rgba(124,106,247,0.1)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  projectCard: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  urlSection: {
    flex: 1,
    minWidth: 0,
  },
  url: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: 2,
    fontFamily: 'var(--font-mono)',
  },
  projectName: {
    fontSize: 11,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
  tokenRow: {
    display: 'flex',
    gap: 6,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  badgeRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--bg-3)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
  },
  modelBadge: {
    color: 'var(--cyan)',
    background: 'rgba(0,212,232,0.08)',
    borderColor: 'rgba(0,212,232,0.2)',
  },
  cardBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
  },
  statusChip: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 6,
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
  },
  statusDone: {
    background: 'rgba(30,245,160,0.1)',
    color: 'var(--green)',
  },
  statusProcessing: {
    background: 'rgba(168,151,255,0.1)',
    color: 'var(--violet-bright)',
  },
  statusFailed: {
    background: 'rgba(255,77,106,0.1)',
    color: 'var(--red)',
  },
  timestamp: {
    fontSize: 11,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    gap: 16,
  },
  spinner: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: 'var(--violet)',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: 14,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    gap: 16,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    fontFamily: 'var(--font-display)',
  },
  emptyDesc: {
    fontSize: 15,
    color: 'var(--text-2)',
    marginBottom: 12,
    fontFamily: 'var(--font-display)',
  },
  emptyButton: {
    padding: '12px 24px',
    background: 'var(--violet)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
};
