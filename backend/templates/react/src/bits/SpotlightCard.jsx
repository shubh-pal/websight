// ReactBits — SpotlightCard
// Interactive card with a mouse-tracking radial spotlight. Pure React + inline CSS, no deps.
import { useRef } from 'react';

const spotlightStyle = `
.card-spotlight {
  position: relative;
  border-radius: 1.5rem;
  border: 1px solid rgba(255,255,255,0.08);
  background-color: var(--bg-secondary, #111);
  padding: 2rem;
  overflow: hidden;
  --mouse-x: 50%;
  --mouse-y: 50%;
  --spotlight-color: rgba(255, 255, 255, 0.07);
  transition: border-color 0.3s ease, transform 0.3s ease;
}
.card-spotlight:hover {
  border-color: rgba(255,255,255,0.18);
  transform: translateY(-2px);
}
.card-spotlight::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), var(--spotlight-color), transparent 80%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
  border-radius: inherit;
}
.card-spotlight:hover::before,
.card-spotlight:focus-within::before {
  opacity: 1;
}
`;

// Inject styles once
if (typeof document !== 'undefined' && !document.getElementById('spotlight-card-styles')) {
  const tag = document.createElement('style');
  tag.id = 'spotlight-card-styles';
  tag.textContent = spotlightStyle;
  document.head.appendChild(tag);
}

const SpotlightCard = ({ children, className = '', spotlightColor = 'rgba(255, 255, 255, 0.12)' }) => {
  const divRef = useRef(null);

  const handleMouseMove = e => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    divRef.current.style.setProperty('--mouse-x', `${x}px`);
    divRef.current.style.setProperty('--mouse-y', `${y}px`);
    divRef.current.style.setProperty('--spotlight-color', spotlightColor);
  };

  return (
    <div ref={divRef} onMouseMove={handleMouseMove} className={`card-spotlight ${className}`}>
      {children}
    </div>
  );
};

export default SpotlightCard;
