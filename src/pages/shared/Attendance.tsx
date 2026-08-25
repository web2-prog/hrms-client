import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, TrendingUp, Timer } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, ListPagination, PAGE_SIZE, useListParams } from '../../components/ListingPage';
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
import { Textarea } from '@/components/ui/textarea';

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
  if (!d) return { main: '—', sub: '' };
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
        // Auto-checkout days don't earn OT — match the table's OT column.
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
      // Keep fractional minutes — breaks are recorded with sub-minute precision.
      break_display: String(r.break_total ?? 0),
    });
  };

  const periodLabel = (() => {
    if (dateFrom && dateTo && dateFrom === dateTo) return fmtDate(dateFrom).main;
    if (dateFrom && dateTo) return `${fmtDate(dateFrom).main} – ${fmtDate(dateTo).main}`;
    if (dateFrom) return `From ${fmtDate(dateFrom).main}`;
    if (dateTo) return `Until ${fmtDate(dateTo).main}`;
    return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
  })();

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
            <DialogTitle>Edit attendance — {edit?.date}</DialogTitle>
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

type EcRequest = {
  _id: string;
  date: string;
  requested_time: string;
  reason: string;
  status: string;
  decision_note?: string;
  createdAt?: string;
  employee_id?: { name: string; department_id?: { name: string } };
  decided_by?: { name?: string } | null;
};

