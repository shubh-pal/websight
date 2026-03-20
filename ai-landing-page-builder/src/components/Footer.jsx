import '../styles/tokens.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="ftr-root">
      <div className="ftr-separator"></div>
      <div className="ftr-container">
        <div className="ftr-grid">
          {/* Column 1: Brand */}
          <div className="ftr-col ftr-col-brand">
            <a href="/" className="ftr-logo-link">
              <img src="https://cdn.landing-page.io/landingpage_io/image/logo.webp?x-oss-process=image/resize,w_96" alt="AI Landing Page Builder Logo" className="ftr-logo-img" />
            </a>
            <p className="ftr-tagline">Build Stunning AI Landing Pages Instantly.</p>
            <div className="ftr-socials">
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="ftr-social-link">
                <svg viewBox="0 0 24 24" className="ftr-social-icon">
                  <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.045c.476-.951 1.637-1.956 3.37-1.956 3.615 0 4.279 2.387 4.279 5.467v6.225zM5.005 6.575a1.548 1.548 0 11-.001-3.096 1.548 1.548 0 01.001 3.096zm-1.729 13.877h3.414V9.001H3.276v11.451zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.454c.98 0 1.776-.773 1.776-1.729V1.729C24 .774 23.205 0 22.225 0z"></path>
                </svg>
              </a>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter/X" className="ftr-social-link">
                <svg viewBox="0 0 24 24" className="ftr-social-icon">
                  <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26L22 21.75h-7.192L9.687 13.415 2.25 2.25H8.03L12.604 8.21l5.64-5.96zM19.54 20.25H17.46L8.724 3.4H10.8L19.54 20.25z"></path>
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Services */}
          <div className="ftr-col">
            <h3 className="ftr-heading">SERVICES</h3>
            <ul className="ftr-nav-list">
              <li><a href="/ai-website-builder" className="ftr-nav-link">AI Website Builder</a></li>
              <li><a href="/templates" className="ftr-nav-link">Templates Library</a></li>
              <li><a href="/integrations" className="ftr-nav-link">Integrations</a></li>
              <li><a href="/custom-domains" className="ftr-nav-link">Custom Domains</a></li>
              <li><a href="/analytics" className="ftr-nav-link">Advanced Analytics</a></li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="ftr-col">
            <h3 className="ftr-heading">COMPANY</h3>
            <ul className="ftr-nav-list">
              <li><a href="/about" className="ftr-nav-link">About Us</a></li>
              <li><a href="/team" className="ftr-nav-link">Our Team</a></li>
              <li><a href="/careers" className="ftr-nav-link">Careers</a></li>
              <li><a href="/contact" className="ftr-nav-link">Contact Us</a></li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div className="ftr-col ftr-col-newsletter">
            <h3 className="ftr-heading">Stay updated</h3>
            <p className="ftr-newsletter-text">Get the latest news, updates, and exclusive offers directly in your inbox.</p>
            <form className="ftr-newsletter-form">
              <input type="email" placeholder="Your email address" aria-label="Your email address" className="ftr-newsletter-input" />
              <button type="submit" className="ftr-newsletter-button">Subscribe</button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="ftr-bottom-bar">
          <p className="ftr-copyright">© {currentYear} AI Landing Page Builder. All rights reserved.</p>
          <nav className="ftr-legal-nav">
            <a href="/privacy" className="ftr-legal-link">Privacy</a>
            <a href="/terms" className="ftr-legal-link">Terms</a>
            <a href="/cookies" className="ftr-legal-link">Cookies</a>
          </nav>
        </div>
      </div>
    </footer>
    </>
  );
};

export default Footer;