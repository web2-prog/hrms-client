import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, TrendingUp, Timer } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, hoursBadge, formatHours } from '../../components/StatusBadge';
import { EmpCell } from '../../components/EmpCell';
import { useAuth } from '../../context/AuthContext';
import { displayClock, formatBreakMinutes, formatClockInput, parseBreakMinutes, to24HourClock, todayISO } from '../../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Att = {
  _id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  auto_checkout?: boolean;
  break_total?: number;
  working_hours?: number;
  status?: string;
  surplus_shortfall?: number;
  employee_id?: { _id: string; name: string; department_id?: { name: string } };
};

type EditState = Att & { break_display?: string };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d?: string) {
  if (!d) return { main: 'â€”', sub: '' };
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return { main: d, sub: '' };
  const dt = new Date(y, m - 1, day);
  return {
    main: dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    sub: dt.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

function monthBounds(year: string, month: string) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return { from: '', to: '' };
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(last).padStart(2, '0')}`,
  };
}

export function AttendancePage(_props: { allowBulk?: boolean }) {
  const list = useListParams();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'hr';
  const [data, setData] = useState<Att[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [depts, setDepts] = useState<{ _id: string; name: string }[]>([]);
  const [emps, setEmps] = useState<{ _id: string; name: string }[]>([]);

  const [summary, setSummary] = useState<{ total: number; onTime: number; extra: number; low: number } | null>(null);

  const today = todayISO();
  const year = list.get('year') || String(Math.max(2026, Number(today.slice(0, 4))));
  const month = list.get('month') || String(Number(today.slice(5, 7)));
  const dateFrom = list.get('from');
  const dateTo = list.get('to');
  const hasDateRange = !!(dateFrom || dateTo);

  const dateQuery = hasDateRange
    ? { from: dateFrom || undefined, to: dateTo || undefined }
    : { month, year };

  const setDateRange = (from: string, to: string) => {
    const next = new URLSearchParams(list.params);
    if (from) next.set('from', from);
    else next.delete('from');
    if (to) next.set('to', to);
    else next.delete('to');
    // Keep month/year aligned with the selected range for a coherent UI.
    const anchor = from || to;
    if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
      next.set('year', anchor.slice(0, 4));
      next.set('month', String(Number(anchor.slice(5, 7))));
    }
    next.set('page', '1');
    list.setParams(next);
  };

  const clearDateRange = () => {
    const next = new URLSearchParams(list.params);
    next.delete('from');
    next.delete('to');
    next.set('page', '1');
    list.setParams(next);
  };

  const setMonthYear = (nextMonth: string, nextYear: string) => {
    const next = new URLSearchParams(list.params);
    next.set('month', nextMonth);
    next.set('year', nextYear);
    // Switching month/year exits explicit date-range mode.
    next.delete('from');
    next.delete('to');
    next.set('page', '1');
    list.setParams(next);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        department_id: list.get('department_id'),
        employee_id: list.get('employee_id'),
        status: list.get('status'),
        ...dateQuery,
      });
      const res = await api<ListResult<Att>>(`/attendance${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      // Same filters as the table so the strip reflects the filtered view.
      const base = {
        limit: 1,
        ...dateQuery,
        department_id: list.get('department_id'),
        employee_id: list.get('employee_id'),
      };
      const res = await Promise.all([
        api<ListResult<Att>>(`/attendance${buildQuery(base)}`),
        api<ListResult<Att>>(`/attendance${buildQuery({ ...base, status: 'OnTime' })}`),
        // Auto-checkout days don't earn OT â€” match the table's OT column.
        api<ListResult<Att>>(`/attendance${buildQuery({ ...base, status: 'Extra', exclude_auto_checkout: '1' })}`),
        api<ListResult<Att>>(`/attendance${buildQuery({ ...base, status: 'Low' })}`),
      ]).catch(() => null);
      if (!res) return setSummary(null);
      const [totalRes, onTime, extra, low] = res;
      setSummary({
        total: totalRes.total ?? 0,
        onTime: onTime?.total ?? 0,
        extra: extra?.total ?? 0,
        low: low?.total ?? 0,
      });
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);
  useEffect(() => { loadSummary(); }, [month, year, dateFrom, dateTo, list.params]);
  useEffect(() => {
    if (!isStaff) return;
    api<ListResult<any>>('/departments?limit=50').then((r) => setDepts(r.data));
    api<ListResult<any>>('/employees?limit=100').then((r) => setEmps(r.data)).catch(() => {});
  }, [isStaff]);

  const openEdit = (r: Att) => {
    setEdit({
      ...r,
      check_in: formatClockInput(r.check_in),
      check_out: formatClockInput(r.check_out),
      // Keep fractional minutes â€” breaks are recorded with sub-minute precision.
      break_display: String(r.break_total ?? 0),
    });
  };

  const periodLabel = (() => {
    if (dateFrom && dateTo && dateFrom === dateTo) return fmtDate(dateFrom).main;
    if (dateFrom && dateTo) return `${fmtDate(dateFrom).main} â€“ ${fmtDate(dateTo).main}`;
    if (dateFrom) return `From ${fmtDate(dateFrom).main}`;
    if (dateTo) return `Until ${fmtDate(dateTo).main}`;
    return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
  })();

  return (
    <>
      <ListingPage
        title="Attendance"
        subtitle="Daily check-in, check-out and hours across the team"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={() => { load(); loadSummary(); }}
        filters={
          <>
            <label className="att-date-filter">
              <span className="label">From</span>
              <input
                className="input att-date-input"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  const from = e.target.value;
                  let to = dateTo;
                  if (from && to && to < from) to = from;
                  if (from && !to) to = from;
                  setDateRange(from, to);
                }}
                aria-label="From date"
              />
            </label>
            <label className="att-date-filter">
              <span className="label">To</span>
              <input
                className="input att-date-input"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  const to = e.target.value;
                  let from = dateFrom;
                  if (to && from && to < from) from = to;
                  if (to && !from) from = to;
                  setDateRange(from, to);
                }}
                aria-label="To date"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDateRange(today, today)}
              title="Show today only"
            >
              Today
            </Button>
            {hasDateRange ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearDateRange} title="Clear date range">
                Clear dates
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const bounds = monthBounds(year, month);
                  setDateRange(bounds.from, bounds.to);
                }}
                title="Use full selected month as date range"
              >
                Whole month
              </Button>
            )}
            <select
              className="select select-month"
              value={month}
              onChange={(e) => setMonthYear(e.target.value, year)}
              title={hasDateRange ? 'Changing month clears the date range' : 'Month'}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
              ))}
            </select>
            <select
              className="select select-year"
              value={year}
              onChange={(e) => setMonthYear(month, e.target.value)}
              title={hasDateRange ? 'Changing year clears the date range' : 'Year'}
            >
              {[2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {isStaff && (
              <>
                <select className="select" value={list.get('department_id')} onChange={(e) => list.setFilter('department_id', e.target.value)}>
                  <option value="">Department</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
                <select className="select" value={list.get('employee_id')} onChange={(e) => list.setFilter('employee_id', e.target.value)}>
                  <option value="">Employee</option>
                  {emps.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
              </>
            )}
          </>
        }
        typeFilters={
          <select className="select" value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
            <option value="">Status</option>
            {['Extra', 'Low', 'OnTime', 'Working', 'OnBreak', 'Absent'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        }
        prepend={
          summary && (
            <div className="page-stats">
              <div className="card emp-stat card-accent">
                <div className="stat-card">
                  <span className="stat-icon blue"><CalendarDays size={20} /></span>
                  <div>
                    <span className="label">Records</span>
                    <div className="emp-stat-value">{summary.total}</div>
                    <span className="emp-stat-hint">{periodLabel}</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent violet">
                <div className="stat-card">
                  <span className="stat-icon violet"><CheckCircle2 size={20} /></span>
                  <div>
                    <span className="label">On time</span>
                    <div className="emp-stat-value">{summary.onTime}</div>
                    <span className="emp-stat-hint">Met daily hour target</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent teal">
                <div className="stat-card">
                  <span className="stat-icon teal"><TrendingUp size={20} /></span>
                  <div>
                    <span className="label">Extra / OT</span>
                    <div className="emp-stat-value">{summary.extra}</div>
                    <span className="emp-stat-hint">Beyond shift target</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent amber">
                <div className="stat-card">
                  <span className="stat-icon amber"><Timer size={20} /></span>
                  <div>
                    <span className="label">Low</span>
                    <div className="emp-stat-value">{summary.low}</div>
                    <span className="emp-stat-hint">Below daily target</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                {isStaff && <th>Employee</th>}
                <th>In</th>
                <th>Out</th>
                <th>Break</th>
                <th>Hours</th>
                <th>Status / OT</th>
                {isStaff && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const d = fmtDate(r.date);
                return (
                  <tr key={r._id}>
                    <td>
                      <div className="date-cell">
                        <span>{d.main}</span>
                        {d.sub && <em>{d.sub}</em>}
                      </div>
                    </td>
                    {isStaff && (
                      <td>
                        <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                      </td>
                    )}
                    <td>{displayClock(r.check_in)}</td>
                    <td>
                      {displayClock(r.check_out)}
                      {r.auto_checkout ? <div className="label">Auto 11:55 PM</div> : null}
                    </td>
                    <td>{formatBreakMinutes(r.break_total ?? 0)}</td>
                    <td className="num-cell">{formatHours(r.working_hours)}</td>
                    <td>{hoursBadge(r.surplus_shortfall, r.status === 'OnBreak' ? 'Working' : r.status)}</td>
                    {isStaff && (
                      <td><Button variant="outline" onClick={() => openEdit(r)}>Manage</Button></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ListingPage>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit attendance â€” {edit?.date}</DialogTitle>
          </DialogHeader>
          {edit && (
            <>
            <div className="form-grid">
              <div>
                <label className="label">Check-in (e.g. 9:15:00 AM)</label>
                <input
                  className="input"
                  placeholder="9:15:00 AM"
                  value={edit.check_in || ''}
                  onChange={(e) => setEdit({ ...edit, check_in: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Check-out (e.g. 5:30:00 PM)</label>
                <input
                  className="input"
                  placeholder="5:30:00 PM"
                  value={edit.check_out || ''}
                  onChange={(e) => setEdit({ ...edit, check_out: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Break (minutes)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="24"
                  value={edit.break_display ?? String(edit.break_total ?? 0)}
                  onChange={(e) => setEdit({ ...edit, break_display: e.target.value })}
                />
              </div>
            </div>
            <p className="emp-action-help" style={{ marginTop: 8 }}>
              Times use 12-hour clock with AM/PM (e.g. 9:15:00 AM). Break is in minutes and can be fractional (e.g. 24.5). Hours and OT recalculate on save.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button
                onClick={async () => {
                  const breakMins = parseBreakMinutes(edit.break_display ?? edit.break_total ?? 0);
                  await api(`/attendance/${edit._id}`, {
                    method: 'PUT',
                    body: {
                      check_in: to24HourClock(edit.check_in),
                      check_out: to24HourClock(edit.check_out),
                      break_total: breakMins,
                    },
                  });
                  setEdit(null);
                  load();
                  loadSummary();
                }}
              >
                Save
              </Button>
            </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
