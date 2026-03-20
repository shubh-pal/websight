function CTABanner() {
  return (
    <>
      <section className="cta-section">
          {/* Background elements for the 'neural network' grid and 'breathing' effect */}
          {/* These elements are positioned to create depth, layering, and subtle asymmetry */}
          <div className="cta-bg-gradient-layer cta-bg-gradient-layer-1"></div>
          <div className="cta-bg-gradient-layer cta-bg-gradient-layer-2"></div>

          <div className="cta-content-wrapper">
            <div className="cta-eyebrow-pill">
              <span className="cta-eyebrow-text">AI-Powered Creation</span>
            </div>
            <h2 className="cta-headline">
              Unlock Your Vision. Instantly.
            </h2>
            <p className="cta-subtext">
              Transform your ideas into stunning, high-converting landing pages with intelligent automation. No coding, no design skills needed – just pure innovation.
            </p>
            <div className="cta-actions">
              <button className="cta-primary-button">
                Start for Free
                <svg className="cta-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
            <p className="cta-trust-line">
              Join thousands of innovators building smarter, faster.
            </p>
          </div>
        </section>
    </>
  );
}
export default CTABanner;