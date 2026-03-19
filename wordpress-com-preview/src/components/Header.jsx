import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/tokens.css';

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  const navLinks = [
    { "text": "प्लान्स और कीमत", "path": "/pricing/" },
    { "text": "होस्टिंग", "path": "/hosting/" },
    { "text": "एजेंसियों के लिए", "path": "/agencies/" },
    { "text": "लॉग इन", "path": "/log-in/" },
    { "text": "प्रारंभ करें", "path": "/setup/onboarding/" }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      <header className={`hdr-header ${isScrolled ? 'hdr-scrolled' : ''}`}>
        <div className="hdr-container">
          <Link to="/" className="hdr-logo-link" aria-label="WordPress.com Home">
            <img src="https://wordpress.com/wp-content/uploads/2023/06/play-store-logo.png" alt="WordPress.com Logo" className="hdr-logo-img" />
            WordPress.com
          </Link>

          <nav className="hdr-nav">
            <ul className="hdr-nav-list">
              {navLinks.map((link, index) => (
                <li key={index} className="hdr-nav-item">
                  <Link
                    to={link.path}
                    className={`hdr-nav-link ${location.pathname === link.path ? 'hdr-active' : ''}`}
                  >
                    {link.text}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/setup/onboarding/" className="hdr-cta-button">
              आज ही शुरू करें
            </Link>
          </nav>

          <button
            className={`hdr-menu-toggle ${isMenuOpen ? 'hdr-open' : ''}`}
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            <span className="hdr-menu-toggle-icon"></span>
          </button>
        </div>

        <div className={`hdr-mobile-nav ${isMenuOpen ? 'hdr-open' : ''}`}>
          <ul className="hdr-mobile-nav-list">
            {navLinks.map((link, index) => (
              <li key={index}>
                <Link
                  to={link.path}
                  className={`hdr-mobile-nav-link ${location.pathname === link.path ? 'hdr-active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.text}
                </Link>
              </li>
            ))}
            <li className="hdr-mobile-cta">
              <Link to="/setup/onboarding/" className="hdr-cta-button" onClick={() => setIsMenuOpen(false)}>
                आज ही शुरू करें
              </Link>
            </li>
          </ul>
        </div>
      </header>
    </>
  );
}

export default Header;