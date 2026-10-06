import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(load: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const run = useCallback(() => {
    const currentRequest = ++requestId.current;
    setLoading(true); setError('');
    Promise.resolve().then(load)
      .then((next) => { if (requestId.current === currentRequest) setData(next); })
      .catch((reason: Error) => { if (requestId.current === currentRequest) setError(reason.message); })
      .finally(() => { if (requestId.current === currentRequest) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => {
    run();
    return () => { requestId.current += 1; };
  }, [run]);
  return { data, loading, error, retry: run };
}
