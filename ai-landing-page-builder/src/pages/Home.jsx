import React, { useRef, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Testimonials from '../components/Testimonials';
import CTA from '../components/CTA';
import Stats from '../components/Stats';
import '../styles/tokens.css';

// Simple SVG Icons for Features
const IconLightbulb = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l-3 3M9 18V5l3 3M9 18h6M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zM12 2v6h4l-4 4v-6h-4l4-4z" />
  </svg>
);

const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    <line x1="2.1" y1="12" x2="21.9" y2="12" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .3 1.62l.8 1.1a.67.67 0 0 1-.9 1.01l-1.2-.42a1.65 1.65 0 0 0-1.65.32l-.8 1.1a.67.67 0 0 1-1.01-.9l.42-1.2a1.65 1.65 0 0 0-.32-1.65l-1.1-.8a.67.67 0 0 1 .9-1.01l1.2.42a1.65 1.65 0 0 0 1.65-.32l.8-1.1a.67.67 0 0 1 1.01.9l-.42 1.2a1.65 1.65 0 0 0 .32 1.65z" />
    <path d="M19.4 9a1.65 1.65 0 0 1 .3-1.62l.8-1.1a.67.67 0 0 1-.9-1.01l-1.2.42a1.65 1.65 0 0 1-1.65-.32l-.8-1.1a.67.67 0 0 1-1.01.9l.42 1.2a1.65 1.65 0 0 1-.32 1.65l-1.1.8a.67.67 0 0 1 .9 1.01l1.2-.42a1.65 1.65 0 0 1 1.65.32l.8 1.1a.67.67 0 0 1 1.01-.9l-.42-1.2a1.65 1.65 0 0 1 .32-1.65z" />
    <path d="M4.6 15a1.65 1.65 0 0 1-.3 1.62l-.8 1.1a.67.67 0 0 1 .9 1.01l1.2-.42a1.65 1.65 0 0 1 1.65.32l.8 1.1a.67.67 0 0 1 1.01-.9l-.42-1.2a1.65 1.65 0 0 1 .32-1.65l1.1-.8a.67.67 0 0 1-.9-1.01l-1.2.42a1.65 1.65 0 0 1-1.65-.32l-.8-1.1a.67.67 0 0 1-1.01.9l.42 1.2a1.65 1.65 0 0 1-.32 1.65z" />
    <path d="M4.6 9a1.65 1.65 0 0 0-.3-1.62l-.8-1.1a.67.67 0 0 0 .9-1.01l1.2.42a1.65 1.65 0 0 0 1.65-.32l.8-1.1a.67.67 0 0 0 1.01.9l-.42 1.2a1.65 1.65 0 0 0 .32 1.65l1.1.8a.67.67 0 0 0-.9 1.01l-1.2-.42a1.65 1.65 0 0 0-1.65.32l-.8 1.1a.67.67 0 0 0-1.01-.9l.42-1.2a1.65 1.65 0 0 0-.32-1.65z" />
  </svg>
);

// Custom hook for scroll animation
const useScrollAnimation = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target); // Stop observing once visible
        }
      },
      { threshold: threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);

  return [ref, isVisible];
};


