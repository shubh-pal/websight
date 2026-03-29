// WebSight — FadeIn
// Simple scroll-triggered fade + slide reveal. No external deps.
import { useRef, useState, useEffect } from 'react';

export default function FadeIn({
  children,
  delay = 0,
  direction = 'up',
  distance = 32,
  duration = 0.65,
  threshold = 0.12,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  const translateMap = {
    up:    `translate3d(0, ${distance}px, 0)`,
    down:  `translate3d(0, -${distance}px, 0)`,
    left:  `translate3d(${distance}px, 0, 0)`,
    right: `translate3d(-${distance}px, 0, 0)`,
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate3d(0,0,0)' : (translateMap[direction] || translateMap.up),
        transition: `opacity ${duration}s cubic-bezier(0.4,0,0.2,1) ${delay}s, transform ${duration}s cubic-bezier(0.4,0,0.2,1) ${delay}s`,
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
