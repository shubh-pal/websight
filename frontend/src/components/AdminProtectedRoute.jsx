import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/auth/admin/me', { credentials: 'include' })
      .then((res) => {
        if (!cancelled) setAuthed(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading admin session...</div>;
  }

  if (!authed) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#0b1020',
    color: '#e2e8f0',
    fontSize: 16,
  },
};
