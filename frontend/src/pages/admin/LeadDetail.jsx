import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout, { adminStyles } from '../../components/AdminLayout';
import { StageBadge } from './pipelineShared';

const API = '/api/app/leadgen';
const MOCKUP_INELIGIBLE = ['discovered', 'scraping', 'scraped', 'auditing', 'qualifying', 'waiting_approval', 'disqualified', 'closed'];

export default function LeadDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [noteText, setNoteText] = useState('');
  const [lightbox, setLightbox] = useState(null); // { src, label }
  const [showPdf, setShowPdf] = useState(false);

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
    if (confirmMsg && !window.confirm(confirmMsg)) return false;
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
  async function uploadAsset(kind, file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert('File over 8 MB'); return; }
    const dataBase64 = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    await call('POST', '/asset', { kind, filename: file.name, dataBase64 });
  }

  if (loading) return <AdminLayout title="Lead"><div style={adminStyles.loadingCard}>Loading…</div></AdminLayout>;
  if (error) return <AdminLayout title="Lead"><div style={adminStyles.errorCard}>{error}</div></AdminLayout>;

  const { lead, events, media = {}, notes = [], designSystem } = data;
  const sig = lead.audit_signals || {};
  const auditing = ['scraping', 'auditing'].includes(lead.status);
  const ds = designSystem || {};
  const dsColors = ds.colors || {};
  const dsFonts = ds.fonts || {};
  const canUploadMockup = !MOCKUP_INELIGIBLE.includes(lead.status);

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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '4px 0 20px', flexWrap: 'wrap' }}>
        <StageBadge status={lead.status} />
        {lead.error ? <span style={{ color: '#fca5a5', fontSize: 13 }}>{lead.error_stage}: {lead.error}</span> : null}
        {lead.hold_reason ? <span style={{ color: '#94a3b8', fontSize: 13 }}>closed: {lead.hold_reason}</span> : null}
      </div>

      {/* Row 1 — core info */}
      <div style={grid3}>
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
      </div>

      {/* Row 2 — visuals: current site, redesign, brand system */}
      <div style={{ ...grid3, marginTop: 16 }}>
        <Card title="Current site" action={
          <span>
            <UploadBtn label={media.beforeScreenshot ? 'Replace' : 'Upload'} accept="image/*" onFile={(f) => uploadAsset('screenshot', f)} />
            {media.screenshotIsManual ? <button onClick={() => call('DELETE', '/asset/screenshot')} style={miniBtn}>revert</button> : null}
          </span>
        }>
          <Thumb
            src={media.beforeScreenshot} alt="Current site screenshot"
            empty="no screenshot — upload one"
            onClick={() => media.beforeScreenshot && setLightbox({ src: media.beforeScreenshot, label: 'Current site' })}
          />
          {media.beforeScreenshot ? <div style={{ ...sub, marginTop: 6 }}>{media.screenshotIsManual ? 'manual' : 'scraped'} · click to enlarge</div> : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>Logo {!media.logo ? <em style={{ ...tag, color: '#fca5a5', borderColor: '#fca5a5' }}>required</em> : null}</span>
            <span>
              <UploadBtn label={media.logo ? 'Replace' : 'Upload'} accept="image/*" onFile={(f) => uploadAsset('logo', f)} />
              {media.logoIsManual ? <button onClick={() => call('DELETE', '/asset/logo')} style={miniBtn}>revert</button> : null}
            </span>
          </div>
          <Thumb
            src={media.logo} alt="Logo" contain height={90}
            empty={media.logoSourceUrl ? 'found a logo URL but could not mirror it — upload manually' : 'no logo — upload one'}
            onClick={() => media.logo && setLightbox({ src: media.logo, label: 'Logo' })}
          />
        </Card>

        <Card title="Redesign" action={
          canUploadMockup ? (
            <span>
              <UploadBtn label={media.mockup ? 'Replace' : 'Upload'} accept="image/*" onFile={(f) => uploadAsset('mockup', f)} />
            </span>
          ) : null
        }>
          <Thumb
            src={media.mockup} alt="Redesign mockup"
            empty={canUploadMockup ? 'no design yet — upload one, or pull the brief via the design MCP' : 'not approved yet — nothing to upload'}
            onClick={() => media.mockup && setLightbox({ src: media.mockup, label: 'Redesign mockup' })}
          />
          {media.mockup ? <div style={{ ...sub, marginTop: 6 }}>click to enlarge · replacing rebuilds the proposal automatically</div> : null}
        </Card>

        <Card title="Brand system" action={
          media.designSystemJson ? <a href={media.designSystemJson} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none' }}>raw JSON</a> : null
        }>
          {ds.category ? <div style={{ ...sub, marginBottom: 10 }}>{ds.category}</div> : null}
          {Object.keys(dsColors).length ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {Object.entries(dsColors).filter(([, v]) => v).map(([name, hex]) => (
                  <div key={name} title={`${name}: ${hex}`} style={{ textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: hex, border: '1px solid rgba(148,163,184,0.3)' }} />
                    <div style={{ ...sub, fontSize: 10 }}>{name}</div>
                  </div>
                ))}
              </div>
              <div style={sub}>
                Fonts — heading: <strong style={{ color: '#cbd5e1' }}>{dsFonts.heading || '—'}</strong>, body: <strong style={{ color: '#cbd5e1' }}>{dsFonts.body || '—'}</strong>
              </div>
            </>
          ) : <div style={assetEmpty}>{lead.gcs_prefix ? 'design system not parsed' : 'not scraped yet'}</div>}
          {lead.gcs_prefix ? <div style={{ ...sub, marginTop: 14 }}>GCS: {lead.gcs_prefix}</div> : null}
        </Card>
      </div>

      {/* Row 3 — the pitch PDF, its own section */}
      <div style={{ marginTop: 16 }}>
        <Card title="Proposal PDF">
          {media.proposalPdf ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowPdf(true)} style={btn.primary}>Preview</button>
              <a href={media.proposalPdf} target="_blank" rel="noreferrer" style={btn.secondary}>Open in new tab</a>
              <button
                onClick={() => action('rebuild-proposal', null, 'Rebuild the proposal PDF from the current mockup, lead data, and agency settings?')}
                disabled={busy} style={btn.secondary}
              >
                Rebuild
              </button>
              <span style={sub}>reflects the current mockup + agency settings</span>
            </div>
          ) : lead.mockup_gcs_key ? (
            <>
              <p style={{ fontSize: 13.5, marginBottom: 12 }}>A redesign mockup is ready — build the pitch deck whenever you want.</p>
              <button onClick={() => action('rebuild-proposal')} disabled={busy} style={btn.primary}>Build proposal</button>
            </>
          ) : (
            <div style={assetEmpty}>Upload a redesign mockup above first — the proposal builds automatically once one exists.</div>
          )}
        </Card>
      </div>

      {/* Row 4 — notes + timeline side by side */}
      <div style={{ ...grid2, marginTop: 16 }}>
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
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 260, overflowY: 'auto' }}>
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
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 300, overflowY: 'auto' }}>
            {events.map((e) => (
              <li key={e.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.08)', fontSize: 13 }}>
                <span style={{ color: '#64748b', minWidth: 130, flexShrink: 0 }}>{new Date(e.created_at).toLocaleString()}</span>
                <span style={{ color: '#e2e8f0' }}>{e.from_status || '∅'} → <strong>{e.to_status}</strong></span>
                {e.detail ? <span style={{ color: '#94a3b8', fontSize: 12 }}>{JSON.stringify(e.detail)}</span> : null}
              </li>
            ))}
            {events.length === 0 ? <li style={{ color: '#94a3b8' }}>no events</li> : null}
          </ul>
        </Card>
      </div>

      {lightbox ? <Lightbox {...lightbox} onClose={() => setLightbox(null)} /> : null}
      {showPdf && media.proposalPdf ? <PdfModal url={media.proposalPdf} onClose={() => setShowPdf(false)} /> : null}
    </AdminLayout>
  );
}

