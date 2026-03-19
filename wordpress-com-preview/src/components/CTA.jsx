import React from 'react';

function CallToActionSection() {
  return (
    <>
      <section className="cta-section">
        <div className="cta-content">
          <span className="cta-eyebrow">
            Build Your Digital Foundation
          </span>
          <h2 className="cta-headline">
            Your Vision, Realized.<br />Effortlessly Powerful.
          </h2>
          <p className="cta-subtext">
            From personal blogs to enterprise solutions, WordPress.com provides the robust platform and intuitive tools you need to thrive online. Start building your legacy today.
          </p>
          <div className="cta-actions">
            <a href="#start" className="cta-button cta-button-primary">
              आज ही शुरू करें
            </a>
            <a href="#learn-more" className="cta-button cta-button-secondary">
              Learn More
            </a>
          </div>
          <p className="cta-trust-line">
            Trusted by millions of creators and businesses worldwide.
          </p>
        </div>
      </section>
    </>
  );
}

export default CallToActionSection;