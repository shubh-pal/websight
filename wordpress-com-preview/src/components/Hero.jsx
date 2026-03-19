import { useEffect, useRef } from 'react';
import '../styles/tokens.css';

function Hero() {
  const heroRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const scrollY = window.scrollY;
        // Apply a subtle parallax or depth effect based on scroll
        heroRef.current.style.setProperty('--scroll-offset', `${scrollY * 0.05}px`);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <section className="hero-section" ref={heroRef}>
        <div className="hero-background-pattern"></div>
        <div className="hero-content">
          <div className="hero-text-block">
            <div className="hero-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              अपनी वेबसाइट बनाने के लिए सब कुछ एक ही जगह।
            </div>
            <h1 className="hero-headline">
              <span>WordPress, जैसा होना चाहिए</span>
              <span className="english-headline">WordPress, As It Should Be</span>
            </h1>
            <p className="hero-subheadline">
              WordPress.com के साथ आसानी से अपनी WordPress वेबसाइट बनाएँ. बिल्ट-इन होस्टिंग, शानदार थीम्स और ज़रूरी टूल्स के साथ — बिना किसी तकनीकी झंझट के। आज ही शुरू करें, फ्री प्लान उपलब्ध है.
            </p>
            <div className="hero-actions">
              <a href="#" className="hero-button hero-button--primary">
                आज ही शुरू करें
              </a>
              <a href="#" className="hero-button hero-button--secondary">
                Learn More
              </a>
            </div>
            <div className="hero-trust-signals">
              <div className="hero-stars" aria-label="Rated 4.9 out of 5 stars">
                <span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span>
              </div>
              Trusted by millions of sites worldwide
            </div>
          </div>
          <div className="hero-visual-element">
            {/* This div serves as the 40% right side, intentionally kept minimal
                to emphasize the left-heavy text block and the dynamic background patterns.
                The "sculptural typographic statement" is the primary visual hook. */}
          </div>
        </div>
      </section>
    </>
  );
}

export default Hero;