import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout, { adminStyles } from '../../components/AdminLayout';
import { STAGE_ORDER, StageBadge, fmtDate } from './pipelineShared';
import RunDiscoveryModal from './RunDiscoveryModal';

const API = '/api/app/leadgen';

export default function LeadsPipeline() {
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({ total: 0, byStatus: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [nicheFilter, setNicheFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, sumRes] = await Promise.all([
        fetch(`${API}/leads?limit=500`, { credentials: 'include' }),
        fetch('/api/app/pipeline/summary', { credentials: 'include' }),
      ]);
      if (!leadsRes.ok) throw new Error(`leads ${leadsRes.status}`);
      setLeads(await leadsRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (err) {
      setError(err.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function closeLead(id, name) {
    const reason = window.prompt(`Close lead "${name}"? Optional reason:`, '');
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/leads/${id}/close`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(`Close failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function toggleSel(id) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function bulk(action) {
    const ids = [...selected];
    if (!ids.length) return;
    let body = { ids };
    if (action === 'close') {
      const reason = window.prompt(`Close ${ids.length} leads? Optional reason:`, '');
      if (reason === null) return;
      body.reason = reason;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/leads/bulk/${action}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      const j = await res.json();
      setSelected(new Set());
      await load();
      if (action === 'audit') alert(`Queued ${j.queued} leads for re-audit. Refresh to watch progress.`);
    } catch (err) {
      alert(`Bulk ${action} failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const countries = useMemo(
    () => [...new Set(leads.map((l) => l.country).filter(Boolean))].sort(),
    [leads]
  );
  const nicheOpts = useMemo(
    () => [...new Set(leads.map((l) => l.niche_name).filter(Boolean))].sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (countryFilter !== 'all' && l.country !== countryFilter) return false;
      if (nicheFilter !== 'all' && (l.niche_name || '—') !== nicheFilter) return false;
      if (s && !(l.name || '').toLowerCase().includes(s) && !(l.website || '').toLowerCase().includes(s)) return false;
      return true;
    });
  }, [leads, statusFilter, countryFilter, nicheFilter, search]);

  const stageCounts = summary.byStatus || {};
  const orderedStages = STAGE_ORDER.filter((s) => stageCounts[s]);

  return (
    <AdminLayout
      title="Leads Pipeline"
      eyebrow="Agency Pipeline"
      actions={
        <>
          <button onClick={() => setShowDiscovery(true)} style={btn.primary}>Run discovery</button>
          <button onClick={load} disabled={loading} style={btn.secondary}>Refresh</button>
        </>
      }
    >
      {showDiscovery ? (
        <RunDiscoveryModal
          onClose={() => setShowDiscovery(false)}
          onStarted={(n) => alert(`Discovery started for "${n?.name || 'niche'}". Refresh in a minute.`)}
        />
      ) : null}
      {error ? <div style={adminStyles.errorCard}>{error}</div> : null}

      <div style={stageStrip}>
        {orderedStages.length === 0 && !loading ? (
          <div style={{ color: '#94a3b8' }}>No leads yet — run discovery to begin.</div>
        ) : null}
        {orderedStages.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            style={{
              ...stageChip,
              ...(statusFilter === s ? stageChipActive : null),
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 800 }}>{stageCounts[s]}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{s}</span>
          </button>
        ))}
        <div style={{ ...stageChip, cursor: 'default' }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{summary.total || 0}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>total</span>
        </div>
      </div>

      <div style={filterRow}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={select}>
          <option value="all">All stages</option>
          {STAGE_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} style={select}>
          <option value="all">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} style={select}>
          <option value="all">All niches</option>
          {nicheOpts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input
          placeholder="Search name or website…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...select, minWidth: 240 }}
        />
        <span style={{ color: '#94a3b8', fontSize: 13, alignSelf: 'center' }}>
          {filtered.length} shown
        </span>
      </div>

      {selected.size > 0 ? (
        <div style={bulkBar}>
          <strong>{selected.size} selected</strong>
          <button onClick={() => bulk('audit')} disabled={busy} style={btn.primary}>Run audit</button>
          <button onClick={() => bulk('close')} disabled={busy} style={btn.tinyDanger}>Close</button>
          <button onClick={() => setSelected(new Set())} style={btn.tinySecondary}>Clear</button>
        </div>
      ) : null}

      <section style={adminStyles.tableSection}>
        <div style={adminStyles.tableWrap}>
          <table style={adminStyles.table}>
            <thead>
              <tr>
                <th style={adminStyles.th}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((l) => selected.has(l.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())}
                  />
                </th>
                {['Business', 'Niche', 'Location', 'Category', 'Score', 'Stage', 'Value', 'Contact', 'Updated', ''].map((c) => (
                  <th key={c} style={adminStyles.th}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td style={adminStyles.emptyCell} colSpan={11}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td style={adminStyles.emptyCell} colSpan={11}>No leads match.</td></tr>
              ) : filtered.map((l) => (
                <tr key={l.id} style={selected.has(l.id) ? { background: 'rgba(37,99,235,0.12)' } : null}>
                  <td style={adminStyles.td}>
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} />
                  </td>
                  <td style={adminStyles.td}>
                    <Link to={`/admin/leads/${l.id}`} style={link}>{l.name || '—'}</Link>
                    {l.website ? <div style={sub}>{l.website.replace(/^https?:\/\//, '')}</div> : <div style={sub}>no website</div>}
                  </td>
                  <td style={adminStyles.td}>{l.niche_name || '—'}</td>
                  <td style={adminStyles.td}>{[l.city, l.country].filter(Boolean).join(', ') || '—'}</td>
                  <td style={adminStyles.td}>{l.category || '—'}</td>
                  <td style={adminStyles.td}>{l.audit_score ?? '—'}</td>
                  <td style={adminStyles.td}><StageBadge status={l.status} /></td>
                  <td style={adminStyles.td}>{l.qualify_value_usd ? `$${l.qualify_value_usd}` : '—'}</td>
                  <td style={adminStyles.td}>
                    {l.contact_email || l.phone || '—'}
                  </td>
                  <td style={adminStyles.td}>{fmtDate(l.updated_at)}</td>
                  <td style={adminStyles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/admin/leads/${l.id}`} style={btn.tinySecondary}>View</Link>
                      {l.status !== 'closed' ? (
                        <button onClick={() => closeLead(l.id, l.name)} disabled={busy} style={btn.tinyDanger}>Close</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}

const bulkBar = { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', margin: '10px 0', borderRadius: 12, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(125,211,252,0.3)', color: '#e2e8f0' };
const stageStrip = { display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 8px' };
const stageChip = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.14)', color: '#e2e8f0',
};
const stageChipActive = { border: '1px solid #7dd3fc', background: 'rgba(37,99,235,0.18)' };
const filterRow = { display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' };
const select = {
  padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.9)',
  border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 14,
};
const link = { color: '#7dd3fc', textDecoration: 'none', fontWeight: 600 };
const sub = { color: '#64748b', fontSize: 12, marginTop: 2 };
const btn = {
  primary: { border: 'none', borderRadius: 12, padding: '12px 16px', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700 },
  secondary: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 16px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 },
  tinySecondary: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '6px 10px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', textDecoration: 'none', fontSize: 12 },
  tinyDanger: { border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '6px 10px', background: 'rgba(127,29,29,0.35)', color: '#fecaca', cursor: 'pointer', fontSize: 12 },
};
