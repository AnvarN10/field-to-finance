"use client";

import { useCallback, useEffect, useState } from "react";

export function useJson<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
        if (!cancelled) setData(body as T);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Request failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  return { data, error, loading, reload: useCallback(() => setNonce((n) => n + 1), []) };
}
