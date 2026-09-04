import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout, { adminStyles } from '../../components/AdminLayout';
import { StageBadge } from './pipelineShared';

const API = '/api/app/leadgen';
const TABS = [
  ['waiting_approval', 'Waiting approval'],
  ['audited', 'In review'],
  ['qualifying', 'Qualifying'],
  ['disqualified', 'Disqualified'],
  ['building_pdf', 'Approved'],
];

export default function Qualify() {
  const [tab, setTab] = useState('waiting_approval');
  const [rows, setRows] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetch(`${API}/leads?status=${tab}&limit=200`, { credentials: 'include' }).then((r) => r.json());
      setRows(list);
      const detailEntries = await Promise.all(
        list.slice(0, 40).map((l) =>
          fetch(`${API}/leads/${l.id}`, { credentials: 'include' }).then((r) => r.json()).then((d) => [l.id, d]).catch(() => [l.id, null])
        )
      );
      setDetails(Object.fromEntries(detailEntries));
    } finally {
      setLoading(false);
    }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  async function act(id, path, body) {
    setBusy(id);
    try {
      const res = await fetch(`${API}/leads/${id}/${path}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <AdminLayout title="Qualification" eyebrow="Agency Pipeline"
      actions={<button onClick={load} style={btn.secondary}>Refresh</button>}>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0 18px', flexWrap: 'wrap' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...tabBtn, ...(tab === k ? tabOn : null) }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div style={adminStyles.loadingCard}>Loading…</div>
        : rows.length === 0 ? <div style={adminStyles.loadingCard}>Nothing in “{tab}”.</div>
        : rows.map((l) => (
          <ReviewCard
            key={l.id} lead={l} detail={details[l.id]} busy={busy === l.id}
            onScore={(s) => act(l.id, 'score', { score: s })}
            onApprove={() => act(l.id, 'approve')}
            onReject={() => { const r = window.prompt('Reject reason:', ''); if (r !== null) act(l.id, 'reject', { reason: r }); }}
          />
        ))}
    </AdminLayout>
  );
}

function ReviewCard({ lead, detail, busy, onScore, onApprove, onReject }) {
  const d = detail || {};
  const v = d.lead?.qualify_raw && !d.lead.qualify_raw.error ? d.lead.qualify_raw : null;
  const [score, setScore] = useState(d.effectiveScore ?? lead.audit_score ?? '');
  useEffect(() => { setScore(d.effectiveScore ?? lead.audit_score ?? ''); }, [d.effectiveScore, lead.audit_score]);
  const threshold = d.threshold ?? 30;
  const shot = d.media?.beforeScreenshot;

  return (
    <section style={{ ...adminStyles.tableSection, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          {shot ? <img src={shot} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(148,163,184,0.16)' }} />
            : <div style={{ ...empty, height: 120 }}>no screenshot</div>}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>
              <Link to={`/admin/leads/${lead.id}`} style={{ color: '#7dd3fc', textDecoration: 'none' }}>{lead.name}</Link>
            </h3>
            <StageBadge status={lead.status} />
          </div>
          <div style={sub}>{lead.niche_name || '—'} · {[lead.city, lead.country].filter(Boolean).join(', ')} · {lead.category}</div>
          <div style={sub}>{lead.website || 'no website'} · {lead.contact_email || lead.phone || 'no contact'}</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0' }}>
            <span style={sub}>Score</span>
            <input type="number" value={score} onChange={(e) => setScore(e.target.value)} style={scoreInput} />
            <button onClick={() => onScore(Number(score))} disabled={busy || score === '' || Number(score) === (d.effectiveScore ?? lead.audit_score)} style={btn.mini}>Set</button>
            <span style={sub}>threshold {threshold} · {Number(score) > threshold ? <span style={{ color: '#22c55e' }}>qualifies</span> : <span style={{ color: '#ef4444' }}>below</span>}</span>
            {d.lead?.score_override != null ? <span style={{ ...sub, color: '#eab308' }}>overridden</span> : null}
          </div>

          {v ? (
            <div style={geminiBox}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ color: v.recommendation === 'pursue' ? '#22c55e' : '#ef4444' }}>Gemini: {v.recommendation}</strong>
                <span style={sub}>{Math.round(v.confidence * 100)}% · est ${v.estimated_value_usd}</span>
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1' }}>{v.summary}</div>
              <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 6 }}><em>Angle:</em> {v.pitch_angle}</div>
              {v.red_flags?.length ? <div style={{ ...sub, marginTop: 6, color: '#fca5a5' }}>⚑ {v.red_flags.join(' · ')}</div> : null}
            </div>
          ) : <div style={{ ...sub, margin: '8px 0' }}>{d.lead ? 'Gemini assessment unavailable' : 'loading…'}</div>}

          {lead.audit_reasons ? <div style={{ ...sub, marginTop: 6 }}>Audit: {lead.audit_reasons}</div> : null}
          {d.lead?.disqualify_reason ? <div style={{ ...sub, marginTop: 6, color: '#fca5a5' }}>{d.lead.disqualify_reason}</div> : null}

          {['waiting_approval', 'audited', 'disqualified'].includes(lead.status) ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={onApprove} disabled={busy || lead.status !== 'waiting_approval'} style={btn.approve}>Approve → build PDF</button>
              <button onClick={onReject} disabled={busy || lead.status === 'disqualified'} style={btn.reject}>Reject</button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const sub = { color: '#64748b', fontSize: 12, marginTop: 3 };
const empty = { display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 12, background: 'rgba(2,6,23,0.4)', borderRadius: 8 };
const geminiBox = { background: 'rgba(2,6,23,0.45)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: 10, padding: 12, marginTop: 8 };
const scoreInput = { width: 64, padding: '5px 8px', borderRadius: 8, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.25)', color: '#e2e8f0', fontSize: 13 };
const tabBtn = { padding: '7px 13px', borderRadius: 10, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.2)', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 };
const tabOn = { background: 'rgba(37,99,235,0.22)', border: '1px solid #7dd3fc', color: '#f8fafc' };
const btn = {
  secondary: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '10px 14px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 },
  mini: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '5px 10px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 },
  approve: { border: 'none', borderRadius: 10, padding: '9px 14px', background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  reject: { border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '9px 14px', background: 'rgba(127,29,29,0.4)', color: '#fecaca', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
};
