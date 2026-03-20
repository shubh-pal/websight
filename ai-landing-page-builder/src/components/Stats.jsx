import { useEffect, useRef, useState } from 'react';
import '../styles/tokens.css';

// Helper component for counting animation
const CountUp = ({ targetValue, suffix, label, duration = 1500, isHero = false }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false); // To ensure animation only plays once per view

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          let startTimestamp = null;
          const easeOutSqrt = (t) => Math.sqrt(t); // sqrt curve for ease-out

          const animate = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = (timestamp - startTimestamp) / duration;

            if (progress < 1) {
              const easedProgress = easeOutSqrt(progress);
              setCount(Math.floor(easedProgress * targetValue));
              requestAnimationFrame(animate);
            } else {
              setCount(targetValue);
            }
          };
          requestAnimationFrame(animate);
        }
        // If it goes out of view, we don't reset hasAnimated.current to prevent re-animation on scroll back up
        // as per typical "on-scroll-into-view" animation patterns.
      },
      {
        threshold: 0.5, // Trigger when 50% of the element is visible
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [targetValue, duration]);

  const formattedCount = Intl.NumberFormat('en-US').format(count);

  return (
    <>
      <div ref={ref} className={`stat-item ${isHero ? 'stat-item-hero' : ''}`}>
      <div className="stat-value-wrapper">
        <span className="stat-value">{formattedCount}</span>
        {suffix && <span className="stat-suffix">{suffix}</span>}
      </div>
      <p className="stat-label">{label}</p>
    </div>
    </>
  );
};

const StatsSection = () => {
  const statsData = [
    { value: 500000, suffix: '+', label: 'Landing Pages Generated', isHero: true },
    { value: 80, suffix: '%', label: 'Faster Page Creation', isHero: false },
    { value: 10, suffix: 'X', label: 'Conversion Rate Boost', isHero: false },
    { value: 120, suffix: '+', label: 'Countries Empowered', isHero: false },
  ];

  return (
    <section className="stats-section stats-section-relative">
      {/* Neural network grid pattern and AI pulse background */}
      <div className="stats-neural-grid-bg stats-ai-pulse"></div>
      
      <div className="stats-container">
        {statsData.map((stat, index) => (
          <CountUp
            key={index}
            targetValue={stat.value}
            suffix={stat.suffix}
            label={stat.label}
            isHero={stat.isHero}
          />
        ))}
      </div>
    </section>
  );
};

export default StatsSection;