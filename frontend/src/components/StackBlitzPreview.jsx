import { useEffect, useRef, useState, useCallback } from 'react';

export default function StackBlitzPreview({ files, projectName }) {
  const [status, setStatus]     = useState('idle');
  const [error, setError]       = useState('');
  const [viewMode, setViewMode] = useState('preview');
  const [embedKey, setEmbedKey] = useState(0);
  const vmRef       = useRef(null);
  const embedDivRef = useRef(null);
  const didEmbed    = useRef(false);

  const containerRef = useCallback(node => {
    embedDivRef.current = node;
  }, []);

  useEffect(() => {
    if (!files || Object.keys(files).length === 0) return;
    if (didEmbed.current) return;
    const t = setTimeout(() => embed(), 120);
    return () => clearTimeout(t);
  }, [files, embedKey]);

  async function embed() {
    const el = embedDivRef.current;
    if (!el) { setError('Container not ready — try Reload.'); setStatus('error'); return; }
    didEmbed.current = true;
    setStatus('loading');
    setError('');
    el.innerHTML = '';
    try {
      const sdk = (await import('@stackblitz/sdk')).default;
      let pkg = {};
      try { pkg = JSON.parse(files['package.json'] || '{}'); } catch (_) {}
      pkg.scripts         = { dev: 'vite --host', build: 'vite build', preview: 'vite preview', ...pkg.scripts };
      pkg.dependencies    = { react: '^18.3.1', 'react-dom': '^18.3.1', 'react-router-dom': '^6.23.1', ...pkg.dependencies };
      pkg.devDependencies = { '@vitejs/plugin-react': '^4.3.0', vite: '^5.2.12', ...pkg.devDependencies };
      const sbFiles  = { ...files, 'package.json': JSON.stringify(pkg, null, 2) };
      const openFile = ['src/pages/Home.jsx','src/App.jsx','index.html'].find(f => sbFiles[f]) || Object.keys(sbFiles)[0];
      const vm = await sdk.embedProject(el,
        { title: projectName || 'WebSight Redesign', template: 'node', files: sbFiles },
        { forceEmbedLayout: true, openFile, view: viewMode, hideNavigation: false,
          hideDevTools: false, terminalHeight: 32, theme: 'dark', clickToLoad: false,
          width: '100%', height: '100%' }
      );
      vmRef.current = vm;
      setStatus('ready');
    } catch (err) {
      console.error('[StackBlitz]', err);
      setError(err.message || 'StackBlitz failed to load');
      setStatus('error');
      didEmbed.current = false;
    }
  }

  async function handleSetView(mode) {
    setViewMode(mode);
    if (vmRef.current) { try { await vmRef.current.editor.setView(mode); } catch (_) {} }
  }

  async function openFile(path) {
    if (vmRef.current) { try { await vmRef.current.editor.openFile(path); } catch (_) {} }
  }

  function reload() { didEmbed.current = false; setEmbedKey(k => k + 1); }

  return (
    <div style={s.root}>
      <div style={s.toolbar}>
        <div style={s.tbLeft}>
          <SBLogo />
          <span style={s.tbLabel}>StackBlitz WebContainer</span>
          {status === 'ready'   && <span style={s.pill('green')}><span style={s.dot('green')} /> Live</span>}
          {status === 'loading' && <span style={s.pill('violet')}><span style={s.spinEl} /> Booting…</span>}
          {status === 'error'   && <span style={s.pill('red')}>⚠ Error</span>}
        </div>
        <div style={s.tbRight}>
          {status === 'ready' && (
            <div style={s.viewGroup}>
              {[['preview','◻ Preview'],['editor','⌨ Editor'],['both','⊟ Split']].map(([v,label]) => (
                <button key={v} onClick={() => handleSetView(v)}
                  style={{ ...s.viewBtn, ...(viewMode===v ? s.viewBtnOn : {}) }}>{label}</button>
              ))}
            </div>
          )}
          {status === 'ready' && (
            <div style={s.quickGroup}>
              {['src/pages/Home.jsx','src/styles/tokens.css','src/App.jsx'].filter(f => files?.[f]).map(f => (
                <button key={f} style={s.quickBtn} onClick={() => openFile(f)}>{f.split('/').pop()}</button>
              ))}
            </div>
          )}
          <button style={s.iconBtn} onClick={reload} title="Reload preview">↺</button>
        </div>
      </div>

      <div style={s.body}>
        {/* Keyed so reload() forces a fresh DOM node for StackBlitz to replace */}
        <div key={embedKey} ref={containerRef} style={s.sbTarget} />

        {status === 'idle' && (
          <div style={s.overlay}>
            <SBLogo size={44} />
            <p style={s.overlayText}>Preview loads once generation completes</p>
          </div>
        )}

        {status === 'loading' && (
          <div style={s.overlay}>
            <div style={s.bigSpinner} />
            <div style={s.loadTitle}>Booting WebContainer</div>
            <div style={s.loadSteps}>
              {['Starting Node.js in browser…','Running npm install…','Starting Vite dev server…','Opening preview…'].map((t,i) => (
                <div key={i} style={s.loadStep}>
                  <span style={{ ...s.dot('blue'), animation: `pulse ${1.2+i*.2}s ease-in-out infinite` }} />{t}
                </div>
              ))}
            </div>
            <div style={s.loadNote}>First boot ~20–30s · Subsequent loads instant</div>
          </div>
        )}

        {status === 'error' && (
          <div style={s.overlay}>
            <div style={s.errIcon}>⚠</div>
            <div style={s.errTitle}>Preview failed to load</div>
            <div style={s.errMsg}>{error}</div>
            <div style={s.errHints}>
              <strong>Common fixes:</strong>
              <ul style={{ paddingLeft: 20, marginTop: 6 }}>
                <li>Use Chrome, Edge, or Arc (Firefox blocks WebContainers)</li>
                <li>Disable cross-origin isolating extensions</li>
                <li>Click Reload ↺ to try again</li>
              </ul>
            </div>
            <button style={s.retryBtn} onClick={reload}>↺ Reload preview</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function SBLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={{flexShrink:0}}>
      <rect width="28" height="28" rx="6" fill="#1389FD"/>
      <path d="M8 16.5l8-9v6h4l-8 9v-6H8z" fill="#fff"/>
    </svg>
  );
}

const s = {
  root:    { height:'100%', display:'flex', flexDirection:'column', background:'var(--bg)', overflow:'hidden' },
  toolbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', height:42,
             flexShrink:0, borderBottom:'1px solid var(--border)', background:'var(--bg-1)', gap:12 },
  tbLeft:  { display:'flex', alignItems:'center', gap:10, minWidth:0 },
  tbRight: { display:'flex', alignItems:'center', gap:8, flexShrink:0 },
  tbLabel: { fontSize:12, fontFamily:'var(--font-mono)', color:'var(--text-2)', whiteSpace:'nowrap' },
  pill: c => ({ display:'flex', alignItems:'center', gap:6, fontSize:11, fontFamily:'var(--font-mono)',
    padding:'3px 10px', borderRadius:99, whiteSpace:'nowrap',
    color:     c==='green'?'var(--green)':c==='violet'?'var(--violet-bright)':'var(--red)',
    background:c==='green'?'rgba(30,245,160,.08)':c==='violet'?'rgba(124,106,247,.1)':'rgba(245,35,74,.08)',
    border:`1px solid ${c==='green'?'rgba(30,245,160,.25)':c==='violet'?'rgba(124,106,247,.25)':'rgba(245,35,74,.25)'}` }),
  dot: c => ({ width:7, height:7, borderRadius:'50%', flexShrink:0,
    background:c==='green'?'var(--green)':c==='blue'?'#1389FD':'var(--violet-bright)',
    boxShadow:c==='green'?'0 0 6px var(--green)':'none' }),
  spinEl:  { display:'inline-block', width:12, height:12, borderRadius:'50%', flexShrink:0,
             border:'2px solid rgba(168,151,255,.3)', borderTopColor:'var(--violet-bright)',
             animation:'spin .7s linear infinite' },
  viewGroup: { display:'flex', gap:3 },
  viewBtn:   { fontSize:11, fontFamily:'var(--font-mono)', padding:'4px 10px', borderRadius:6, cursor:'pointer',
               background:'var(--bg-3)', border:'1px solid var(--border)', color:'var(--text-3)', transition:'all .15s' },
  viewBtnOn: { color:'var(--violet-bright)', background:'rgba(124,106,247,.12)', borderColor:'rgba(124,106,247,.4)' },
  quickGroup:{ display:'flex', gap:4 },
  quickBtn:  { fontSize:10, fontFamily:'var(--font-mono)', padding:'3px 8px', borderRadius:5, cursor:'pointer',
               background:'transparent', border:'1px solid var(--border)', color:'var(--text-3)', transition:'all .15s' },
  iconBtn:   { width:28, height:28, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
               fontSize:16, cursor:'pointer', background:'var(--bg-3)', border:'1px solid var(--border)',
               borderRadius:6, color:'var(--text-2)', transition:'all .15s' },
  body:      { flex:1, position:'relative', overflow:'hidden' },
  sbTarget:  { position:'absolute', inset:0, width:'100%', height:'100%' },
  overlay:   { position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column',
               alignItems:'center', justifyContent:'center', gap:16, padding:32,
               background:'var(--bg)', animation:'fadeIn .3s ease' },
  overlayText:{ fontSize:13, color:'var(--text-3)', fontFamily:'var(--font-mono)' },
  bigSpinner: { width:44, height:44, borderRadius:'50%', border:'3px solid var(--bg-4)',
                borderTopColor:'#1389FD', animation:'spin .9s linear infinite' },
  loadTitle: { fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--text)' },
  loadSteps: { display:'flex', flexDirection:'column', gap:9, alignItems:'flex-start' },
  loadStep:  { display:'flex', alignItems:'center', gap:10, fontSize:12, fontFamily:'var(--font-mono)', color:'var(--text-2)' },
  loadNote:  { fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)', padding:'7px 14px',
               background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, marginTop:4 },
  errIcon:   { fontSize:32, color:'var(--red)' },
  errTitle:  { fontSize:16, fontWeight:600, color:'var(--text)' },
  errMsg:    { fontSize:12, fontFamily:'var(--font-mono)', color:'var(--red)', background:'rgba(245,35,74,.06)',
               border:'1px solid rgba(245,35,74,.2)', borderRadius:8, padding:'8px 14px', maxWidth:420, wordBreak:'break-word' },
  errHints:  { fontSize:12, color:'var(--text-2)', lineHeight:1.7, maxWidth:380 },
  retryBtn:  { padding:'9px 22px', background:'var(--violet)', color:'#fff', border:'none',
               borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', marginTop:4 },
};
