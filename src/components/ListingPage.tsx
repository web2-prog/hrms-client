import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const PAGE_SIZE = 8;

type Props = {
  title?: string;
  subtitle?: string;
  /** Rendered between the page header and the list card. */
  prepend?: React.ReactNode;
  searchPlaceholder?: string;
  hideSearch?: boolean;
  /** Hides the pagination row (used by calendar-style views that show everything). */
  hidePagination?: boolean;
  filters?: React.ReactNode;
  typeFilters?: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  total: number;
  onRefresh: () => void;
  children: React.ReactNode;
};

type ListPaginationProps = {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
};

export function ListPagination({ total, page, onPageChange, pageSize = PAGE_SIZE }: ListPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), pages);
  return (
    <div className="pagination">
      <span>Total: {total}</span>
      <span>{pageSize} per page</span>
      <Button variant="outline" disabled={pageSafe <= 1} onClick={() => onPageChange(pageSafe - 1)}>
        Prev
      </Button>
      <span>
        Page {pageSafe} / {pages}
      </span>
      <Button variant="outline" disabled={pageSafe >= pages} onClick={() => onPageChange(pageSafe + 1)}>
        Next
      </Button>
    </div>
  );
}

export function ListingPage({
  title,
  subtitle,
  prepend,
  searchPlaceholder = 'Search…',
  hideSearch,
  hidePagination,
  filters,
  typeFilters,
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
  const search = params.get('search') || '';
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => setLocalSearch(search), [search]);

  useEffect(() => {
    if (hideSearch) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (localSearch) next.set('search', localSearch);
      else next.delete('search');
      next.set('page', '1');
      if (localSearch !== search) setParams(next);
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, hideSearch]);

  const setPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };

  return (
    <div>
      {title ? (
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="page-header-sub">{subtitle}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{actions}</div>
      </div>
      ) : null}
      {prepend}
      <div className="card">
        <div className="listing-toolbar">
          {filters}
          {!hideSearch && (
            <Input
              className="search"
              placeholder={searchPlaceholder}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          )}
          <div className="right">
            {typeFilters}
            <Button type="button" variant="outline" size="icon" title="Refresh" onClick={onRefresh}>
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>
        {loading && <div className="state-box">Loading…</div>}
        {error && !loading && (
          <div className="state-box" style={{ color: 'var(--error)', whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}
        {!loading && empty && !error && <div className="state-box">No records found</div>}
        {!loading && !empty && children}
        {!hidePagination && (
          <ListPagination total={total} page={page} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}

export function useListParams() {
  const [params, setParams] = useSearchParams();
  return useMemo(
    () => ({
      page: Number(params.get('page') || 1),
      limit: PAGE_SIZE,
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
