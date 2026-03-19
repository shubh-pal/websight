import React from 'react';

const FeaturesSection = () => {
  const features = [
    {
      title: "एकीकृत होस्टिंग",
      subtitle: "Integrated Hosting",
      description: "अपनी वेबसाइट के लिए बिल्ट-इन, विश्वसनीय होस्टिंग का लाभ उठाएं, जो बेहतरीन प्रदर्शन और सुरक्षा सुनिश्चित करती है।",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 15H9V17H11V15ZM11 7H9V13H11V7ZM15 15H13V17H15V15ZM15 7H13V13H15V7Z" fill="currentColor"/>
        </svg>
      ),
      isLarge: true,
    },
    {
      title: "सहज वेबसाइट बिल्डर",
      subtitle: "Intuitive Site Builder",
      description: "ड्रैग-एंड-ड्रॉप एडिटर और कस्टमाइज़ेबल थीम्स के साथ, बिना किसी कोडिंग के अपनी वेबसाइट बनाएं।",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 13H11V3H3V13ZM3 21H11V15H3V21ZM13 21H21V11H13V21ZM13 3V9H21V3H13Z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      title: "शक्तिशाली SEO उपकरण",
      subtitle: "Powerful SEO Tools",
      description: "अपनी सर्च रैंकिंग को बढ़ावा देने के लिए बिल्ट-इन टूल्स और इंटीग्रेशन का उपयोग करें।",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19.25 20.75L20.75 19.25L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      title: "ई-कॉमर्स के लिए तैयार",
      subtitle: "E-commerce Ready",
      description: "WooCommerce के साथ ऑनलाइन स्टोर के लिए सहज एकीकरण, अपने व्यवसाय को बढ़ाएं।",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 18C5.9 18 5.01 18.9 5.01 20C5.01 21.1 5.9 22 7 22C8.1 22 9 21.1 9 20C9 18.9 8.1 18 7 18ZM17 18C15.9 18 15.01 18.9 15.01 20C15.01 21.1 15.9 22 17 22C18.1 22 19 21.1 19 20C19 18.9 18.1 18 17 18ZM7.2 14.47L7.96 16H18V13H9.27L8.4 11H21V4H7.2L6.4 2H2V4H4.2L7.12 10.68L5.7 13.25L7.2 14.47ZM6 4H21V11H8.4L6 4Z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      title: "वैश्विक समुदाय और समर्थन",
      subtitle: "Global Community & Support",
      description: "एक विशाल समुदाय और विशेषज्ञ सहायता तक पहुंच प्राप्त करें, जो आपकी हर ज़रूरत में मदद करेगा।",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C14.21 4 16 5.79 16 8C16 10.21 14.21 12 12 12C9.79 12 8 10.21 8 8C8 5.79 9.79 4 12 4ZM12 20C9.03 20 4.97 18.36 4 16.5C4.03 14.77 8.05 13 12 13C15.95 13 19.97 14.77 20 16.5C19.03 18.36 14.97 20 12 20Z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      title: "स्केलेबल और सुरक्षित",
      subtitle: "Scalable & Secure",
      description: "एंटरप्राइज़-ग्रेड सुरक्षा, स्वचालित बैकअप और अपडेट के साथ अपनी साइट को सुरक्षित रखें।",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 11.99H19C18.47 16.14 15.72 19.73 12 20.93V12H5V6.3L12 3.19V11.99Z" fill="currentColor"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      <section className="feat-section">
        <div className="feat-container">
          <div className="feat-header">
            <p className="feat-eyebrow">WHY CHOOSE WORDPRESS.COM</p>
            <h2 className="feat-heading">
              WordPress, जैसा होना चाहिए
              <br />
              <span style={{ color: "var(--primary)", display: "block", fontSize: "0.7em", fontWeight: "700", marginTop: "8px" }}>The WordPress You Deserve</span>
            </h2>
            <p className="feat-subtext">
              WordPress.com के साथ, आपको वह सब कुछ मिलता है जिसकी आपको एक शक्तिशाली और उपयोग में आसान वेबसाइट बनाने के लिए आवश्यकता है।
              बिल्ट-इन होस्टिंग, शानदार थीम्स और आवश्यक उपकरण — बिना किसी तकनीकी झंझट के।
            </p>
          </div>

          <div className="feat-grid">
            {/* Large dominant card (left 40%) */}
            <div className="feat-card feat-card--large">
              <div className="feat-card-icon-wrapper">
                {features[0].icon}
              </div>
              <div className="feat-card-content">
                <h3 className="feat-card-title">{features[0].title}</h3>
                <p className="feat-card-subtitle">{features[0].subtitle}</p>
                <p className="feat-card-description">{features[0].description}</p>
              </div>
            </div>

            {/* Smaller cards (right 60%, 2x2 grid) */}
            <div className="feat-small-cards-grid">
              {features.slice(1).map((feature, index) => (
                <div key={index} className="feat-card">
                  <div className="feat-card-icon-wrapper">
                    {feature.icon}
                  </div>
                  <div className="feat-card-content">
                    <h3 className="feat-card-title">{feature.title}</h3>
                    <p className="feat-card-subtitle">{feature.subtitle}</p>
                    <p className="feat-card-description">{feature.description}</p>
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

export default FeaturesSection;