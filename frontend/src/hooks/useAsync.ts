import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(load: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const run = useCallback(() => {
    setLoading(true); setError('');
    load().then(setData).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(run, [run]);
  return { data, loading, error, retry: run };
}
