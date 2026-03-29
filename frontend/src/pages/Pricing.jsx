import { Link } from 'react-router-dom';

export default function Pricing() {
  return (
    <div style={styles.root}>
      {/* Simple Header */}
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>
          <LogoMark />
          <span style={styles.logoText}>WebSight</span>
        </Link>
        <Link to="/" style={styles.backLink}>
          Back to app
        </Link>
      </header>

      <div style={styles.container}>
        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Simple, transparent pricing</h1>
          <p style={styles.heroSub}>Choose the plan that fits your needs</p>
        </div>

        {/* Pricing Cards */}
        <div style={styles.plansGrid}>
          {/* FREE Plan */}
          <div style={styles.planCard}>
            <div style={styles.planHeader}>
              <h3 style={styles.planName}>Free</h3>
              <div style={styles.planPrice}>
                <span style={styles.price}>$0</span>
                <span style={styles.period}>/month</span>
              </div>
            </div>

            <ul style={styles.featuresList}>
              <li style={styles.feature}>✓ 3 jobs/month</li>
              <li style={styles.feature}>✓ React only</li>
              <li style={styles.feature}>✓ Gemini Flash Lite</li>
              <li style={styles.feature}>✓ ZIP download</li>
            </ul>

            <Link to="/login" style={styles.buttonFree}>
              Get Started Free
            </Link>
          </div>

          {/* PRO Plan - Featured */}
          <div style={{ ...styles.planCard, ...styles.planCardFeatured }}>
            <div style={styles.mostPopularBadge}>Most Popular</div>

            <div style={styles.planHeader}>
              <h3 style={styles.planNameFeatured}>Pro</h3>
              <div style={styles.planPrice}>
                <span style={styles.priceFeatured}>$19</span>
                <span style={styles.periodFeatured}>/month</span>
              </div>
            </div>

            <ul style={styles.featuresListFeatured}>
              <li style={styles.featureFeatured}>✓ Unlimited jobs</li>
              <li style={styles.featureFeatured}>✓ React + Angular</li>
              <li style={styles.featureFeatured}>✓ All AI models</li>
              <li style={styles.featureFeatured}>✓ Dashboard</li>
              <li style={styles.featureFeatured}>✓ Priority queue</li>
            </ul>

            <Link to="/login" style={styles.buttonPro}>
              Start Pro Trial
            </Link>
          </div>

          {/* TEAM Plan */}
          <div style={styles.planCard}>
            <div style={styles.planHeader}>
              <h3 style={styles.planName}>Team</h3>
              <div style={styles.planPrice}>
                <span style={styles.price}>$49</span>
                <span style={styles.period}>/month</span>
              </div>
            </div>

            <ul style={styles.featuresList}>
              <li style={styles.feature}>✓ Everything in Pro</li>
              <li style={styles.feature}>✓ 5 members</li>
              <li style={styles.feature}>✓ Shared library</li>
              <li style={styles.feature}>✓ Custom API keys</li>
            </ul>

            <Link to="/login" style={styles.buttonTeam}>
              Get Started
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div style={styles.faqSection}>
          <h2 style={styles.faqTitle}>Frequently Asked Questions</h2>

          <div style={styles.faqGrid}>
            <div style={styles.faqItem}>
              <h4 style={styles.faqQuestion}>What counts as a "job"?</h4>
              <p style={styles.faqAnswer}>
                Each URL redesign counts as 1 job. Generating React and Angular versions from the same URL = 2 jobs.
              </p>
            </div>

            <div style={styles.faqItem}>
              <h4 style={styles.faqQuestion}>Can I use my own API keys?</h4>
              <p style={styles.faqAnswer}>
                Yes! Add your API keys in Settings to bypass platform quotas entirely. Your keys are stored encrypted.
              </p>
            </div>

            <div style={styles.faqItem}>
              <h4 style={styles.faqQuestion}>What AI models are available?</h4>
              <p style={styles.faqAnswer}>
                Free tier gets Gemini Flash Lite. Pro unlocks Claude, GPT-4o, Gemini Flash, Groq, and DeepSeek.
              </p>
            </div>

            <div style={styles.faqItem}>
              <h4 style={styles.faqQuestion}>Can I cancel anytime?</h4>
              <p style={styles.faqAnswer}>
                Yes! Cancel from your dashboard anytime. Access continues until your billing period ends.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Strip */}
        <div style={styles.ctaStrip}>
          <div>
            <h3 style={styles.ctaTitle}>Start with the free tier</h3>
            <p style={styles.ctaSub}>No credit card required</p>
          </div>
          <Link to="/login" style={styles.ctaButton}>
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="7" height="7" rx="1" fill="var(--violet)" />
      <rect x="11" y="2" width="7" height="7" rx="1" fill="var(--cyan)" />
      <rect x="2" y="11" width="7" height="7" rx="1" fill="var(--green)" />
      <rect x="11" y="11" width="7" height="7" rx="1" fill="var(--violet)" opacity="0.6" />
    </svg>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
    color: 'var(--text)',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  },
  backLink: {
    fontSize: 14,
    color: 'var(--text-2)',
    textDecoration: 'none',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
  container: {
    flex: 1,
    maxWidth: 1200,
    margin: '0 auto',
    padding: '60px 24px',
    width: '100%',
  },
  hero: {
    textAlign: 'center',
    marginBottom: 60,
  },
  heroTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(32px, 5vw, 52px)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    marginBottom: 16,
  },
  heroSub: {
    fontSize: 18,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 24,
    marginBottom: 80,
  },
  planCard: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    transition: 'all 0.3s',
    position: 'relative',
  },
  planCardFeatured: {
    background: 'var(--bg-2)',
    border: '2px solid var(--violet)',
    boxShadow: '0 0 20px rgba(124,106,247,0.15)',
    transform: 'scale(1.05)',
  },
  mostPopularBadge: {
    position: 'absolute',
    top: -12,
    left: 24,
    background: 'var(--violet)',
    color: '#fff',
    padding: '6px 16px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.05em',
  },
  planHeader: {
    marginTop: 8,
  },
  planName: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 12,
  },
  planNameFeatured: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--violet-bright)',
    marginBottom: 12,
  },
  planPrice: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontFamily: 'var(--font-display)',
    fontSize: 44,
    fontWeight: 800,
    color: 'var(--text)',
  },
  priceFeatured: {
    fontFamily: 'var(--font-display)',
    fontSize: 44,
    fontWeight: 800,
    color: 'var(--violet-bright)',
  },
  period: {
    fontSize: 14,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-display)',
  },
  periodFeatured: {
    fontSize: 14,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
  },
  featuresList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flex: 1,
  },
  feature: {
    fontSize: 14,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
    lineHeight: 1.5,
  },
  featuresListFeatured: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flex: 1,
  },
  featureFeatured: {
    fontSize: 14,
    color: 'var(--violet-bright)',
    fontFamily: 'var(--font-display)',
    lineHeight: 1.5,
    fontWeight: 500,
  },
  buttonFree: {
    padding: '12px 24px',
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    display: 'block',
  },
  buttonTeam: {
    padding: '12px 24px',
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    display: 'block',
  },
  buttonPro: {
    display: 'block',
    padding: '12px 24px',
    background: 'var(--violet)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    border: 'none',
  },
  faqSection: {
    marginBottom: 60,
  },
  faqTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 32,
    fontWeight: 800,
    color: 'var(--text)',
    textAlign: 'center',
    marginBottom: 40,
  },
  faqGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 28,
  },
  faqItem: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
  },
  faqQuestion: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: 'var(--text-2)',
    lineHeight: 1.6,
    fontFamily: 'var(--font-display)',
  },
  ctaStrip: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
  },
  ctaTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 6,
  },
  ctaSub: {
    fontSize: 14,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-display)',
  },
  ctaButton: {
    padding: '12px 28px',
    background: 'var(--violet)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    whiteSpace: 'nowrap',
    display: 'inline-block',
  },
};
