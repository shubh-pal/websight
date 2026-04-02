import { useState, useRef, useEffect } from 'react';

export default function CompareSlider({ original, redesign }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);

  const handleMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    if (!x) return;
    
    let pos = ((x - rect.left) / rect.width) * 100;
    if (pos < 0) pos = 0;
    if (pos > 100) pos = 100;
    setSliderPos(pos);
  };

  const handleTouch = (e) => handleMove(e);

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.label}>Original Site</div>
        <div style={s.label}>Redesigned View</div>
      </div>

      <div 
        ref={containerRef}
        style={s.container}
        onMouseMove={handleMove}
        onTouchMove={handleTouch}
      >
        {/* Redesign (Underneath) */}
        <div style={s.redesignImgWrap}>
          {redesign ? (
            <img src={redesign.startsWith('data:') ? redesign : `data:image/webp;base64,${redesign}`} style={s.img} alt="Redesign" />
          ) : (
            <div style={s.placeholder}>
              <span style={s.spinner} />
              Publish your project to generate the comparison view.
            </div>
          )}
        </div>

        {/* Original (Clip path overlay) */}
        <div style={{ ...s.originalImgWrap, width: `${sliderPos}%` }}>
          {original ? (
            <img src={original.startsWith('data:') ? original : `data:image/webp;base64,${original}`} style={s.img} alt="Original" />
          ) : (
            <div style={s.placeholder}>No original screenshot available.</div>
          )}
          <div style={s.badgeOriginal}>Original</div>
        </div>

        {/* Slider Handle */}
        <div style={{ ...s.handle, left: `${sliderPos}%` }}>
          <div style={s.handleLine} />
          <div style={s.handleCircle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 8L22 12L18 16" />
              <path d="M6 16L2 12L6 8" />
            </svg>
          </div>
        </div>

        <div style={s.badgeRedesign}>Redesign</div>
      </div>
    </div>
  );
}

const s = {
  root: { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', padding: '0 4px' },
  label: { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  container: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid var(--border)',
    userSelect: 'none',
    cursor: 'col-resize',
    background: 'var(--bg-3)',
  },
  img: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '1000px', // Fixed reference for clipping
    height: 'auto',
    minWidth: '100%',
    display: 'block',
    objectFit: 'cover',
    pointerEvents: 'none',
  },
  redesignImgWrap: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  originalImgWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 2,
    borderRight: '1px solid rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    background: '#fff',
    zIndex: 3,
    transform: 'translateX(-1px)',
    pointerEvents: 'none',
  },
  handleLine: { height: '100%', width: 2, background: '#fff' },
  handleCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#fff',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(0,0,0,0.3)',
  },
  badgeOriginal: {
    position: 'absolute',
    top: 16,
    left: 16,
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    backdropFilter: 'blur(4px)',
  },
  badgeRedesign: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'rgba(124,106,247,0.7)',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    backdropFilter: 'blur(4px)',
    zIndex: 1,
  },
  placeholder: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 40
  },
  spinner: { width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--violet-bright)', animation: 'spin 1s linear infinite' },
};
