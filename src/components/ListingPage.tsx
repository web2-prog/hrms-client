import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

type Props = {
  title: string;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  total: number;
  onRefresh: () => void;
  children: React.ReactNode;
};

export function ListingPage({
  title,
  searchPlaceholder = 'Search…',
  filters,
  actions,
  loading,
  error,
  empty,
  total,
  onRefresh,
  children,
}: Props) {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const limit = Number(params.get('limit') || 10);
  const search = params.get('search') || '';
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => setLocalSearch(search), [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (localSearch) next.set('search', localSearch);
      else next.delete('search');
      next.set('page', '1');
      if (localSearch !== search) setParams(next);
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  const setPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };

  const setLimit = (l: number) => {
    const next = new URLSearchParams(params);
    next.set('limit', String(l));
    next.set('page', '1');
    setParams(next);
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="page-header">
        <h1>{title}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{actions}</div>
      </div>
      <div className="card card-accent">
        <div className="listing-toolbar">
          <input
            className="input search"
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {filters}
          <div className="right">
            <button type="button" className="btn btn-ghost btn-icon" title="Refresh" onClick={onRefresh}>
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
        {loading && <div className="state-box">Loading…</div>}
        {error && !loading && <div className="state-box" style={{ color: 'var(--error)' }}>{error}</div>}
        {!loading && !error && empty && <div className="state-box">No records found</div>}
        {!loading && !error && !empty && children}
        <div className="pagination">
          <span>Total: {total}</span>
          <select
            className="select"
            style={{ width: 90 }}
            value={limit >= 10000 ? 10000 : limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={10000}>All</option>
          </select>
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>
          <span>
            Page {page} / {pages}
          </span>
          <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function useListParams() {
  const [params, setParams] = useSearchParams();
  return useMemo(
    () => ({
      page: Number(params.get('page') || 1),
      limit: Number(params.get('limit') || 10),
      search: params.get('search') || '',
      get: (k: string) => params.get(k) || '',
      setFilter: (k: string, v: string) => {
        const next = new URLSearchParams(params);
        if (v) next.set(k, v);
        else next.delete(k);
        next.set('page', '1');
        setParams(next);
      },
      params,
      setParams,
    }),
    [params, setParams]
  );
}

export function useListFetch<T>(fetcher: (q: string) => Promise<{ data: T[]; total: number }>, deps: unknown[]) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetcher('');
        if (!cancelled) {
          setData(res.data);
          setTotal(res.total);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick, ...deps]);

  return { data, total, loading, error, refresh, setData };
}
