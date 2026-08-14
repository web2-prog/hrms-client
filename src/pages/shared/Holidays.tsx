import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarOff, Plane, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type HolidayType = 'Saturday' | 'Festival' | 'Vacation' | 'Manual';

type Holiday = {
  _id: string;
  type: HolidayType;
  name?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  day?: string;
  year?: number;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateParts(d?: string) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return null;
  return { y, m, day };
}

export function HolidaysPage({ canManage = true }: { canManage?: boolean }) {
  const list = useListParams();
  const { user } = useAuth();
  const manage = canManage && (user?.role === 'admin' || user?.role === 'hr');
  const [data, setData] = useState<Holiday[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  const year = list.get('year') || '2026';

  // Year snapshot for the summary strip (independent of search/pagination).
  const [snapshot, setSnapshot] = useState<Holiday[] | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({ page: list.page, limit: list.limit, search: list.search, year, type: list.get('type') });
      const res = await api<ListResult<Holiday>>(`/holidays${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshot = async () => {
    try {
      const res = await api<ListResult<Holiday>>(`/holidays?year=${year}&limit=100`);
      setSnapshot(res.data);
    } catch {
      setSnapshot(null);
    }
  };

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);

  useEffect(() => { loadSnapshot(); }, [year]);

  const counts = useMemo(() => {
    const c = { total: snapshot?.length ?? 0, Festival: 0, Saturday: 0, Vacation: 0, Manual: 0 };
    for (const h of snapshot || []) {
      if (h.type in c) c[h.type as keyof typeof c] += 1;
    }
    return c;
  }, [snapshot]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteErr('');
    try {
      await api(`/holidays/${deleting._id}`, { method: 'DELETE' });
      setDeleting(null);
      load();
      loadSnapshot();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const deleteLabel = (h: Holiday) =>
    h.type === 'Vacation'
      ? `${h.name || 'Vacation'} (${h.start_date} → ${h.end_date})`
      : `${h.name || 'Alternate Saturday'} (${h.date})`;

  return (
    <>
      <ListingPage
        title="Holidays"
        subtitle="Official off days and holidays across the year"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <select className="select select-year" value={year} onChange={(e) => list.setFilter('year', e.target.value)}>
            {[2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        }
        typeFilters={
          <select className="select" value={list.get('type')} onChange={(e) => list.setFilter('type', e.target.value)}>
            <option value="">All types</option>
            <option value="Festival">Festival</option>
            <option value="Saturday">Saturday</option>
            <option value="Vacation">Vacation</option>
            <option value="Manual">Manual</option>
          </select>
        }
        actions={
          manage ? (
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} />
              Add Holiday
            </Button>
          ) : undefined
        }
        prepend={
          snapshot && (
            <div className="page-stats">
              <div className="card emp-stat card-accent">
                <div className="stat-card">
                  <span className="stat-icon blue"><CalendarDays size={20} /></span>
                  <div>
                    <span className="label">Holidays {year}</span>
                    <div className="emp-stat-value">{counts.total}</div>
                    <span className="emp-stat-hint">Counted off days</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent violet">
                <div className="stat-card">
                  <span className="stat-icon violet"><Sparkles size={20} /></span>
                  <div>
                    <span className="label">Festivals</span>
                    <div className="emp-stat-value">{counts.Festival}</div>
                    <span className="emp-stat-hint">Cultural & national</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent amber">
                <div className="stat-card">
                  <span className="stat-icon amber"><CalendarOff size={20} /></span>
                  <div>
                    <span className="label">Saturdays</span>
                    <div className="emp-stat-value">{counts.Saturday}</div>
                    <span className="emp-stat-hint">Weekend offs</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent teal">
                <div className="stat-card">
                  <span className="stat-icon teal"><Plane size={20} /></span>
                  <div>
                    <span className="label">Vacations</span>
                    <div className="emp-stat-value">{counts.Vacation}</div>
                    <span className="emp-stat-hint">Planned off periods</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      >
        <div className="hol-grid">
          {data.map((h) => {
            const start = dateParts(h.date || h.start_date);
            const end = dateParts(h.end_date);
            const typeClass = h.type.toLowerCase();
            const isRange = h.type === 'Vacation';
            return (
              <div className="hol-card" key={h._id}>
                <div className={`hol-date is-${typeClass}`}>
                  {start && (
                    <>
                      <strong>
                        {isRange && end && end.day !== start.day
                          ? `${start.day}–${end.day}`
                          : start.day}
                      </strong>
                      <span>{MONTHS[start.m - 1].toUpperCase()}</span>
                    </>
                  )}
                </div>
                <div className="hol-body">
                  <h3 className="hol-title">{h.name || 'Alternate Saturday'}</h3>
                  <p className="hol-sub">
                    {isRange
                      ? `${MONTHS[start!.m - 1]} ${start!.day} – ${MONTHS[end!.m - 1]} ${end!.day} · ${h.year}`
                      : `${h.type === 'Saturday' ? 'Saturday' : h.day || '—'} · ${h.year}`}
                  </p>
                  <div className="hol-chips">
                    <span className={`hol-chip is-${typeClass}`}>{h.type}</span>
                    {isRange && end && (
                      <span className="hol-chip is-neutral">{end.day - start!.day + 1} days</span>
                    )}
                  </div>
                </div>
                {manage && (
                  <div className="hol-actions">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="dept-card-action danger"
                      title="Delete holiday"
                      onClick={() => {
                        setDeleteErr('');
                        setDeleting(h);
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ListingPage>

      {showAdd && (
        <AddHolidayDialog
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
            loadSnapshot();
          }}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && !deleteBusy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete holiday?</DialogTitle>
            <DialogDescription>
              <strong>{deleting ? deleteLabel(deleting) : ''}</strong> will be removed from the {year} calendar. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteErr && <p className="form-error">{deleteErr}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={confirmDelete}>
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddHolidayDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<HolidayType>('Festival');
  const [form, setForm] = useState({ name: '', date: '', start_date: '', end_date: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const needsName = type !== 'Saturday';
  const isRange = type === 'Vacation';

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      const body =
        type === 'Saturday'
          ? { type, date: form.date }
          : type === 'Vacation'
            ? { type, name: form.name, start_date: form.start_date, end_date: form.end_date }
            : { type, name: form.name, date: form.date };
      await api('/holidays', { method: 'POST', body });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  };

  const canSubmit = busy
    || (isRange ? !(form.name.trim() && form.start_date && form.end_date)
      : type === 'Saturday' ? !form.date
        : !(form.name.trim() && form.date));

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add holiday</DialogTitle>
          <DialogDescription>
            Choose the type first — the form adapts to what a {type.toLowerCase()} needs.
          </DialogDescription>
        </DialogHeader>
        <div className="form-grid">
          <div>
            <label className="label">Type</label>
            <select
              className="select"
              value={type}
              onChange={(e) => {
                setType(e.target.value as HolidayType);
                setForm({ name: '', date: '', start_date: '', end_date: '' });
              }}
            >
              <option value="Festival">Festival</option>
              <option value="Saturday">Saturday</option>
              <option value="Vacation">Vacation</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          {needsName && (
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={type === 'Manual' ? 'e.g. Office maintenance' : 'e.g. Diwali'}
              />
            </div>
          )}
          {!isRange && (
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          )}
          {isRange && (
            <>
              <div>
                <label className="label">Start</label>
                <input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="label">End</label>
                <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </>
          )}
        </div>
        {err && <p className="form-error">{err}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={canSubmit} onClick={submit}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
