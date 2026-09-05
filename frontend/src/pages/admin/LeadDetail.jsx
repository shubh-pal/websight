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
  const [rebuildState, setRebuildState] = useState('idle'); // 'idle' | 'rebuilding' | 'rebuilt' | 'failed'
  const [showEmail, setShowEmail] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [scoreInput, setScoreInput] = useState('');

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
  useEffect(() => {
    setScoreInput(data?.effectiveScore ?? data?.lead?.audit_score ?? '');
  }, [data?.effectiveScore, data?.lead?.audit_score]);

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

  async function rebuildProposal(confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setRebuildState('rebuilding');
    const ok = await call('POST', '/rebuild-proposal', null);
    setRebuildState(ok ? 'rebuilt' : 'failed');
    setTimeout(() => setRebuildState((s) => (s === 'rebuilding' ? s : 'idle')), 4000);
  }

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

  const { lead, events, media = {}, notes = [], designSystem, threshold, effectiveScore } = data;
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
            : <div style={{ color: '#94a3b8', marginBottom: 10 }}>not qualified yet</div>}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,0.14)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ ...sub, minWidth: 40 }}>Score</span>
              <input type="number" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} style={{ ...editInput, width: 64 }} />
              <button
                onClick={() => action('score', { score: Number(scoreInput) })}
                disabled={busy || scoreInput === '' || Number(scoreInput) === effectiveScore}
                style={miniBtn}
              >
                Set
              </button>
              {threshold != null ? (
                <span style={sub}>
                  threshold {threshold} · {Number(scoreInput) > threshold ? <span style={{ color: '#22c55e' }}>qualifies</span> : <span style={{ color: '#ef4444' }}>below</span>}
                </span>
              ) : null}
              {lead.score_override != null ? <span style={{ ...sub, color: '#eab308' }}>overridden</span> : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => action('approve')} disabled={busy || lead.status !== 'waiting_approval'} style={btn.approve}>
                Approve → queue for UI
              </button>
              <button
                onClick={() => { const r = window.prompt('Reject reason:', ''); if (r !== null) action('reject', { reason: r }); }}
                disabled={busy || lead.status === 'disqualified'} style={btn.danger}
              >
                Reject
              </button>
            </div>
          </div>
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
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>Logo {!media.logo && !media.logoIsRemoved ? <em style={{ ...tag, color: '#fca5a5', borderColor: '#fca5a5' }}>required</em> : null}</span>
            <span>
              <UploadBtn label={media.logo ? 'Replace' : 'Upload'} accept="image/*" onFile={(f) => uploadAsset('logo', f)} />
              {media.logoIsManual ? <button onClick={() => call('DELETE', '/asset/logo')} style={miniBtn}>revert to scraped</button> : null}
              {media.logo ? <button onClick={() => call('POST', '/asset/logo/remove')} style={miniBtn}>remove</button> : null}
            </span>
          </div>
          <Thumb
            src={media.logo} alt="Logo" contain height={90}
            empty={media.logoIsRemoved ? 'removed — this business has no logo' : media.logoSourceUrl ? 'found a logo URL but could not mirror it — upload manually' : 'no logo — upload one'}
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
              <a href={media.proposalPdf} download={`${(lead.name || 'proposal').replace(/[^a-z0-9]+/gi, '-')}-proposal.pdf`} style={btn.secondary}>Download</a>
              <button
                onClick={() => rebuildProposal('Rebuild the proposal PDF from the current mockup, lead data, and agency settings?')}
                disabled={busy || rebuildState === 'rebuilding'} style={btn.secondary}
              >
                Rebuild
              </button>
              <RebuildStatus state={rebuildState} />
              <span style={sub}>reflects the current mockup + agency settings</span>
            </div>
          ) : lead.mockup_gcs_key ? (
            <>
              <p style={{ fontSize: 13.5, marginBottom: 12 }}>A redesign mockup is ready — build the pitch deck whenever you want.</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => rebuildProposal()} disabled={busy || rebuildState === 'rebuilding'} style={btn.primary}>Build proposal</button>
                <RebuildStatus state={rebuildState} />
              </div>
            </>
          ) : (
            <div style={assetEmpty}>Upload a redesign mockup above first — the proposal builds automatically once one exists.</div>
          )}
        </Card>
      </div>

      {/* Row 3b — reach out, once there's a proposal to send */}
      {media.proposalPdf ? (
        <div style={{ marginTop: 16 }}>
          <Card title="Contact">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowCall(true)} disabled={busy} style={btn.primary}>Call</button>
              <button onClick={() => setShowWhatsapp(true)} disabled={busy} style={btn.primary}>WhatsApp</button>
              <button onClick={() => setShowEmail(true)} disabled={busy} style={btn.primary}>Send email</button>
              <span style={sub}>each opens a Gemini-drafted script/message you review before acting</span>
            </div>
          </Card>
        </div>
      ) : null}

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
      {showEmail ? <EmailModal leadId={id} proposalUrl={media.proposalPdf} onClose={() => setShowEmail(false)} onSent={load} /> : null}
      {showCall ? <CallModal leadId={id} onClose={() => setShowCall(false)} onDone={load} /> : null}
      {showWhatsapp ? <WhatsappModal leadId={id} onClose={() => setShowWhatsapp(false)} onDone={load} /> : null}
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
function RebuildStatus({ state }) {
  if (state === 'rebuilding') return <span style={{ fontSize: 12.5, color: '#7dd3fc' }}>Rebuilding…</span>;
  if (state === 'rebuilt') return <span style={{ fontSize: 12.5, color: '#22c55e' }}>Rebuilt ✓</span>;
  if (state === 'failed') return <span style={{ fontSize: 12.5, color: '#fca5a5' }}>Rebuild failed</span>;
  return null;
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

function EmailModal({ leadId, proposalUrl, onClose, onSent }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ to: '', subject: '', body: '' });
  const [canSend, setCanSend] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [sendState, setSendState] = useState('idle'); // idle | sending | sent | failed
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/leads/${leadId}/email-draft`, { credentials: 'include' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setForm({ to: d.to || '', subject: d.subject || '', body: d.body || '' });
        setCanSend(!!d.canSend);
        setAiGenerated(!!d.aiGenerated);
        if (!d.canSend) setError('Email sending is not configured on the server (Zoho SMTP env vars missing).');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  async function send() {
    if (!form.to || !form.subject || !form.body) { setSendError('To, subject, and body are all required.'); return; }
    setSendState('sending');
    setSendError('');
    try {
      const res = await fetch(`${API}/leads/${leadId}/send-email`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setSendState('sent');
      onSent?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setSendState('failed');
      setSendError(err.message);
    }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ width: 920, maxWidth: '94vw', height: '86vh', background: '#1e293b', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0f172a' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Send proposal email</span>
            {aiGenerated ? <span style={aiTag}>Gemini draft</span> : null}
          </span>
          <button onClick={onClose} style={miniBtn}>Close ✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ width: 420, flexShrink: 0, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid rgba(148,163,184,0.14)' }}>
            {loading ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading draft…</div> : error && !canSend ? (
              <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>
            ) : (
              <>
                <label style={fieldLabel}>To</label>
                <input value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} style={fieldInput} placeholder="client@example.com" />
                <label style={fieldLabel}>Subject</label>
                <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} style={fieldInput} />
                <label style={fieldLabel}>Body</label>
                <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} style={{ ...fieldInput, flex: 1, minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }} />
                <div style={{ ...sub, fontSize: 11.5 }}>The proposal PDF (preview on the right) is attached automatically.</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <button onClick={send} disabled={sendState === 'sending' || sendState === 'sent'} style={btn.approve}>
                    {sendState === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                  {sendState === 'sent' ? <span style={{ color: '#22c55e', fontSize: 13 }}>Sent ✓</span> : null}
                  {sendState === 'failed' ? <span style={{ color: '#fca5a5', fontSize: 13 }}>{sendError}</span> : null}
                </div>
              </>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {proposalUrl ? (
              <>
                <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(2,6,23,0.4)' }}>
                  <span style={sub}>Attachment preview</span>
                  <a href={proposalUrl} download style={{ ...miniBtn, textDecoration: 'none' }}>Download PDF</a>
                </div>
                <iframe src={proposalUrl} title="Proposal attachment preview" style={{ flex: 1, border: 'none', background: '#fff' }} />
              </>
            ) : <div style={{ ...assetEmpty, margin: 16 }}>no proposal PDF to preview</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CallModal({ leadId, onClose, onDone }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [script, setScript] = useState('');
  const [phone, setPhone] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [markState, setMarkState] = useState('idle'); // idle | saving | done | failed

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/leads/${leadId}/call-script`, { credentials: 'include' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setScript(d.script || '');
        setPhone(d.phone || '');
        setAiGenerated(!!d.aiGenerated);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  async function copyScript() {
    try { await navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (_) { /* clipboard denied — nothing to fall back to here */ }
  }

  async function markCalled() {
    setMarkState('saving');
    try {
      const res = await fetch(`${API}/leads/${leadId}/mark-contacted`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'call', note: notes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setMarkState('done');
      onDone?.();
      setTimeout(onClose, 900);
    } catch (err) {
      setMarkState('failed');
      setError(err.message);
    }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ width: 560, maxWidth: '92vw', maxHeight: '90vh', background: '#1e293b', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0f172a' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Call script</span>
            {aiGenerated ? <span style={aiTag}>Gemini draft</span> : null}
          </span>
          <button onClick={onClose} style={miniBtn}>Close ✕</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading script…</div> : (
            <>
              {phone ? <div style={sub}>Dial: <strong style={{ color: '#e2e8f0' }}>{phone}</strong></div> : <div style={{ ...sub, color: '#fca5a5' }}>no phone number on file</div>}
              <label style={fieldLabel}>Script</label>
              <textarea value={script} onChange={(e) => setScript(e.target.value)} style={{ ...fieldInput, height: 160, resize: 'vertical', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={copyScript} style={btn.secondary}>{copied ? 'Copied ✓' : 'Copy script'}</button>
              </div>
              <label style={fieldLabel}>Notes from the call</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did they say? Any objections, follow-up date, etc." style={{ ...fieldInput, height: 90, resize: 'vertical', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                <button onClick={markCalled} disabled={markState === 'saving' || markState === 'done'} style={btn.approve}>
                  {markState === 'saving' ? 'Saving…' : 'Mark as called'}
                </button>
                {markState === 'done' ? <span style={{ color: '#22c55e', fontSize: 13 }}>Saved ✓</span> : null}
                {markState === 'failed' ? <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WhatsappModal({ leadId, onClose, onDone }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [markState, setMarkState] = useState('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/leads/${leadId}/whatsapp-draft`, { credentials: 'include' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setMessage(d.message || '');
        setPhone(d.phone || '');
        setAiGenerated(!!d.aiGenerated);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  async function copyMessage() {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (_) { /* clipboard denied */ }
  }

  async function markSent() {
    setMarkState('saving');
    try {
      const res = await fetch(`${API}/leads/${leadId}/mark-contacted`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'whatsapp' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setMarkState('done');
      onDone?.();
      setTimeout(onClose, 900);
    } catch (err) {
      setMarkState('failed');
      setError(err.message);
    }
  }

  const digits = phone.replace(/[^\d]/g, '');
  const waUrl = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ width: 520, maxWidth: '92vw', maxHeight: '90vh', background: '#1e293b', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0f172a' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>WhatsApp message</span>
            {aiGenerated ? <span style={aiTag}>Gemini draft</span> : null}
          </span>
          <button onClick={onClose} style={miniBtn}>Close ✕</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading draft…</div> : (
            <>
              {phone ? <div style={sub}>To: <strong style={{ color: '#e2e8f0' }}>{phone}</strong></div> : <div style={{ ...sub, color: '#fca5a5' }}>no phone number on file — copy the message and send it manually</div>}
              <label style={fieldLabel}>Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...fieldInput, height: 130, resize: 'vertical', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={copyMessage} style={btn.secondary}>{copied ? 'Copied ✓' : 'Copy message'}</button>
                {waUrl ? <a href={waUrl} target="_blank" rel="noreferrer" style={{ ...btn.primary, textDecoration: 'none' }}>Open in WhatsApp</a> : null}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                <button onClick={markSent} disabled={markState === 'saving' || markState === 'done'} style={btn.approve}>
                  {markState === 'saving' ? 'Saving…' : 'Mark as sent'}
                </button>
                {markState === 'done' ? <span style={{ color: '#22c55e', fontSize: 13 }}>Saved ✓</span> : null}
                {markState === 'failed' ? <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
const fieldLabel = { color: '#94a3b8', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' };
const fieldInput = { padding: '9px 11px', borderRadius: 9, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.25)', color: '#e2e8f0', fontSize: 13.5, boxSizing: 'border-box' };
const aiTag = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', color: '#c4b5fd', background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 999, padding: '2px 8px' };

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
  approve: { border: 'none', borderRadius: 12, padding: '10px 16px', background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
};
