import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarOff, Check, Plane, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { AppSelect } from '../../components/AppSelect';
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
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateParts(d?: string) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return null;
  return { y, m, day };
}

/** Calendar days in an inclusive date range (handles ranges crossing months/years). */
function rangeDays(s?: string, e?: string) {
  if (!s || !e) return 0;
  const a = new Date(s + 'T00:00:00').getTime();
  const b = new Date(e + 'T00:00:00').getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

function weekdayShort(d?: string) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return '';
  return WEEKDAYS[dt.getDay()];
}

function holidaySortKey(h: Holiday) {
  return h.date || h.start_date || '';
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

  // Year working-days summary (single source of truth for the strip — same
  // numbers as the Admin dashboard: non-overlapping off-day counts).
  const [wd, setWd] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: 1,
        limit: 'all',
        search: list.search,
        year,
        type: list.get('type'),
      });
      const res = await api<ListResult<Holiday>>(`/holidays${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadWd = async () => {
    try {
      const res = await api<any>(`/working-days?year=${year}`);
      setWd(res);
    } catch {
      setWd(null);
    }
  };

  useEffect(() => { load(); }, [list.search, list.params, year]);

  // Local today (YYYY-MM-DD) — holidays that ended before this are "completed".
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const isPast = (h: Holiday) => {
    const end = h.end_date || h.date;
    return !!end && end < todayStr;
  };

  // Full year, December → January. Within a month, earliest date first.
  const groups = useMemo(() => {
    const y = Number(year);
    const buckets: Holiday[][] = Array.from({ length: 12 }, () => []);
    for (const h of data) {
      const p = dateParts(h.date || h.start_date);
      if (!p || p.m < 1 || p.m > 12) continue;
      buckets[p.m - 1].push(h);
    }
    for (const items of buckets) {
      items.sort((a, b) => holidaySortKey(a).localeCompare(holidaySortKey(b)));
    }
    // Only render months that have holidays — empty months stay hidden until one is added.
    return [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      .map((m) => ({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        monthIndex: m,
        label: MONTHS_FULL[m],
        short: MONTHS[m],
        items: buckets[m],
      }))
      .filter((g) => g.items.length > 0);
  }, [data, year, list.search, list.params]);

  useEffect(() => { loadWd(); }, [year]);

  // Non-overlapping day counts (vacations absorb weekends inside them), matching
  // the Admin dashboard's working-days breakdown exactly.
  const counts = useMemo(() => {
    const b = wd?.breakdown;
    return {
      total: wd?.non_working_days ?? 0,
      Festival: b?.festivals ?? 0,
      Saturday: b?.alternate_saturdays ?? 0,
      Vacation: b?.vacation_days ?? 0,
    };
  }, [wd]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteErr('');
    try {
      await api(`/holidays/${deleting._id}`, { method: 'DELETE' });
      setDeleting(null);
      load();
      loadWd();
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

  const viewYear = Number(year);
  const currentMonth = now.getFullYear() === viewYear ? now.getMonth() : -1;

  return (
    <>
      <ListingPage
        title="Holidays"
        subtitle={`${year} calendar · December to January`}
        searchPlaceholder="Search holidays…"
        hidePagination
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={() => { load(); loadWd(); }}
        filters={
          <AppSelect
            className="select-year"
            value={year}
            onChange={(v) => list.setFilter('year', v || year)}
            options={[2026, 2027, 2028].map((y) => ({ value: String(y), label: String(y) }))}
          />
        }
        typeFilters={
          <AppSelect
            value={list.get('type')}
            onChange={(v) => list.setFilter('type', v)}
            options={[
              { value: '', label: 'All types' },
              { value: 'Festival', label: 'Festival' },
              { value: 'Saturday', label: 'Saturday' },
              { value: 'Vacation', label: 'Vacation' },
              { value: 'Manual', label: 'Manual' },
            ]}
          />
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
          wd && (
            <div className="page-stats">
              <div className="card emp-stat">
                <div className="stat-card">
                  <span className="stat-icon blue"><CalendarDays size={20} /></span>
                  <div>
                    <span className="label">Off days {year}</span>
                    <div className="emp-stat-value">{counts.total}</div>
                    <span className="emp-stat-hint">Counted across the year</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat">
                <div className="stat-card">
                  <span className="stat-icon violet"><Sparkles size={20} /></span>
                  <div>
                    <span className="label">Festivals</span>
                    <div className="emp-stat-value">{counts.Festival}</div>
                    <span className="emp-stat-hint">Cultural & national</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat">
                <div className="stat-card">
                  <span className="stat-icon amber"><CalendarOff size={20} /></span>
                  <div>
                    <span className="label">Saturdays</span>
                    <div className="emp-stat-value">{counts.Saturday}</div>
                    <span className="emp-stat-hint">Alternate weekends</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat">
                <div className="stat-card">
                  <span className="stat-icon teal"><Plane size={20} /></span>
                  <div>
                    <span className="label">Vacation days</span>
                    <div className="emp-stat-value">{counts.Vacation}</div>
                    <span className="emp-stat-hint">Days inside vacations</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      >
        <div className="hol-year-bar">
          <span>Newest month first</span>
          <strong>{data.length} {data.length === 1 ? 'holiday' : 'holidays'}</strong>
        </div>
        <div className="hol-year">
          {groups.length === 0 && !loading ? (
            <p className="hol-empty" style={{ padding: '1.25rem 0' }}>
              No holidays in this view yet. Add one to see it listed by month.
            </p>
          ) : null}
          {groups.map((g) => {
            const isCurrent = g.monthIndex === currentMonth;
            return (
              <section
                className={`hol-month${isCurrent ? ' is-current' : ''}`}
                key={g.key}
              >
                <div className="hol-month-rail">
                  <strong>{g.label}</strong>
                  <em>{`${g.items.length} ${g.items.length === 1 ? 'holiday' : 'holidays'}`}</em>
                  {isCurrent && <span className="hol-now">This month</span>}
                </div>
                <div className="hol-grid">
                    {g.items.map((h) => {
                      const start = dateParts(h.date || h.start_date);
                      const end = dateParts(h.end_date);
                      const typeClass = h.type.toLowerCase();
                      const isRange = h.type === 'Vacation';
                      const past = isPast(h);
                      const startKey = h.date || h.start_date || '';
                      const upcoming = !past && startKey > todayStr;
                      const ongoing = !past && isRange && !!h.start_date && !!h.end_date
                        && h.start_date <= todayStr && h.end_date >= todayStr;
                      const dayLabel = h.type === 'Saturday'
                        ? 'Sat'
                        : weekdayShort(h.date || h.start_date);
                      return (
                        <div className={`hol-card${past ? ' is-past' : ''}${ongoing ? ' is-ongoing' : ''}`} key={h._id}>
                          <div className={`hol-date is-${typeClass}`}>
                            {start && (
                              <>
                                <strong>{start.day}</strong>
                                <span>{dayLabel}</span>
                              </>
                            )}
                          </div>
                          <div className="hol-body">
                            <h3 className="hol-title">{h.name || 'Alternate Saturday'}</h3>
                            <p className="hol-sub">
                              {isRange && start && end
                                ? `${MONTHS[start.m - 1]} ${start.day} – ${MONTHS[end.m - 1]} ${end.day}`
                                : `${dayLabel}${start ? ` · ${MONTHS[start.m - 1]} ${start.day}` : ''}`}
                            </p>
                            <div className="hol-chips">
                              <span className={`hol-chip is-${typeClass}`}>{h.type}</span>
                              {isRange && (
                                <span className="hol-chip is-neutral">{rangeDays(h.start_date, h.end_date)} days</span>
                              )}
                              {ongoing && (
                                <span className="hol-chip is-ongoing">Ongoing</span>
                              )}
                              {upcoming && (
                                <span className="hol-chip is-upcoming">Upcoming</span>
                              )}
                              {past && (
                                <span className="hol-chip is-past"><Check size={12} /> Done</span>
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
              </section>
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
            loadWd();
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
