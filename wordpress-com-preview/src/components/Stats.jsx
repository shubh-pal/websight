import { useEffect, useRef, useState } from 'react';
import '../styles/tokens.css';

const stats = [
  { value: 43, suffix: '%', label: 'of the web', sub: 'runs on WordPress' },
  { value: 70, suffix: 'M+', label: 'websites', sub: 'powered globally' },
  { value: 20, suffix: 'yr', label: 'of history', sub: 'since 2003' },
  { value: 100, suffix: 'M+', label: 'downloads', sub: 'and counting' },
];

function useCountUp(target, duration = 1500, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setCount(Math.floor(Math.sqrt(progress) * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return count;
}

function StatCell({ value, suffix, label, sub, active }) {
  const count = useCountUp(value, 1500, active);
  return (
    <div className="stats-cell">
      <div className="stats-number">
        <span className="stats-count">{count}</span>
        <span className="stats-suffix">{suffix}</span>
      </div>
      <p className="stats-label">{label}</p>
      <p className="stats-sub">{sub}</p>
    </div>
  );
}

export default function Stats() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setActive(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{`
        .stats-section {
          background: var(--secondary);
          padding: 80px 0;
          overflow: hidden;
          position: relative;
        }
        .stats-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 80% at 50% 50%, rgba(var(--primary-rgb), 0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .stats-eyebrow {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 48px;
          font-family: var(--font-body);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          max-width: var(--container);
          margin: 0 auto;
          padding: 0 24px;
        }
        .stats-cell {
          text-align: center;
          padding: 32px 24px;
          border-right: 1px solid rgba(255,255,255,0.08);
          position: relative;
        }
        .stats-cell:last-child { border-right: none; }
        .stats-number {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 4px;
          line-height: 1;
          margin-bottom: 12px;
        }
        .stats-count {
          font-size: clamp(3rem, 6vw, 5rem);
          font-weight: 900;
          color: #fff;
          font-family: var(--font-heading);
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .stats-suffix {
          font-size: clamp(1.5rem, 3vw, 2.5rem);
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 8px;
          line-height: 1.2;
        }
        .stats-label {
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin: 0 0 4px;
          font-family: var(--font-body);
        }
        .stats-sub {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.45);
          margin: 0;
          font-family: var(--font-body);
        }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .stats-cell { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .stats-cell:nth-child(even) { border-right: none; }
          .stats-cell:nth-last-child(-n+2) { border-bottom: none; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
          .stats-cell { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
          .stats-cell:last-child { border-bottom: none; }
        }
      `}</style>
      <section className="stats-section" ref={ref}>
        <p className="stats-eyebrow">WordPress by the numbers</p>
        <div className="stats-grid">
          {stats.map((s, i) => (
            <StatCell key={i} {...s} active={active} />
          ))}
        </div>
      </section>
    </>
  );
}
