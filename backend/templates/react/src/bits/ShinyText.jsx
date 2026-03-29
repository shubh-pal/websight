// ReactBits — ShinyText
// Metallic sheen sweeps across text
import { useState, useCallback, useRef } from 'react';
import { motion, useMotionValue, useAnimationFrame, useTransform } from 'motion/react';

export default function ShinyText({
  text,
  disabled = false,
  speed = 3,
  className = '',
  color = '#a78bfa',
  shineColor = '#ffffff',
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(null);
  const directionRef = useRef(direction === 'left' ? 1 : -1);
  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useAnimationFrame(time => {
    if (disabled || isPaused) { lastTimeRef.current = null; return; }
    if (lastTimeRef.current === null) { lastTimeRef.current = time; return; }
    const delta = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += delta;
    const cycleDuration = animationDuration + delayDuration;
    const cycleTime = elapsedRef.current % (yoyo ? cycleDuration * 2 : cycleDuration);
    const p = Math.min((cycleTime % cycleDuration) / animationDuration, 1) * 100;
    progress.set(directionRef.current === 1 ? p : 100 - p);
  });

  const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`);

  return (
    <motion.span
      className={className}
      style={{
        display: 'inline-block',
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundPosition,
      }}
      onMouseEnter={() => { if (pauseOnHover) setIsPaused(true); }}
      onMouseLeave={() => { if (pauseOnHover) setIsPaused(false); }}
    >
      {text}
    </motion.span>
  );
}