export default function Home() {
  const [heroRef, heroVisible] = useScrollAnimation(0.3);
  const [featuresAiRef, featuresAiVisible] = useScrollAnimation();
  const [featuresStepsRef, featuresStepsVisible] = useScrollAnimation();
  const [testimonialsRef, testimonialsVisible] = useScrollAnimation();
  const [statsRef, statsVisible] = useScrollAnimation();
  const [ctaRef, ctaVisible] = useScrollAnimation();

  const aiFeatures = [
    {
      title: "Intelligent Content Generation",
      description: "AI crafts compelling headlines, body text, and calls-to-action tailored to your audience and goals, ensuring maximum engagement.",
      icon: <IconLightbulb />,
    },
    {
      title: "Conversion Optimization",
      description: "Our AI analyzes user behavior and market trends to suggest layout and content improvements for superior conversion rates.",
      icon: <IconTarget />,
    },
    {
      title: "Multi-Platform Adaptability",
      description: "Automatically generate pages optimized for desktop, tablet, and mobile, guaranteeing a flawless user experience on any device.",
      icon: <IconGlobe />,
    },
    {
      title: "Brand Voice Consistency",
      description: "Maintain your unique brand voice and messaging across all generated content with AI-driven style guidance and customization.",
      icon: <IconSettings />,
    },
  ];

  const threeSteps = [
    {
      title: "Describe Your Vision",
      description: "Simply tell our AI about your product, target audience, and campaign goals. A few keywords are all it takes to ignite the creation process.",
      stepNumber: "1",
    },
    {
      title: "AI Generates & Optimizes",
      description: "Watch as our AI instantly drafts a complete, high-converting landing page, meticulously optimized for your specific needs and objectives.",
      stepNumber: "2",
    },
    {
      title: "Publish & Analyze",
      description: "Launch your polished page with a single click and track its performance with built-in analytics to continuously refine your strategy for success.",
      stepNumber: "3",
    },
  ];

  const pageExamples = [
    {
      imageSrc: "https://via.placeholder.com/600x400/A78BFA/FFFFFF?text=SaaS+Product+Launch",
      imageAlt: "AI-generated landing page for a SaaS product launch",
      tag: "Generated by AI",
      details: "Optimized for early lead capture and product interest.",
    },
    {
      imageSrc: "https://via.placeholder.com/600x400/0891B2/FFFFFF?text=E-commerce+Flash+Sale",
      imageAlt: "AI-generated landing page for an e-commerce flash sale",
      tag: "Generated by AI",
      details: "High-impact design for urgent sales and conversions.",
    },
    {
      imageSrc: "https://via.placeholder.com/600x400/7C3AED/FFFFFF?text=Webinar+Registration",
      imageAlt: "AI-generated landing page for webinar registration",
      tag: "Generated by AI",
      details: "Seamless sign-up flow to maximize attendee numbers.",
    },
    {
      imageSrc: "https://via.placeholder.com/600x400/A78BFA/FFFFFF?text=Consulting+Service+Showcase",
      imageAlt: "AI-generated landing page for a consulting service showcase",
      tag: "Generated by AI",
      details: "Authority-building design to attract premium clients.",
    },
  ];

  const companyStats = [
    { value: "100K+", label: "Pages Built" },
    { value: "10X", label: "Faster Creation" },
    { value: "92%", label: "User Satisfaction" },
    { value: "50+", label: "Industry Templates" },
  ];

  return (
    <Layout
      title="AI Landing Page Builder & Free AI Website Builder"
      description="Create stunning AI landing pages in seconds with our free AI website builder. Fast, simple, and powerful AI landing page generator for your business."
      logoUrl="https://cdn.landing-page.io/landingpage_io/image/logo.webp?x-oss-process=image/resize,w_96"
      brandName="AI Landing Page Builder"
    >
      <div ref={heroRef} className={`home-hero-section ${heroVisible ? 'fade-up' : ''}`}>
        <Hero
          headline="Build Stunning AI Landing Pages Instantly"
          subheadline="Leverage the power of AI to create high-converting landing pages in minutes, not days. No coding required."
          ctaText="Start for Free"
          ctaLink="#"
          imageSrc="/hero-mockup.webp"
          imageAlt="AI Landing Page Builder UI actively building a page with dynamic elements and a subtle gradient background"
        />
      </div>

      <div ref={featuresAiRef} className={`home-features-ai-capabilities-section ${featuresAiVisible ? 'fade-up' : ''}`}>
        <Features
          headline="Built for Conversion, Powered by AI"
          subheadline="Our platform integrates cutting-edge AI to optimize every aspect of your landing page, ensuring maximum impact and effortless creation."
          features={aiFeatures}
          layoutType="bento-grid"
        />
      </div>

      <div ref={featuresStepsRef} className={`home-features-3-steps-section ${featuresStepsVisible ? 'fade-up' : ''}`}>
        <Features
          headline="From Idea to Live Page in 3 Steps"
          subheadline="Our intuitive AI-powered process makes launching your next landing page incredibly simple and fast."
          features={threeSteps}
          layoutType="timeline"
        />
      </div>

      <div ref={testimonialsRef} className={`home-testimonials-examples-section ${testimonialsVisible ? 'fade-up' : ''}`}>
        <Testimonials
          headline="See what it can create"
          subheadline="Explore a gallery of stunning, high-converting landing pages generated by our AI for diverse industries."
          testimonials={pageExamples}
          layoutType="carousel"
        />
      </div>

      <div ref={statsRef} className={`home-stats-section ${statsVisible ? 'fade-up' : ''}`}>
        <Stats
          headline="AI Website Design: Build Professional Websites in Minutes"
          subheadline="Join thousands of businesses already transforming their online presence with AI."
          stats={companyStats}
        />
      </div>

      <div ref={ctaRef} className={`home-cta-section ${ctaVisible ? 'fade-up' : ''}`}>
        <CTA
          headline="Unlock Your Vision. Instantly."
          subheadline="Experience the future of web creation. Start building your high-converting landing pages today."
          ctaText="Start for Free"
          ctaLink="#"
        />
      </div>
    </Layout>
  );
}