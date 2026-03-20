import React, { useRef, useEffect, useState } from 'react';

const FeaturesSection = () => {
  const features = [
    {
      title: "AI-Powered Content Generation",
      description: "Craft compelling headlines, body text, and CTAs instantly with our intelligent AI, tailored to your brand voice and audience.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      size: "large"
    },
    {
      title: "Drag-and-Drop Visual Editor",
      description: "Effortlessly customize every element with an intuitive drag-and-drop interface, ensuring pixel-perfect design without a single line of code.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      ),
      size: "medium"
    },
    {
      title: "Conversion-Optimized Templates",
      description: "Start with professionally designed, high-converting templates across various industries, all optimized for mobile and SEO.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
      size: "medium"
    },
    {
      title: "Real-time Analytics & A/B Testing",
      description: "Track visitor behavior, conversion rates, and run A/B tests directly within the platform to continuously refine and improve your pages.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
          <path d="M3 20h18" />
          <path d="M4 18l5-6 6 6 4-4" />
        </svg>
      ),
      size: "small"
    },
    {
      title: "Seamless CRM & Marketing Integrations",
      description: "Connect with your favorite CRM, email marketing, and analytics tools to automate workflows and nurture leads effectively.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      ),
      size: "small"
    },
    {
      title: "Dynamic SEO Optimization",
      description: "Generate meta titles, descriptions, and alt tags automatically, ensuring your landing pages rank higher and attract more organic traffic.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      ),
      size: "small"
    }
  ];

  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <>
      <section ref={sectionRef} className={`feat-section ${isVisible ? 'is-visible' : ''}`}>
      <div className="feat-section-header">
        <p className="feat-eyebrow">WHY CHOOSE AI LANDING PAGE BUILDER</p>
        <h2 className="feat-heading">Built for Conversion, Powered by AI</h2>
        <p className="feat-subtext">
          Harness the power of artificial intelligence to create high-performing landing pages that captivate your audience and drive results.
        </p>
      </div>

      <div className="feat-grid">
        {features.map((feature, index) => (
          <div key={index} className={`feat-card feat-card-${feature.size}`}>
            <div className="feat-card-bg-pattern"></div>
            <div className="feat-card-frosted-overlay"></div>
            <div className="feat-card-content">
              <div className="feat-card-icon-wrapper">
                {feature.icon}
              </div>
              <h3 className="feat-card-title">{feature.title}</h3>
              <p className="feat-card-description">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
    </>
  );
};

export default FeaturesSection;