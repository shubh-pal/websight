import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Result from './pages/Result';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import AdminUsers from './pages/AdminUsers';
import AdminWebsites from './pages/AdminWebsites';
import AdminContacts from './pages/AdminContacts';
import LeadsPipeline from './pages/admin/LeadsPipeline';
import LeadDetail from './pages/admin/LeadDetail';

import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';

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
  const gaMeasurementId = 'G-JYWH1C2KFJ';

  useEffect(() => {
    if (window.gtag) {
      window.gtag('config', gaMeasurementId, {
        page_path: location.pathname + location.search,
      });
    }
  }, [gaMeasurementId, location]);

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
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminProtectedRoute><Admin /></AdminProtectedRoute>} />
        <Route path="/admin/dashboard" element={<AdminProtectedRoute><Admin /></AdminProtectedRoute>} />
        <Route path="/admin/users" element={<AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>} />
        <Route path="/admin/websites" element={<AdminProtectedRoute><AdminWebsites /></AdminProtectedRoute>} />
        <Route path="/admin/websites/:jobId" element={<AdminProtectedRoute><Result /></AdminProtectedRoute>} />
        <Route path="/admin/contacts" element={<AdminProtectedRoute><AdminContacts /></AdminProtectedRoute>} />
        <Route path="/admin/leads" element={<AdminProtectedRoute><LeadsPipeline /></AdminProtectedRoute>} />
        <Route path="/admin/leads/:id" element={<AdminProtectedRoute><LeadDetail /></AdminProtectedRoute>} />

        {/* /app alias for the agency pipeline */}
        <Route path="/app" element={<AdminProtectedRoute><LeadsPipeline /></AdminProtectedRoute>} />
        <Route path="/app/leads/:id" element={<AdminProtectedRoute><LeadDetail /></AdminProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
