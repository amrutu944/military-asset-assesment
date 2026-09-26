import { useEffect, useState, useCallback } from 'react';
import API from '../api/axios';

// GET a list/summary endpoint; refetches whenever path or params change
export function useApi(path, params) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const key = JSON.stringify(params || {});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(path, { params: JSON.parse(key) });
      const { data: payload, ...rest } = res.data;
      setData(payload);
      setMeta(rest);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [path, key]);

  useEffect(() => { load(); }, [load]);
  return { data, meta, loading, error, reload: load };
}