function Card({ title, children, action }) {
  return (
    <section style={adminStyles.tableSection}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
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
function UploadBtn({ label, accept, onFile }) {
  return (
    <label style={{ ...miniBtn, display: 'inline-block' }}>
      {label}
      <input
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onFile(f); }}
      />
    </label>
  );
}
function Thumb({ src, alt, empty, onClick, contain, height = 170 }) {
  if (!src) return <div style={{ ...assetEmpty, height, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{empty}</div>;
  return (
    <img
      src={src} alt={alt} onClick={onClick}
      style={{
        width: '100%', height, objectFit: contain ? 'contain' : 'cover',
        background: contain ? '#fff' : 'rgba(2,6,23,0.4)', padding: contain ? 8 : 0, boxSizing: 'border-box',
        borderRadius: 10, border: '1px solid rgba(148,163,184,0.16)', display: 'block', cursor: 'zoom-in',
      }}
    />
  );
}
function Lightbox({ src, label, onClose }) {
  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ maxWidth: '92vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        {label ? <div style={{ color: '#e2e8f0', marginBottom: 10, fontSize: 13, textAlign: 'center' }}>{label}</div> : null}
        <img src={src} alt={label} style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 12, display: 'block' }} />
      </div>
    </div>
  );
}
function PdfModal({ url, onClose }) {
  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ width: '90vw', height: '90vh', background: '#1e293b', borderRadius: 14, overflow: 'hidden', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0f172a' }}>
          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Proposal preview</span>
          <span>
            <a href={url} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none', marginRight: 8 }}>Open in new tab</a>
            <button onClick={onClose} style={miniBtn}>Close ✕</button>
          </span>
        </div>
        <iframe src={url} title="Proposal preview" style={{ width: '100%', height: 'calc(100% - 42px)', border: 'none', background: '#fff' }} />
      </div>
    </div>
  );
}

const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 };
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 };
const a = { color: '#7dd3fc' };
const sub = { color: '#64748b', fontSize: 12 };
const editInput = { width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.22)', color: '#e2e8f0', fontSize: 13, marginTop: 3, boxSizing: 'border-box' };
const miniBtn = { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '4px 10px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontSize: 12, marginLeft: 6 };
const assetEmpty = { color: '#94a3b8', fontSize: 12, padding: '10px 12px', background: 'rgba(2,6,23,0.4)', borderRadius: 8 };
const tag = { fontStyle: 'normal', fontSize: 10, padding: '1px 6px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.35)', color: '#94a3b8', marginLeft: 6 };
const backdrop = { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.78)', display: 'grid', placeItems: 'center', zIndex: 60, backdropFilter: 'blur(2px)' };
const btn = {
  primary: { border: 'none', borderRadius: 12, padding: '10px 16px', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  secondary: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '10px 14px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600, textDecoration: 'none', fontSize: 14 },
  danger: { border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '10px 14px', background: 'rgba(127,29,29,0.4)', color: '#fecaca', cursor: 'pointer', fontWeight: 600 },
};
