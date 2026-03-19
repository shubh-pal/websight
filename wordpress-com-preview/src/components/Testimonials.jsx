import React from 'react';

const Testimonials = () => {
  const testimonialsData = [
    {
      id: 1,
      name: "Riya Sharma",
      role: "Travel Blogger, 'Wanderlust Chronicles'",
      quote: "Before WordPress.com, managing my travel blog felt like a constant battle with code. Within a week, I migrated 50+ articles, integrated my newsletter, and saw a 30% increase in reader engagement thanks to the intuitive editor and robust SEO tools. It truly transformed my passion into a professional platform.",
      avatarInitials: "RS",
    },
    {
      id: 2,
      name: "Ankit Patel",
      role: "Founder, 'Artisan Bites'",
      quote: "Launching 'Artisan Bites' online seemed daunting until we found WordPress.com. We built our entire e-commerce store in under two weeks, processing our first 100 orders seamlessly. The integrated payment gateways and inventory management saved us countless hours, allowing us to focus on our craft, not our website backend.",
      avatarInitials: "AP",
    },
    {
      id: 3,
      name: "Priya Singh",
      role: "Freelance Graphic Designer",
      quote: "As a freelance graphic designer, my portfolio is my storefront. WordPress.com gave me the creative freedom to showcase my work with stunning galleries and custom layouts, without needing a developer. Clients consistently praise the site's professional aesthetic, which has directly led to a 25% uplift in project inquiries this quarter.",
      avatarInitials: "PS",
    },
  ];

  return (
    <>
      <section className="test-section">
        <div className="test-container">
          <span className="test-eyebrow">TRUSTED BY CREATORS & BUSINESSES</span>
          <h2 className="test-heading">
            Hear From Those Who Build With WordPress.com
          </h2>
          <div className="test-grid">
            {testimonialsData.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className={`test-card ${index === 1 ? 'test-card-featured' : ''}`}
              >
                <span className="test-quote-mark">“</span>
                <div className="test-stars" aria-label="5 star rating">
                  ★★★★★
                </div>
                <p className={`test-quote ${index === 1 ? 'test-quote-featured' : ''}`}>
                  {testimonial.quote}
                </p>
                <hr className="test-divider" />
                <div className="test-author-info">
                  <div className="test-avatar">
                    {testimonial.avatarInitials}
                  </div>
                  <div className="test-author-details">
                    <strong>{testimonial.name}</strong>
                    <span>{testimonial.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Testimonials;