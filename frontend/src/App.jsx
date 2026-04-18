import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Result from './pages/Result';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

import ProtectedRoute from './components/ProtectedRoute';

function getVisitorId() {
  const storageKey = 'websight_visitor_id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const created = `v_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(storageKey, created);
  return created;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (window.gtag) {
      window.gtag('config', 'G-XXXXXXXXXX', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);

  useEffect(() => {
    const visitorId = getVisitorId();
    const payload = JSON.stringify({
      visitorId,
      path: location.pathname + location.search,
      referrer: document.referrer || '',
    });

    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: payload,
    }).catch(() => {});
  }, [location.pathname, location.search]);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/result/:jobId" element={<ProtectedRoute><Result /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
