import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AdminLayout, { adminStyles } from '../../components/AdminLayout';
import { StageBadge } from './pipelineShared';

const API = '/api/app/leadgen';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/leads/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function call(method, path, body, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/leads/${id}${path}`, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      await load();
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const action = (p, body, msg) => call('POST', `/${p}`, body, msg);

  function startEdit() {
    const l = data.lead;
    setForm({
      name: l.name || '', website: l.website || '', contact_email: l.contact_email || '',
      phone: l.phone || '', address: l.address || '', category: l.category || '',
    });
    setEditing(true);
  }
  async function saveEdit() {
    if (await call('PATCH', '', form)) setEditing(false);
  }
  async function addNote() {
    const body = noteText.trim();
    if (!body) return;
    if (await call('POST', '/notes', { body })) setNoteText('');
  }

  if (loading) return <AdminLayout title="Lead"><div style={adminStyles.loadingCard}>Loading…</div></AdminLayout>;
  if (error) return <AdminLayout title="Lead"><div style={adminStyles.errorCard}>{error}</div></AdminLayout>;

  const { lead, events, media = {}, notes = [] } = data;
  const sig = lead.audit_signals || {};
  const auditing = ['scraping', 'auditing'].includes(lead.status);

  return (
    <AdminLayout
      title={lead.name || 'Lead'}
      eyebrow="Agency Pipeline"
      actions={
        <>
          <Link to="/admin/leads" style={btn.secondary}>← All leads</Link>
          <button onClick={() => action('audit')} disabled={busy || auditing} style={btn.secondary}>
            {auditing ? 'Auditing…' : 'Run audit'}
          </button>
          {lead.status === 'error' ? <button onClick={() => action('retry')} disabled={busy} style={btn.secondary}>Retry</button> : null}
          {lead.status === 'closed'
            ? <button onClick={() => action('reopen', { to: 'discovered' })} disabled={busy} style={btn.secondary}>Reopen</button>
            : <button onClick={() => { const r = window.prompt('Close reason (optional):', ''); if (r !== null) action('close', { reason: r }); }} disabled={busy} style={btn.danger}>Close lead</button>}
        </>
      }
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '4px 0 20px' }}>
        <StageBadge status={lead.status} />
        {lead.error ? <span style={{ color: '#fca5a5', fontSize: 13 }}>{lead.error_stage}: {lead.error}</span> : null}
        {lead.hold_reason ? <span style={{ color: '#94a3b8', fontSize: 13 }}>closed: {lead.hold_reason}</span> : null}
      </div>

      <div style={grid}>
        <Card title="Business" action={
          editing
            ? <span><button onClick={saveEdit} disabled={busy} style={miniBtn}>Save</button> <button onClick={() => setEditing(false)} style={miniBtn}>Cancel</button></span>
            : <button onClick={startEdit} style={miniBtn}>Edit</button>
        }>
          {editing ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {[['name', 'Name'], ['website', 'Website'], ['contact_email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['category', 'Category']].map(([k, label]) => (
                <label key={k} style={{ fontSize: 12, color: '#94a3b8' }}>
                  {label}
                  <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={editInput} />
                </label>
              ))}
            </div>
          ) : (
            <>
              <Row k="Address" v={lead.address} />
              <Row k="Phone" v={lead.phone_intl || lead.phone} />
              <Row k="Email" v={lead.contact_email} />
              <Row k="Category" v={lead.category} />
              <Row k="Rating" v={lead.rating ? `${lead.rating} (${lead.reviews} reviews)` : '—'} />
              <Row k="Website" v={lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" style={a}>{lead.website}</a> : 'none'} />
              <Row k="Google" v={lead.maps_uri ? <a href={lead.maps_uri} target="_blank" rel="noreferrer" style={a}>Maps listing</a> : '—'} />
            </>
          )}
        </Card>

        <Card title={`Audit — score ${lead.audit_score ?? '—'}/100`}>
          {lead.audit_reasons
            ? <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', fontSize: 13, lineHeight: 1.7 }}>
                {lead.audit_reasons.split('; ').map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            : <div style={{ color: '#94a3b8' }}>not audited yet</div>}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sig.https != null ? <Pill ok={sig.https} label={sig.https ? 'HTTPS' : 'no HTTPS'} /> : null}
            {sig.mobile_viewport != null ? <Pill ok={sig.mobile_viewport} label={sig.mobile_viewport ? 'responsive' : 'not responsive'} /> : null}
            {sig.platform ? <Pill ok={0} label={sig.platform} /> : null}
            {sig.psi_performance != null ? <Pill ok={sig.psi_performance >= 50} label={`perf ${sig.psi_performance}`} /> : null}
            {sig.psi_seo != null ? <Pill ok={sig.psi_seo >= 70} label={`seo ${sig.psi_seo}`} /> : null}
          </div>
        </Card>

        <Card title="Qualification">
          {lead.qualify_decision
            ? <>
                <Row k="Decision" v={<StageBadge status={lead.qualify_decision} />} />
                <Row k="Confidence" v={lead.qualify_confidence != null ? `${Math.round(lead.qualify_confidence * 100)}%` : '—'} />
                <Row k="Est. value" v={lead.qualify_value_usd ? `$${lead.qualify_value_usd}` : '—'} />
                <Row k="Angle" v={lead.qualify_angle} />
                <Row k="By" v={lead.qualified_by} />
              </>
            : <div style={{ color: '#94a3b8' }}>not qualified yet</div>}
        </Card>

        <Card title="Assets">
          {media.beforeScreenshot
            ? <Shot label="Current site" src={media.beforeScreenshot} />
            : <div style={{ color: '#94a3b8' }}>no screenshot {data.media?.error ? `(${data.media.error})` : ''}</div>}
          {media.mockup ? <Shot label="Redesign mockup" src={media.mockup} /> : null}
          {media.proposalPdf ? <a href={media.proposalPdf} target="_blank" rel="noreferrer" style={{ ...btn.secondary, display: 'inline-block', marginTop: 10 }}>Open proposal PDF</a> : null}
          {lead.gcs_prefix ? <div style={{ ...sub, marginTop: 8 }}>GCS: {lead.gcs_prefix}</div> : null}
        </Card>
      </div>

      <Card title={`Notes${notes.length ? ` (${notes.length})` : ''}`}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            style={{ ...editInput, flex: 1, resize: 'vertical' }}
          />
          <button onClick={addNote} disabled={busy || !noteText.trim()} style={btn.secondary}>Add</button>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {notes.map((n) => (
            <li key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.08)', fontSize: 13 }}>
              <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{n.body}</div>
              <div style={{ ...sub, marginTop: 3 }}>
                {n.author || 'admin'} · {new Date(n.created_at).toLocaleString()}
                {' · '}
                <button onClick={() => call('DELETE', `/notes/${n.id}`)} style={{ ...miniBtn, padding: '1px 6px' }}>delete</button>
              </div>
            </li>
          ))}
          {notes.length === 0 ? <li style={{ color: '#94a3b8' }}>no notes yet</li> : null}
        </ul>
      </Card>

      <Card title="Timeline">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {events.map((e) => (
            <li key={e.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.08)', fontSize: 13 }}>
              <span style={{ color: '#64748b', minWidth: 130 }}>{new Date(e.created_at).toLocaleString()}</span>
              <span style={{ color: '#e2e8f0' }}>{e.from_status || '∅'} → <strong>{e.to_status}</strong></span>
              {e.detail ? <span style={{ color: '#94a3b8' }}>{JSON.stringify(e.detail)}</span> : null}
            </li>
          ))}
          {events.length === 0 ? <li style={{ color: '#94a3b8' }}>no events</li> : null}
        </ul>
      </Card>
    </AdminLayout>
  );
}

function Card({ title, children, action }) {
  return (
    <section style={{ ...adminStyles.tableSection, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>{title}</h3>
        {action || null}
      </div>
      {children}
    </section>
  );
}
function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', fontSize: 13 }}>
      <span style={{ color: '#64748b', minWidth: 90 }}>{k}</span>
      <span style={{ color: '#e2e8f0' }}>{v || '—'}</span>
    </div>
  );
}
function Pill({ ok, label }) {
  const c = ok ? '#22c55e' : '#ef4444';
  return <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, color: c, background: `${c}22`, border: `1px solid ${c}44` }}>{label}</span>;
}
function Shot({ label, src }) {
  return (
    <figure style={{ margin: '0 0 14px' }}>
      <figcaption style={{ ...sub, marginBottom: 6 }}>{label}</figcaption>
      <a href={src} target="_blank" rel="noreferrer">
        <img src={src} alt={label} style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(148,163,184,0.16)' }} />
      </a>
    </figure>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 };
const a = { color: '#7dd3fc' };
const sub = { color: '#64748b', fontSize: 12 };
const editInput = { width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.22)', color: '#e2e8f0', fontSize: 13, marginTop: 3, boxSizing: 'border-box' };
const miniBtn = { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '4px 10px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 };
const btn = {
  secondary: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '10px 14px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600, textDecoration: 'none', fontSize: 14 },
  danger: { border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '10px 14px', background: 'rgba(127,29,29,0.4)', color: '#fecaca', cursor: 'pointer', fontWeight: 600 },
};
