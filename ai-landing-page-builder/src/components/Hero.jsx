import { useEffect, useRef } from 'react';
import '../styles/tokens.css';

function Hero() {
  const heroRef = useRef(null);

  useEffect(() => {
    // This useEffect is a placeholder for potential future scroll or intersection observer logic.
    // As per rules, all interactions (useState, useEffect, IntersectionObserver, scroll) go here.
    // For now, it simply logs that the Hero component mounted.
    console.log('Hero component mounted.');

    // Example for a subtle parallax effect on background layers (conceptual, needs CSS for actual implementation)
    const handleScroll = () => {
      if (heroRef.current) {
        const scrollY = window.scrollY;
        // Apply a subtle transform to a background element if it existed here
        // e.g., heroRef.current.style.setProperty('--scroll-offset', `${scrollY * 0.1}px`);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <section ref={heroRef} className="hero-section">
      {/* Background elements for the 'neural network' grid and gradient layers */}
      <div className="hero-background-gradient"></div>
      <div className="hero-background-grid-overlay"></div>
      <div className="hero-background-geometric-lines"></div>

      <div className="hero-content-wrapper">
        <div className="hero-badge">
          <span>✦ Build Stunning AI Landing Pages Instantly.</span>
        </div>

        <h1 className="hero-headline">
          Unleash Your Vision. AI Builds It.
        </h1>

        <p className="hero-subheadline">
          Transform your ideas into high-converting landing pages in seconds. Our intelligent builder crafts stunning designs, effortlessly.
        </p>

        <div className="hero-cta-group">
          <button className="hero-cta-primary">
            Start for Free
          </button>
          <button className="hero-cta-secondary">
            Learn More
          </button>
        </div>

        <div className="hero-social-proof">
          <div className="hero-stars">
            {/* Star Icon */}
            <svg viewBox="0 0 24 24" className="hero-star-icon">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.25l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
            <svg viewBox="0 0 24 24" className="hero-star-icon">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.25l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
            <svg viewBox="0 0 24 24" className="hero-star-icon">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.25l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
            <svg viewBox="0 0 24 24" className="hero-star-icon">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.25l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
            <svg viewBox="0 0 24 24" className="hero-star-icon">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.25l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
          </div>
          <p className="hero-social-text">Trusted by 50,000+ marketers & entrepreneurs.</p>
        </div>
      </div>

      <div className="hero-product-ui-container">
        {/*
          This image represents a dynamic, high-fidelity product UI screenshot
          that appears to be actively building a page.
          The 'actively building' effect is implied by the image content itself
          and subtle animations applied to its container via CSS (e.g., soft glow, slight scale).
        */}
        <img
          src="https://cdn.landing-page.io/landingpage_io/image/product-ui-mockup.webp" // Placeholder, imagine a UI being built
          alt="AI Landing Page Builder UI actively creating a page"
          className="hero-product-ui-screenshot"
        />
        {/* Subtle overlay/glow to imply AI activity on the screenshot */}
        <div className="hero-product-ui-overlay"></div>
      </div>
    </section>
    </>
  );
}

export default Hero;