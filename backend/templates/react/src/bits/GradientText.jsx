// ReactBits — GradientText
// Animated color gradient sweep across text
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useAnimationFrame, useTransform } from 'motion/react';

export default function GradientText({
  children,
  className = '',
  colors = ['#6d28d9', '#ec4899', '#f59e0b', '#6d28d9'],
  animationSpeed = 6,
  showBorder = false,
  direction = 'horizontal',
  pauseOnHover = false,
  yoyo = true,
}) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(null);
  const animationDuration = animationSpeed * 1000;

  useAnimationFrame(time => {
    if (isPaused) { lastTimeRef.current = null; return; }
    if (lastTimeRef.current === null) { lastTimeRef.current = time; return; }
    const delta = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += delta;

    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;
      progress.set(cycleTime < animationDuration
        ? (cycleTime / animationDuration) * 100
        : 100 - ((cycleTime - animationDuration) / animationDuration) * 100);
    } else {
      progress.set((elapsedRef.current / animationDuration) * 100);
    }
  });

  useEffect(() => { elapsedRef.current = 0; progress.set(0); }, [animationSpeed, progress, yoyo]);

  const gradientAngle = direction === 'horizontal' ? 'to right' : direction === 'vertical' ? 'to bottom' : 'to bottom right';
  const gradientColors = [...colors, colors[0]].join(', ');
  const bgSize = direction === 'horizontal' ? '300% 100%' : direction === 'vertical' ? '100% 300%' : '300% 300%';

  const backgroundPosition = useTransform(progress, p =>
    direction === 'vertical' ? `50% ${p}%` : `${p}% 50%`
  );

  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize: bgSize,
    backgroundRepeat: 'repeat',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline',
  };

  return (
    <motion.span
      className={className}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={() => { if (pauseOnHover) setIsPaused(true); }}
      onMouseLeave={() => { if (pauseOnHover) setIsPaused(false); }}
    >
      {children}
    </motion.span>
  );
}
