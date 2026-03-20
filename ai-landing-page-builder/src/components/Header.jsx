import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/tokens.css';

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10); // Add scrolled class after 10px scroll
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'; // Prevent scrolling when mobile menu is open
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { "text": "AI LandingPage", "path": "/" },
    { "text": "AI Website Builder", "path": "/ai-website-builder" },
    { "text": "Templates", "path": "/templates" },
    { "text": "Pricing", "path": "/pricing" }
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className={isScrolled ? "hdr-main hdr-main-scrolled" : "hdr-main"}>
      <nav className="hdr-nav-container">
        <Link to="/" className="hdr-logo" onClick={closeMobileMenu}>
          <img src="https://cdn.landing-page.io/landingpage_io/image/logo.webp?x-oss-process=image/resize,w_96" alt="AI Landing Page Builder" className="hdr-logo-img" />
        </Link>

        <div className="hdr-desktop-nav">
          <ul className="hdr-nav-list">
            {navLinks.map((link) => (
              <li key={link.text} className="hdr-nav-item">
                <Link
                  to={link.path}
                  className={location.pathname === link.path ? "hdr-nav-link hdr-nav-link-active" : "hdr-nav-link"}
                >
                  {link.text}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/start-for-free" className="hdr-cta-button">
            Start for Free
          </Link>
        </div>

        <button className="hdr-mobile-toggle" onClick={toggleMobileMenu} aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}>
          {isMobileMenuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>
      </nav>

      {isMobileMenuOpen && (
        <nav className="hdr-mobile-nav-panel">
          <ul className="hdr-mobile-nav-list">
            {navLinks.map((link) => (
              <li key={link.text} className="hdr-mobile-nav-item">
                <Link
                  to={link.path}
                  className={location.pathname === link.path ? "hdr-mobile-nav-link hdr-mobile-nav-link-active" : "hdr-mobile-nav-link"}
                  onClick={closeMobileMenu}
                >
                  {link.text}
                </Link>
              </li>
            ))}
            <li className="hdr-mobile-nav-item hdr-mobile-cta-wrapper">
              <Link to="/start-for-free" className="hdr-mobile-cta-button" onClick={closeMobileMenu}>
                Start for Free
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
    </>
  );
}

export default Header;