/** HR/Admin approval queue for early checkout requests (Attendance page). */
function EarlyCheckoutRequestsCard() {
  const [pending, setPending] = useState<EcRequest[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [recent, setRecent] = useState<EcRequest[]>([]);
  const [rejecting, setRejecting] = useState<EcRequest | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const [p, r] = await Promise.all([
        api<ListResult<EcRequest>>(
          `/attendance/early-checkout-requests?status=Pending&page=${pendingPage}&limit=${PAGE_SIZE}`
        ),
        api<ListResult<EcRequest>>(`/attendance/early-checkout-requests?page=1&limit=${PAGE_SIZE}&status=Approved`),
      ]);
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
      setRecent(r.data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load requests');
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  const decide = async (req: EcRequest, status: 'Approved' | 'Rejected', decisionNote = '') => {
    setBusyId(req._id);
    setErr('');
    try {
      await api(`/attendance/early-checkout-requests/${req._id}/decide`, {
        method: 'POST',
        body: { status, note: decisionNote },
      });
      setMsg(
        status === 'Approved'
          ? `Approved — ${req.employee_id?.name || 'employee'} has been checked out at ${displayClock(req.requested_time)}.`
          : 'Request rejected.'
      );
      setRejecting(null);
      setNote('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card ecr-card" style={{ marginBottom: 16 }}>
      <div className="ecr-head">
        <div>
          <h3 style={{ margin: 0 }}>Early Checkout Requests</h3>
          <p className="emp-action-help" style={{ margin: '4px 0 0' }}>
            Employees leaving before shift end need approval. Approving checks them out at the requested time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingTotal > 0 && <span className="badge badge-warn">{pendingTotal} pending</span>}
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {msg && <p style={{ color: 'var(--success)', margin: '0.75rem 0 0' }}>{msg}</p>}
      {err && <p style={{ color: 'var(--error)', margin: '0.75rem 0 0' }}>{err}</p>}

      {pendingTotal === 0 ? (
        <p className="ecr-empty">No pending early checkout requests.</p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Requested at</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                    </td>
                    <td>{displayClock(r.requested_time)}</td>
                    <td>{r.date}</td>
                    <td style={{ maxWidth: 320 }}>{r.reason || '—'}</td>
                    <td className="row-actions">
                      <Button
                        size="sm"
                        disabled={busyId === r._id}
                        onClick={() => decide(r, 'Approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r._id}
                        onClick={() => {
                          setRejecting(r);
                          setNote('');
                        }}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination total={pendingTotal} page={pendingPage} onPageChange={setPendingPage} />
        </>
      )}

      {recent.some((r) => r.status !== 'Pending') && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--hairline)', paddingTop: 12 }}>
          <span className="label">Recent decisions</span>
          <div className="ecr-recent-list">
            {recent
              .filter((r) => r.status !== 'Pending')
              .slice(0, 5)
              .map((r) => (
                <div key={r._id} className="ecr-recent-item">
                  <span style={{ fontWeight: 600 }}>{r.employee_id?.name || '—'}</span>
                  <StatusBadge status={r.status} />
                  <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                    {displayClock(r.requested_time)} · {r.date}
                    {r.decision_note ? ` · “${r.decision_note}”` : ''}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject early checkout</DialogTitle>
          </DialogHeader>
          {rejecting && (
            <>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {rejecting.employee_id?.name || 'Employee'} · {displayClock(rejecting.requested_time)} ·{' '}
                {rejecting.reason || 'No reason given'}
              </p>
              <div className="grid gap-1.5">
                <label className="label" htmlFor="ecr-note">
                  Note (optional)
                </label>
                <Textarea
                  id="ecr-note"
                  rows={3}
                  placeholder="e.g. Please finish the pending task before leaving…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={busyId === rejecting._id} onClick={() => setRejecting(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={busyId === rejecting._id}
                  onClick={() => decide(rejecting, 'Rejected', note)}
                >
                  Reject request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CtRequest = {
  _id: string;
  date: string;
  requested_hours: number;
  actual_cover_hours?: number;
  reason?: string;
  status: string;
  decision_note?: string;
  createdAt?: string;
  employee_id?: { name: string; department_id?: { name: string } };
  decided_by?: { name?: string } | null;
};

/** HR/Admin approval queue for cover time requests (Attendance page). */
function CoverTimeRequestsCard() {
  const [pending, setPending] = useState<CtRequest[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [recent, setRecent] = useState<CtRequest[]>([]);
  const [rejecting, setRejecting] = useState<CtRequest | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const [p, r] = await Promise.all([
        api<ListResult<CtRequest>>(
          `/attendance/cover-time-requests?status=Pending&page=${pendingPage}&limit=${PAGE_SIZE}`
        ),
        api<ListResult<CtRequest>>(`/attendance/cover-time-requests?page=1&limit=${PAGE_SIZE}&status=Approved`),
      ]);
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
      setRecent(r.data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load cover time requests');
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  const decide = async (req: CtRequest, status: 'Approved' | 'Rejected', decisionNote = '') => {
    setBusyId(req._id);
    setErr('');
    try {
      const updated = await api<CtRequest>(`/attendance/cover-time-requests/${req._id}/decide`, {
        method: 'POST',
        body: { status, note: decisionNote },
      });
      setMsg(
        status === 'Approved'
          ? `Approved — ${formatHours(updated.actual_cover_hours || req.requested_hours)} cover time for ${req.employee_id?.name || 'employee'} counts toward working hours.`
          : 'Cover time request rejected.'
      );
      setRejecting(null);
      setNote('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card ecr-card" style={{ marginBottom: 16 }}>
      <div className="ecr-head">
        <div>
          <h3 style={{ margin: 0 }}>Cover Time Requests</h3>
          <p className="emp-action-help" style={{ margin: '4px 0 0' }}>
            Employees making up shortfall hours after completing daily working hours. Approved cover time counts toward
            monthly working hours (not overtime). Minimum 45 minutes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingTotal > 0 && <span className="badge badge-warn">{pendingTotal} pending</span>}
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {msg && <p style={{ color: 'var(--success)', margin: '0.75rem 0 0' }}>{msg}</p>}
      {err && <p style={{ color: 'var(--error)', margin: '0.75rem 0 0' }}>{err}</p>}

      {pendingTotal === 0 ? (
        <p className="ecr-empty">No pending cover time requests.</p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Requested</th>
                  <th>Covered</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                    </td>
                    <td>{formatHours(r.requested_hours)}</td>
                    <td>{formatHours(r.actual_cover_hours || 0)}</td>
                    <td>{r.date}</td>
                    <td style={{ maxWidth: 320 }}>{r.reason || '—'}</td>
                    <td className="row-actions">
                      <Button size="sm" disabled={busyId === r._id} onClick={() => decide(r, 'Approved')}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r._id}
                        onClick={() => {
                          setRejecting(r);
                          setNote('');
                        }}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination total={pendingTotal} page={pendingPage} onPageChange={setPendingPage} />
        </>
      )}

      {recent.some((r) => r.status !== 'Pending') && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--hairline)', paddingTop: 12 }}>
          <span className="label">Recent cover approvals</span>
          <div className="ecr-recent-list">
            {recent
              .filter((r) => r.status !== 'Pending')
              .slice(0, 5)
              .map((r) => (
                <div key={r._id} className="ecr-recent-item">
                  <span style={{ fontWeight: 600 }}>{r.employee_id?.name || '—'}</span>
                  <StatusBadge status={r.status} />
                  <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                    {formatHours(r.actual_cover_hours || r.requested_hours)} · {r.date}
                    {r.decision_note ? ` · “${r.decision_note}”` : ''}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject cover time</DialogTitle>
          </DialogHeader>
          {rejecting && (
            <>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {rejecting.employee_id?.name || 'Employee'} · {formatHours(rejecting.requested_hours)} ·{' '}
                {rejecting.reason || 'No reason given'}
              </p>
              <div className="grid gap-1.5">
                <label className="label" htmlFor="ctr-note">
                  Note (optional)
                </label>
                <Textarea
                  id="ctr-note"
                  rows={3}
                  placeholder="e.g. Please apply OT instead if this is extra work…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={busyId === rejecting._id} onClick={() => setRejecting(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={busyId === rejecting._id}
                  onClick={() => decide(rejecting, 'Rejected', note)}
                >
                  Reject request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
