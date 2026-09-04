import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const API = '/api/app/leadgen';

export default function RunDiscoveryModal({ onClose, onStarted }) {
  const [niches, setNiches] = useState([]);
  const [nicheId, setNicheId] = useState('');
  const [countries, setCountries] = useState(new Set());
  const [cities, setCities] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API}/niches`, { credentials: 'include' })
      .then((r) => r.json())
      .then((list) => {
        setNiches(list);
        if (list[0]) selectNiche(list[0]);
      })
      .catch(() => setErr('Failed to load niches'))
      .finally(() => setLoading(false));
  }, []);

  const niche = useMemo(() => niches.find((n) => n.id === nicheId), [niches, nicheId]);

  function selectNiche(n) {
    setNicheId(n.id);
    const locs = n.locations || [];
    setCountries(new Set(locs.map((l) => l.country)));
    setCities(new Set(locs.flatMap((l) => l.cities || [])));
  }

  const activeLocs = (niche?.locations || []).filter((l) => countries.has(l.country));
  const queryCount =
    (niche?.search_terms?.length || 0) *
    activeLocs.reduce((n, l) => n + (l.cities || []).filter((c) => cities.has(c)).length, 0);

  function toggle(set, setter, val) {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  }

  async function run() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`${API}/runs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicheId,
          overrides: { countries: [...countries], cities: [...cities] },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      onStarted?.(niche);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Run discovery</h2>
          <button onClick={onClose} style={xBtn}>✕</button>
        </div>

        {loading ? <p style={{ color: '#94a3b8' }}>Loading niches…</p> : (
          <>
            <label style={lbl}>Niche</label>
            <select
              value={nicheId}
              onChange={(e) => selectNiche(niches.find((n) => n.id === e.target.value))}
              style={select}
            >
              {niches.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>

            {niche ? (
              <div style={{ ...sub, margin: '6px 0 14px' }}>
                Search terms: {niche.search_terms.join(', ')}
              </div>
            ) : null}

            <label style={lbl}>Countries</label>
            <div style={chipRow}>
              {(niche?.locations || []).map((l) => (
                <button
                  key={l.country}
                  onClick={() => toggle(countries, setCountries, l.country)}
                  style={{ ...chip, ...(countries.has(l.country) ? chipOn : null) }}
                >
                  {l.country}
                </button>
              ))}
            </div>

            <label style={lbl}>Cities</label>
            <div style={{ ...chipRow, maxHeight: 160, overflowY: 'auto' }}>
              {activeLocs.flatMap((l) => (l.cities || []).map((c) => (
                <button
                  key={c}
                  onClick={() => toggle(cities, setCities, c)}
                  style={{ ...chip, ...(cities.has(c) ? chipOn : null) }}
                >
                  {c}
                </button>
              )))}
              {activeLocs.length === 0 ? <span style={sub}>select a country first</span> : null}
            </div>

            {err ? <div style={errBox}>{err}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <span style={sub}>
                ~{queryCount} Places {queryCount === 1 ? 'query' : 'queries'} · <Link to="/admin/niches" style={{ color: '#7dd3fc' }}>manage niches</Link>
              </span>
              <button onClick={run} disabled={busy || !queryCount} style={{ ...runBtn, opacity: busy || !queryCount ? 0.5 : 1 }}>
                {busy ? 'Starting…' : 'Run discovery'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', display: 'grid', placeItems: 'center', zIndex: 50, backdropFilter: 'blur(3px)' };
const modal = { width: 'min(560px, 92vw)', background: '#0f172a', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 18, padding: 24, color: '#e2e8f0' };
const lbl = { display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#7dd3fc', margin: '14px 0 6px' };
const select = { width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0', fontSize: 14 };
const chipRow = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.2)', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 };
const chipOn = { background: 'rgba(37,99,235,0.25)', border: '1px solid #7dd3fc', color: '#f8fafc' };
const sub = { color: '#64748b', fontSize: 12 };
const errBox = { marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(127,29,29,0.4)', color: '#fecaca', fontSize: 13 };
const runBtn = { border: 'none', borderRadius: 12, padding: '11px 18px', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700 };
const xBtn = { background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' };
