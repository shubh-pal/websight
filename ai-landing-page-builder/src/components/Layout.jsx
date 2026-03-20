import React from 'react';
import Header from './Header';
import Footer from './Footer';
import '../styles/tokens.css';

export default function Layout({ children }) {
  return (
    <>
      
      <Header />
      <main className="layout-main">
        {children}
      </main>
      <Footer />
    </>
  );
}