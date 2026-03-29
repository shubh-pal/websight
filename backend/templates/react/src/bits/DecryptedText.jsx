// ReactBits — DecryptedText
// Character scramble → reveal animation (animateOn: 'view'|'hover'|'click')
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

export default function DecryptedText({
  text,
  speed = 60,
  maxIterations = 12,
  sequential = true,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
  className = '',
  parentClassName = '',
  encryptedClassName = '',
  animateOn = 'view',
}) {
  const [displayText, setDisplayText] = useState(animateOn === 'click' ? text.replace(/\S/g, () => characters[Math.floor(Math.random() * characters.length)]) : text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef(null);

  const availableChars = useMemo(() =>
    useOriginalCharsOnly ? Array.from(new Set(text.split(''))).filter(c => c !== ' ') : characters.split(''),
    [useOriginalCharsOnly, text, characters]
  );

  const shuffle = useCallback((original, revealed) =>
    original.split('').map((ch, i) => {
      if (ch === ' ') return ' ';
      if (revealed.has(i)) return original[i];
      return availableChars[Math.floor(Math.random() * availableChars.length)];
    }).join(''),
    [availableChars]
  );

  const triggerDecrypt = useCallback(() => {
    setRevealedIndices(new Set());
    setIsAnimating(true);
  }, []);

  // IntersectionObserver for 'view' mode
  useEffect(() => {
    if (animateOn !== 'view') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated) { triggerDecrypt(); setHasAnimated(true); }
    }, { threshold: 0.1 });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [animateOn, hasAnimated, triggerDecrypt]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;
    let iter = 0;
    const interval = setInterval(() => {
      setRevealedIndices(prev => {
        if (sequential) {
          if (prev.size >= text.length) {
            clearInterval(interval);
            setIsAnimating(false);
            setDisplayText(text);
            return prev;
          }
          const next = new Set(prev);
          const nextIdx = revealDirection === 'end' ? text.length - 1 - prev.size : prev.size;
          next.add(nextIdx);
          setDisplayText(shuffle(text, next));
          return next;
        } else {
          iter++;
          setDisplayText(shuffle(text, prev));
          if (iter >= maxIterations) {
            clearInterval(interval);
            setIsAnimating(false);
            setDisplayText(text);
          }
          return prev;
        }
      });
    }, speed);
    return () => clearInterval(interval);
  }, [isAnimating, text, speed, maxIterations, sequential, revealDirection, shuffle]);

  const hoverProps = animateOn === 'hover'
    ? { onMouseEnter: triggerDecrypt, onMouseLeave: () => { setIsAnimating(false); setRevealedIndices(new Set()); setDisplayText(text); } }
    : animateOn === 'click'
    ? { onClick: triggerDecrypt, style: { cursor: 'pointer' } }
    : {};

  return (
    <span ref={containerRef} className={parentClassName} {...hoverProps} style={{ display: 'inline-block', whiteSpace: 'pre-wrap', ...(hoverProps.style || {}) }}>
      <span aria-hidden="true">
        {displayText.split('').map((char, i) => (
          <span key={i} className={revealedIndices.has(i) || (!isAnimating && hasAnimated) ? className : encryptedClassName}>
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
