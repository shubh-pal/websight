import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function useAdminOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/overview', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));

      if (res.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }

      if (!res.ok) {
        throw new Error(body.error || 'Failed to load admin overview');
      }

      setData(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return { data, loading, error, loadOverview };
}
