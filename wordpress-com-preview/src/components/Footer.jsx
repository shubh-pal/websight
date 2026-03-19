import '../styles/tokens.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  const servicesLinks = [
    { text: "प्लान्स और कीमत", path: "/pricing/" },
    { text: "होस्टिंग", path: "/hosting/" },
    { text: "एजेंसियों के लिए", path: "/agencies/" },
    { text: "ई-कॉमर्स", path: "/ecommerce/" },
    { text: "डोमेन", path: "/domains/" },
  ];

  const companyLinks = [
    { text: "हमारे बारे में", path: "/about/" },
    { text: "हमारी टीम", path: "/team/" },
    { text: "करियर", path: "/careers/" },
    { text: "संपर्क करें", path: "/contact/" },
  ];

  return (
    <>
      <footer className="ftr-footer">
        <div className="ftr-container">
          <div className="ftr-grid">
            <div className="ftr-brand">
              <img src="https://wordpress.com/wp-content/uploads/2023/06/play-store-logo.png" alt="WordPress.com Logo" className="ftr-logo-img" />
              <p className="ftr-tagline">अपनी वेबसाइट बनाने के लिए सब कुछ एक ही जगह।</p>
              <div className="ftr-socials">
                <a href="https://www.linkedin.com/company/wordpresscom" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="ftr-social-link">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.153V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.064-2.065c0-1.136.928-2.063 2.064-2.063 1.136 0 2.064.927 2.064 2.063 0 1.136-.928 2.065-2.064 2.065zm-.007 13.019H2.19V9h3.13zm20.5-11.132v15.156H1V.392h22.837z" />
                  </svg>
                </a>
                <a href="https://twitter.com/wordpressdotcom" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="ftr-social-link">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.714 11.24H15.676L9.956 13.32 3.79 22H1.026l7.693-8.835L1.026 2.25H8.01L13.492 9.367l4.756-7.117zM17.413 19.963h2.163L8.695 4.066H6.416l10.997 15.897z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="ftr-col-heading">सेवाएं</h3>
              <ul className="ftr-nav-list">
                {servicesLinks.map((link, index) => (
                  <li key={index}>
                    <a href={link.path} className="ftr-nav-link">{link.text}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="ftr-col-heading">कंपनी</h3>
              <ul className="ftr-nav-list">
                {companyLinks.map((link, index) => (
                  <li key={index}>
                    <a href={link.path} className="ftr-nav-link">{link.text}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="ftr-col-heading">अपडेट रहें</h3>
              <form className="ftr-newsletter-form">
                <input type="email" placeholder="आपका ईमेल" aria-label="आपका ईमेल" className="ftr-newsletter-input" />
                <button type="submit" className="ftr-newsletter-button">सदस्यता लें</button>
              </form>
            </div>
          </div>

          <div className="ftr-bottom-bar">
            <p className="ftr-copyright">© {currentYear} WordPress.com. सर्वाधिकार सुरक्षित।</p>
            <div className="ftr-legal-links">
              <a href="/privacy" className="ftr-legal-link">गोपनीयता</a>
              <a href="/terms" className="ftr-legal-link">शर्तें</a>
              <a href="/cookies" className="ftr-legal-link">कुकीज़</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Footer;