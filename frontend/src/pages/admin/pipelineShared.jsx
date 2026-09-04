export const STAGE_ORDER = [
  'discovered', 'scraping', 'scraped', 'auditing', 'audited',
  'qualifying', 'waiting_approval', 'disqualified',
  'building_pdf', 'pdf_ready', 'queued_for_mail',
  'contacted', 'replied', 'bounced', 'unsubscribed',
  'closed', 'error',
];

const STAGE_COLOR = {
  discovered: '#64748b', scraping: '#0ea5e9', scraped: '#0ea5e9',
  auditing: '#6366f1', audited: '#6366f1',
  qualifying: '#a855f7', waiting_approval: '#eab308', disqualified: '#ef4444',
  qualified: '#22c55e', rejected: '#ef4444',
  building_pdf: '#f59e0b', pdf_ready: '#14b8a6', queued_for_mail: '#22c55e',
  ready_to_send: '#22c55e', on_hold: '#94a3b8',
  contacted: '#3b82f6', replied: '#22c55e', bounced: '#ef4444', unsubscribed: '#94a3b8',
  closed: '#475569', error: '#ef4444',
};

export function StageBadge({ status }) {
  const c = STAGE_COLOR[status] || '#64748b';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
      color: c, background: `${c}22`, border: `1px solid ${c}55`,
    }}>
      {status}
    </span>
  );
}

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}
