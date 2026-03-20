import React, { useRef, useEffect, useState } from 'react';

const testimonialsData = [
  {
    name: "Sarah Chen",
    role: "Founder, Bloom & Grow Organics",
    quote: "Before AI Landing Page Builder, launching a new product meant weeks of back-and-forth with designers, costing a fortune. With this platform, I built a stunning, conversion-optimized page for our new sustainable skincare line in just an afternoon. We saw a 45% uplift in pre-orders within the first 72 hours – it's completely transformed our launch strategy and saved us over $5,000 in design fees.",
    avatarInitials: "SC",
    featured: true,
  },
  {
    name: "Mark Ramirez",
    role: "Head of Digital Marketing, InnovateTech Solutions",
    quote: "Our agency constantly needs fresh landing pages for client campaigns. AI Landing Page Builder cut our average page creation time by 80%, from days to mere hours. This efficiency allowed us to take on 3 additional clients last quarter, directly impacting our bottom line and client satisfaction. The AI suggestions are uncannily good at hitting brand voice.",
    avatarInitials: "MR",
    featured: false,
  },
  {
    name: "Emily White",
    role: "Solo Entrepreneur & Course Creator",
    quote: "As a solo entrepreneur, my time is precious. I needed a professional sales page for my new online course, but didn't have the budget for a web developer. AI Landing Page Builder delivered a polished, high-converting page that perfectly captured my brand. My course enrollment jumped by 25% in the first month, and I finally feel confident directing traffic to a page that truly sells.",
    avatarInitials: "EW",
    featured: false,
  },
];

const TestimonialsSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Stop observing once visible
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1, // Trigger when 10% of the section is visible
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

  const featuredTestimonial = testimonialsData.find(t => t.featured);
  const otherTestimonials = testimonialsData.filter(t => !t.featured);

  return (
    <>
      <section ref={sectionRef} className={`testimonials-section ${isVisible ? 'is-visible' : ''}`}>
      <div className="testimonials-container">
        <p className="testimonials-eyebrow">TRUSTED BY LEADING SAAS COMPANIES & ENTREPRENEURS</p>
        <h2 className="testimonials-heading">Real Stories, Real Impact</h2>

        <div className="testimonials-grid">
          {featuredTestimonial && (
            <div
              className={`testimonials-card testimonials-card-featured ${isVisible ? 'fade-up' : ''}`}
              style={{ '--animation-delay': '0s' }}
            >
              <div className="testimonials-stars" aria-label="5 star rating">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="testimonials-star-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 18.896l-7.416 3.817 1.48-8.279L0 9.306l8.332-1.151L12 .587z"/>
                  </svg>
                ))}
              </div>
              <blockquote className="testimonials-quote">
                <span className="testimonials-quote-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.999 12.12c0-2.22 1.21-3.64 3.01-4.24l.6-.2c.5-.16.89-.66.89-1.22 0-.7-.57-1.27-1.27-1.27-.47 0-.9.26-1.13.68l-.2.38c-.3.57-1.02.8-1.59.5-.57-.3-.8-1.02-.5-1.59l.2-.38c.7-1.32 2.15-2.18 3.79-2.18 2.22 0 4.03 1.81 4.03 4.03 0 1.95-1.4 3.48-3.32 4.08l-.6.2c-.5.16-.89.66-.89 1.22 0 .7.57 1.27 1.27 1.27.47 0 .9-.26 1.13-.68l.2-.38c-.3.57 1.02-.8 1.59-.5.57.3.8 1.02.5 1.59l-.2.38c-.7 1.32-2.15 2.18-3.79 2.18-2.22 0-4.03-1.81-4.03-4.03zM0 12.12c0-2.22 1.21-3.64 3.01-4.24l.6-.2c.5-.16.89-.66.89-1.22 0-.7-.57-1.27-1.27-1.27-.47 0-.9.26-1.13.68l-.2.38c-.3.57-1.02.8-1.59.5-.57-.3-.8-1.02-.5-1.59l.2-.38c.7-1.32 2.15-2.18 3.79-2.18 2.22 0 4.03 1.81 4.03 4.03 0 1.95-1.4 3.48-3.32 4.08l-.6.2c-.5.16-.89.66-.89 1.22 0 .7.57 1.27 1.27 1.27.47 0 .9-.26 1.13-.68l.2-.38c-.3.57 1.02-.8 1.59-.5.57.3.8 1.02.5 1.59l-.2.38c-.7 1.32-2.15 2.18-3.79 2.18-2.22 0-4.03-1.81-4.03-4.03z"/>
                  </svg>
                </span>
                {featuredTestimonial.quote}
              </blockquote >
              <hr className="testimonials-divider" />
              <div className="testimonials-author-info">
                <div className="testimonials-avatar">{featuredTestimonial.avatarInitials}</div>
                <div className="testimonials-author-details">
                  <p className="testimonials-author-name">{featuredTestimonial.name}</p>
                  <p className="testimonials-author-role">{featuredTestimonial.role}</p>
                </div>
              </div>
            </div>
          )}

          <div className="testimonials-right-column">
            {otherTestimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`testimonials-card ${isVisible ? 'fade-up' : ''}`}
                style={{ '--animation-delay': `${(index + 1) * 0.1}s` }}
              >
                <div className="testimonials-stars" aria-label="5 star rating">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className="testimonials-star-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 18.896l-7.416 3.817 1.48-8.279L0 9.306l8.332-1.151L12 .587z"/>
                    </svg>
                  ))}
                </div>
                <blockquote className="testimonials-quote">
                  <span className="testimonials-quote-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.999 12.12c0-2.22 1.21-3.64 3.01-4.24l.6-.2c.5-.16.89-.66.89-1.22 0-.7-.57-1.27-1.27-1.27-.47 0-.9.26-1.13.68l-.2.38c-.3.57-1.02.8-1.59.5-.57-.3-.8-1.02-.5-1.59l.2-.38c.7-1.32 2.15-2.18 3.79-2.18 2.22 0 4.03 1.81 4.03 4.03 0 1.95-1.4 3.48-3.32 4.08l-.6.2c-.5.16-.89.66-.89 1.22 0 .7.57 1.27 1.27 1.27.47 0 .9-.26 1.13-.68l.2-.38c-.3.57 1.02-.8 1.59-.5.57.3.8 1.02.5 1.59l-.2.38c-.7 1.32-2.15 2.18-3.79 2.18-2.22 0-4.03-1.81-4.03-4.03zM0 12.12c0-2.22 1.21-3.64 3.01-4.24l.6-.2c.5-.16.89-.66.89-1.22 0-.7-.57-1.27-1.27-1.27-.47 0-.9.26-1.13.68l-.2.38c-.3.57-1.02.8-1.59.5-.57-.3-.8-1.02-.5-1.59l.2-.38c.7-1.32 2.15-2.18 3.79-2.18 2.22 0 4.03 1.81 4.03 4.03 0 1.95-1.4 3.48-3.32 4.08l-.6.2c-.5.16-.89.66-.89 1.22 0 .7.57 1.27 1.27 1.27.47 0 .9-.26 1.13-.68l.2-.38c-.3.57 1.02-.8 1.59-.5.57.3.8 1.02.5 1.59l-.2.38c-.7 1.32-2.15 2.18-3.79 2.18-2.22 0-4.03-1.81-4.03-4.03z"/>
                    </svg>
                  </span>
                  {testimonial.quote}
                </blockquote >
                <hr className="testimonials-divider" />
                <div className="testimonials-author-info">
                  <div className="testimonials-avatar">{testimonial.avatarInitials}</div>
                  <div className="testimonials-author-details">
                    <p className="testimonials-author-name">{testimonial.name}</p>
                    <p className="testimonials-author-role">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    </>
  );
};

export default TestimonialsSection;