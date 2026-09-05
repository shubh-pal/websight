import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api/app/leadgen';

export default function AddLeadModal({ onClose }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('place'); // 'place' | 'website'
  const [niches, setNiches] = useState([]);
  const [nicheId, setNicheId] = useState('');

  // place-search mode
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searchErr, setSearchErr] = useState('');

  // website mode
  const [website, setWebsite] = useState('');
  const [name, setName] = useState('');

  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');

  useEffect(() => {
    fetch(`${API}/niches`, { credentials: 'include' }).then((r) => r.json()).then(setNiches).catch(() => {});
  }, []);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchErr('');
    setResults(null);
    try {
      const res = await fetch(`${API}/leads/manual/search-places`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), country: country.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setResults(d.results || []);
    } catch (err) {
      setSearchErr(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function addLead(body) {
    setAdding(true);
    setAddErr('');
    try {
      const res = await fetch(`${API}/leads/manual`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, nicheId: nicheId || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      navigate(`/admin/leads/${d.id}`);
    } catch (err) {
      setAddErr(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Add lead</span>
          <button onClick={onClose} style={miniBtn}>Close ✕</button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode('place')} style={{ ...tabBtn, ...(mode === 'place' ? tabOn : null) }}>Search Google Business</button>
            <button onClick={() => setMode('website')} style={{ ...tabBtn, ...(mode === 'website' ? tabOn : null) }}>Paste website URL</button>
          </div>

          {niches.length ? (
            <div>
              <label style={label}>Niche (optional)</label>
              <select value={nicheId} onChange={(e) => setNicheId(e.target.value)} style={input}>
                <option value="">No niche</option>
                {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          ) : null}

          {mode === 'place' ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="Business name, e.g. Omega Law Group Denver"
                  style={{ ...input, flex: 1 }}
                />
                <input
                  value={country} onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country (optional)"
                  style={{ ...input, width: 140 }}
                />
                <button onClick={search} disabled={searching || !query.trim()} style={btn.primary}>
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
              {searchErr ? <div style={errText}>{searchErr}</div> : null}
              {results ? (
                results.length === 0 ? (
                  <div style={sub}>No matches — try a more specific name or add "city".</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {results.map((r) => (
                      <div key={r.place_id} style={resultRow}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13.5 }}>{r.name}</div>
                          <div style={sub}>{r.address || '—'}</div>
                          <div style={sub}>{r.website ? r.website.replace(/^https?:\/\//, '') : 'no website'} {r.rating ? `· ${r.rating}★ (${r.reviews || 0})` : ''}</div>
                        </div>
                        <button onClick={() => addLead({ source: 'place', place: r })} disabled={adding} style={btn.secondary}>Add</button>
                      </div>
                    ))}
                  </div>
                )
              ) : null}
            </>
          ) : (
            <>
              <div>
                <label style={label}>Website URL</label>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" style={input} />
              </div>
              <div>
                <label style={label}>Business name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to the domain name" style={input} />
              </div>
              <button
                onClick={() => addLead({ source: 'website', website: website.trim(), name: name.trim() })}
                disabled={adding || !website.trim()} style={btn.primary}
              >
                {adding ? 'Adding…' : 'Add lead'}
              </button>
            </>
          )}
          {addErr ? <div style={errText}>{addErr}</div> : null}
        </div>
      </div>
    </div>
  );
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { width: 640, maxWidth: '92vw', maxHeight: '88vh', background: '#1e293b', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#0f172a' };
const miniBtn = { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '5px 10px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 };
const label = { display: 'block', color: '#94a3b8', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };
const input = { width: '100%', padding: '9px 11px', borderRadius: 9, background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.25)', color: '#e2e8f0', fontSize: 13.5, boxSizing: 'border-box' };
const sub = { color: '#64748b', fontSize: 12, marginTop: 2 };
const errText = { color: '#fca5a5', fontSize: 13 };
const tabBtn = { padding: '7px 13px', borderRadius: 10, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.2)', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 };
const tabOn = { background: 'rgba(37,99,235,0.22)', border: '1px solid #7dd3fc', color: '#f8fafc' };
const resultRow = { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(2,6,23,0.4)', border: '1px solid rgba(148,163,184,0.14)' };
const btn = {
  primary: { border: 'none', borderRadius: 10, padding: '10px 16px', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap' },
  secondary: { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 9, padding: '7px 12px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' },
};
