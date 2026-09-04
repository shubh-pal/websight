import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout, { adminStyles } from '../../components/AdminLayout';

const API = '/api/app/leadgen';
const BLANK = { name: '', search_terms: '', locations: '[\n  { "country": "US", "cities": ["Austin, TX"] }\n]', min_score: '' };

export default function Niches() {
  const [niches, setNiches] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // niche id or 'new'
  const [form, setForm] = useState(BLANK);
  const [sortKey, setSortKey] = useState('leads');
  const [settings, setSettings] = useState(null);
  const [minScore, setMinScore] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, s, cfg] = await Promise.all([
        fetch(`${API}/niches?all=1`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`${API}/niches/stats`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`${API}/settings`, { credentials: 'include' }).then((r) => r.json()),
      ]);
      setNiches(n);
      setStats(Array.isArray(s) ? s : []);
      setSettings(cfg);
      setMinScore(String(cfg.default_min_score ?? 30));
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveMinScore() {
    const res = await fetch(`${API}/settings`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_min_score: Number(minScore) }),
    });
    if (res.ok) { setSettings(await res.json()); alert('Saved'); }
  }
  useEffect(() => { load(); }, [load]);

  const sortedStats = useMemo(() => {
    const rows = [...stats];
    rows.sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1));
    return rows;
  }, [stats, sortKey]);

  function startEdit(n) {
    if (n === 'new') { setForm(BLANK); setEditing('new'); return; }
    setForm({
      name: n.name,
      search_terms: (n.search_terms || []).join(', '),
      locations: JSON.stringify(n.locations || [], null, 2),
      min_score: n.min_score ?? '',
    });
    setEditing(n.id);
  }

  async function save() {
    let locations;
    try { locations = JSON.parse(form.locations); }
    catch { alert('Locations must be valid JSON'); return; }
    const body = {
      name: form.name.trim(),
      search_terms: form.search_terms.split(',').map((s) => s.trim()).filter(Boolean),
      locations,
      min_score: form.min_score === '' ? null : Number(form.min_score),
    };
    if (!body.name || !body.search_terms.length) { alert('Name and at least one search term required'); return; }
    const res = await fetch(
      editing === 'new' ? `${API}/niches` : `${API}/niches/${editing}`,
      { method: editing === 'new' ? 'POST' : 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) { alert((await res.json()).error || 'Save failed'); return; }
    setEditing(null);
    load();
  }

  async function toggleActive(n) {
    await fetch(`${API}/niches/${n.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !n.active }),
    });
    load();
  }

  const cols = [
    ['niche', 'Niche'], ['country', 'Country'], ['leads', 'Leads'], ['audited', 'Audited'],
    ['qualified', 'Qualified'], ['qualified_rate', 'Qual %'], ['avg_score', 'Avg score'],
    ['pipeline_value', 'Pipeline $'], ['contacted', 'Contacted'], ['closed', 'Closed'],
  ];

  return (
    <AdminLayout
      title="Niches"
      eyebrow="Agency Pipeline"
      actions={<button onClick={() => startEdit('new')} style={btn.primary}>+ New niche</button>}
    >
      {error ? <div style={adminStyles.errorCard}>{error}</div> : null}

      <section style={{ ...adminStyles.tableSection, marginTop: 0 }}>
        <h2 style={adminStyles.tableSectionTitle}>Qualification threshold</h2>
        <p style={{ ...adminStyles.tableSectionMeta, margin: '6px 0 12px' }}>
          A lead qualifies for the approval queue when its (effective) opportunity score is <strong>above</strong> this.
          Niches can override it individually.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Global default min score</span>
          <input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} style={{ ...miniSelect, width: 70 }} />
          <button onClick={saveMinScore} style={btn.primary}>Save</button>
        </div>
      </section>

      <section style={adminStyles.tableSection}>
        <div style={adminStyles.tableSectionHeader}>
          <h2 style={adminStyles.tableSectionTitle}>Performance by niche × country</h2>
          <span style={adminStyles.tableSectionMeta}>sort:&nbsp;
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={miniSelect}>
              {cols.slice(2).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </span>
        </div>
        <div style={adminStyles.tableWrap}>
          <table style={adminStyles.table}>
            <thead><tr>{cols.map(([k, l]) => <th key={k} style={adminStyles.th}>{l}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td style={adminStyles.emptyCell} colSpan={cols.length}>Loading…</td></tr>
                : sortedStats.length === 0 ? <tr><td style={adminStyles.emptyCell} colSpan={cols.length}>No leads discovered yet.</td></tr>
                : sortedStats.map((r, i) => (
                  <tr key={i}>
                    <td style={adminStyles.td}>{r.niche}</td>
                    <td style={adminStyles.td}>{r.country || '—'}</td>
                    <td style={{ ...adminStyles.td, fontWeight: 700 }}>{r.leads}</td>
                    <td style={adminStyles.td}>{r.audited}</td>
                    <td style={adminStyles.td}>{r.qualified}</td>
                    <td style={adminStyles.td}>{r.qualified_rate == null ? '—' : `${r.qualified_rate}%`}</td>
                    <td style={adminStyles.td}>{r.avg_score ?? '—'}</td>
                    <td style={adminStyles.td}>{r.pipeline_value ? `$${r.pipeline_value}` : '—'}</td>
                    <td style={adminStyles.td}>{r.contacted}</td>
                    <td style={adminStyles.td}>{r.closed}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...adminStyles.tableSection, marginTop: 20 }}>
        <h2 style={adminStyles.tableSectionTitle}>Niche definitions</h2>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {editing === 'new' ? <NicheForm form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} isNew /> : null}
          {niches.map((n) => editing === n.id ? (
            <NicheForm key={n.id} form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div key={n.id} style={{ ...card, opacity: n.active ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{n.name}</strong>{!n.active ? <span style={sub}> · inactive</span> : null}
                  <div style={{ ...sub, marginTop: 4 }}>{n.search_terms.join(' · ')}</div>
                  <div style={{ ...sub, marginTop: 2 }}>min score: {n.min_score ?? 'global default'}</div>
                  <div style={{ ...sub, marginTop: 2 }}>
                    {(n.locations || []).map((l) => `${l.country}: ${(l.cities || []).length} cities`).join('  |  ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <button onClick={() => startEdit(n)} style={btn.tiny}>Edit</button>
                  <button onClick={() => toggleActive(n)} style={btn.tiny}>{n.active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}

function NicheForm({ form, setForm, onSave, onCancel, isNew }) {
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div style={{ ...card, border: '1px solid #7dd3fc' }}>
      <div style={{ fontSize: 13, color: '#7dd3fc', marginBottom: 8 }}>{isNew ? 'New niche' : 'Edit niche'}</div>
      <input placeholder="Name" value={form.name} onChange={f('name')} style={input} />
      <input placeholder="Search terms, comma separated" value={form.search_terms} onChange={f('search_terms')} style={input} />
      <textarea placeholder="Locations JSON" value={form.locations} onChange={f('locations')} rows={6} style={{ ...input, fontFamily: 'monospace', fontSize: 12 }} />
      <input placeholder="Min score override (blank = use global default)" value={form.min_score} onChange={f('min_score')} style={input} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onSave} style={btn.primary}>Save</button>
        <button onClick={onCancel} style={btn.tiny}>Cancel</button>
      </div>
    </div>
  );
}

const card = { background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: 14, padding: 14 };
const sub = { color: '#64748b', fontSize: 12 };
const input = { width: '100%', padding: '9px 11px', borderRadius: 9, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' };
const miniSelect = { padding: '4px 8px', borderRadius: 8, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 13 };
const btn = {
  primary: { border: 'none', borderRadius: 10, padding: '9px 14px', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  tiny: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '7px 11px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 },
};
