import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, TrendingUp, Timer } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, hoursBadge, formatHours } from '../../components/StatusBadge';
import { EmpCell } from '../../components/EmpCell';
import { AppSelect } from '../../components/AppSelect';
import { useAuth } from '../../context/AuthContext';
import { canManageAttendanceTime } from '../../lib/staffPermissions';
import { displayClock, formatBreakMinutes, formatClockInput, parseBreakMinutes, to24HourClock, todayISO } from '../../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EarlyCheckoutRequestsCard, CoverTimeRequestsCard } from '../../components/RequestCards';

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
  employee_id?: {
    _id: string;
    name: string;
    role?: 'admin' | 'hr' | 'employee' | string;
    department_id?: { name: string };
  };
};

type EditState = Att & { break_display?: string };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d?: string) {
  if (!d) return { main: '—', sub: '' };
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return { main: d, sub: '' };
  const dt = new Date(y, m - 1, day);
  return {
    main: dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    sub: dt.toLocaleDateString(undefined, { weekday: 'short' }),
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
  const selectedDate = list.get('date');
  const hasDateFilter = !!selectedDate;

  const dateQuery = hasDateFilter ? { date: selectedDate } : { month, year };

  const setSelectedDate = (date: string) => {
    const next = new URLSearchParams(list.params);
    next.delete('from');
    next.delete('to');
    if (date) {
      next.set('date', date);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        next.set('year', date.slice(0, 4));
        next.set('month', String(Number(date.slice(5, 7))));
      }
    } else {
      next.delete('date');
    }
    next.set('page', '1');
    list.setParams(next);
  };

  const clearDateFilter = () => setSelectedDate('');

  const setMonthYear = (nextMonth: string, nextYear: string) => {
    const next = new URLSearchParams(list.params);
    next.set('month', nextMonth);
    next.set('year', nextYear);
    next.delete('date');
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
  useEffect(() => { loadSummary(); }, [month, year, selectedDate, list.params]);
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

  const periodLabel = selectedDate
    ? fmtDate(selectedDate).main
    : `${MONTH_NAMES[Number(month) - 1]} ${year}`;

  return (
    <>
      {isStaff && <EarlyCheckoutRequestsCard />}
      {isStaff && <CoverTimeRequestsCard />}
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
              <span className="label">Date</span>
              <input
                className="input att-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Attendance date"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(today)}
              title="Show today only"
            >
              Today
            </Button>
            {hasDateFilter && (
              <Button type="button" variant="ghost" size="sm" onClick={clearDateFilter} title="Show full selected month">
                Whole month
              </Button>
            )}
            <AppSelect
              className="select-month"
              value={String(month)}
              onChange={(v) => setMonthYear(v, year)}
              title={hasDateFilter ? 'Changing month clears the date filter' : 'Month'}
              options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
                value: String(m),
                label: MONTH_NAMES[m - 1],
              }))}
            />
            <AppSelect
              className="select-year"
              value={String(year)}
              onChange={(v) => setMonthYear(month, v)}
              title={hasDateFilter ? 'Changing year clears the date filter' : 'Year'}
              options={[2026, 2027, 2028].map((y) => ({ value: String(y), label: String(y) }))}
            />
            {isStaff && (
              <>
                <AppSelect
                  value={list.get('department_id')}
                  onChange={(v) => list.setFilter('department_id', v)}
                  options={[
                    { value: '', label: 'Department' },
                    ...depts.map((d) => ({ value: d._id, label: d.name })),
                  ]}
                />
                <AppSelect
                  value={list.get('employee_id')}
                  onChange={(v) => list.setFilter('employee_id', v)}
                  options={[
                    { value: '', label: 'Employee' },
                    ...emps.map((e) => ({ value: e._id, label: e.name })),
                  ]}
                />
              </>
            )}
          </>
        }
        typeFilters={
          <AppSelect
            value={list.get('status')}
            onChange={(v) => list.setFilter('status', v)}
            options={[
              { value: '', label: 'Status' },
              ...['Extra', 'Low', 'OnTime', 'Working', 'OnBreak', 'Absent'].map((s) => ({
                value: s,
                label: s,
              })),
            ]}
          />
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
                      <td>
                        {canManageAttendanceTime(user, r.employee_id) ? (
                          <Button variant="outline" onClick={() => openEdit(r)}>Manage</Button>
                        ) : (
                          <span className="label">Admin only</span>
                        )}
                      </td>
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
