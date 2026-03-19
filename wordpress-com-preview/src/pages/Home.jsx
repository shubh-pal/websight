import Layout from '../components/Layout';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Stats from '../components/Stats';
import Testimonials from '../components/Testimonials';
import CTA from '../components/CTA';
import '../styles/tokens.css';

export default function Home() {
  return (
    <Layout>
      <Hero />
      <Features />
      <Stats />
      <Testimonials />
      <CTA />
    </Layout>
  );
}
