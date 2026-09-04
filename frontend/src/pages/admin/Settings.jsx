import { useEffect, useState } from 'react';
import AdminLayout, { adminStyles } from '../../components/AdminLayout';

const API = '/api/app/settings';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBust, setLogoBust] = useState(Date.now());

  useEffect(() => {
    fetch(`${API}/company`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/company`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      alert('Saved. Every new pitch PDF will use these details.');
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert('Logo over 4 MB'); return; }
    const dataBase64 = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    const res = await fetch(`${API}/company/logo`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, dataBase64 }),
    });
    if (!res.ok) { alert((await res.json()).error || 'Upload failed'); return; }
    setForm((f0) => ({ ...f0, logo_gcs_key: 'set' }));
    setLogoBust(Date.now());
  }

  if (loading || !form) return <AdminLayout title="Settings"><div style={adminStyles.loadingCard}>Loading…</div></AdminLayout>;

  return (
    <AdminLayout title="Settings" eyebrow="Agency Pipeline">
      <section style={adminStyles.tableSection}>
        <h2 style={adminStyles.tableSectionTitle}>Company profile</h2>
        <p style={{ ...adminStyles.tableSectionMeta, margin: '6px 0 16px' }}>
          Used on every pitch PDF's cover and contact section.
        </p>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 160 }}>
            <div style={logoBox}>
              {form.logo_gcs_key ? (
                <img src={`${API}/company/logo?v=${logoBust}`} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
              ) : <span style={{ color: '#64748b', fontSize: 12 }}>no logo</span>}
            </div>
            <label style={{ ...btn.secondary, display: 'block', textAlign: 'center', marginTop: 8, cursor: 'pointer' }}>
              {form.logo_gcs_key ? 'Replace logo' : 'Upload logo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>

          <div style={{ flex: 1, minWidth: 300, display: 'grid', gap: 10 }}>
            <Field label="Company name"><input value={form.name} onChange={f('name')} style={input} /></Field>
            <Field label="Website"><input value={form.website} onChange={f('website')} style={input} placeholder="https://…" /></Field>
            <Field label="Contact email"><input value={form.contact_email} onChange={f('contact_email')} style={input} /></Field>
            <Field label="Contact phone"><input value={form.contact_phone} onChange={f('contact_phone')} style={input} /></Field>
            <Field label="Portfolio URL"><input value={form.portfolio_url} onChange={f('portfolio_url')} style={input} /></Field>
            <Field label="Tagline (shown on the pricing page)"><input value={form.tagline} onChange={f('tagline')} style={input} /></Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Price min ($)"><input type="number" value={form.price_min} onChange={f('price_min')} style={input} /></Field>
              <Field label="Price max ($)"><input type="number" value={form.price_max} onChange={f('price_max')} style={input} /></Field>
              <Field label="Price per page ($)"><input type="number" value={form.price_per_page} onChange={f('price_per_page')} style={input} /></Field>
              <Field label="Delivery (days)"><input type="number" value={form.delivery_days} onChange={f('delivery_days')} style={input} /></Field>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} style={{ ...btn.primary, marginTop: 18 }}>{saving ? 'Saving…' : 'Save'}</button>
      </section>
    </AdminLayout>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>
      {label}
      {children}
    </label>
  );
}

const logoBox = { width: 160, height: 100, borderRadius: 10, background: '#fff', display: 'grid', placeItems: 'center', border: '1px solid rgba(148,163,184,0.2)', overflow: 'hidden' };
const input = { width: '100%', padding: '9px 11px', borderRadius: 9, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 13, marginTop: 4, boxSizing: 'border-box' };
const btn = {
  primary: { border: 'none', borderRadius: 12, padding: '11px 18px', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700 },
  secondary: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: '8px 12px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', fontSize: 12 },
};
