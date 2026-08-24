import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Clock3,
  Coffee,
  LogOut,
  Timer,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { ListPagination, PAGE_SIZE } from '../../components/ListingPage';
import { api, buildQuery, type ListResult } from '../../services/api';
import { formatHours, hoursBadge, StatusBadge } from '../../components/StatusBadge';
import { RequireRole } from '../../components/StatusBadge';
import {
  displayClock,
  formatBreakMinutes,
  formatHours as formatWorked,
  pad2,
  timeToSeconds,
  todayISO,
} from '../../utils/timeFormat';

type EmpOption = {
  _id: string;
  name: string;
  employee_id?: string;
  department_id?: { name?: string; shift_end?: string } | string;
  email?: string;
  status?: string;
  custom_shift_end?: string;
};

type Att = {
  _id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  break_total?: number;
  working_hours?: number;
  status?: string;
  surplus_shortfall?: number;
};

type Leave = {
  _id: string;
  from_date: string;
  to_date: string;
  day_type?: string;
  reason?: string;
  status?: string;
  applied_on?: string;
};

type Ot = {
  _id: string;
  date: string;
  hours?: number;
  reason?: string;
  status?: string;
  ot_type?: string;
};

type EarlyCheckout = {
  _id: string;
  date: string;
  requested_time?: string;
  status?: string;
  reason?: string;
};

type Salary = {
  _id: string;
  month?: number;
  year?: number;
  net_pay?: number;
  status?: string;
  payment_status?: string;
  overtime_hours?: number;
  shortfall_hours?: number;
  monthly_counted_hours?: number;
  monthly_target_hours?: number;
};

type Period = 'today' | 'month' | 'year' | 'all';
type TabId = 'attendance' | 'breaks' | 'leaves' | 'overtime' | 'performance' | 'early' | 'low' | 'salary';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function deptName(emp?: EmpOption | null) {
  if (!emp?.department_id) return '';
  if (typeof emp.department_id === 'string') return emp.department_id;
  return emp.department_id.name || '';
}

function periodLabel(period: Period, month: number, year: number) {
  if (period === 'today') return todayISO();
  if (period === 'month') return `${MONTHS[month - 1]} ${year}`;
  if (period === 'year') return String(year);
  return 'All time';
}

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'attendance', label: 'Check-in / out', icon: <Clock3 size={15} /> },
  { id: 'breaks', label: 'Breaks', icon: <Coffee size={15} /> },
  { id: 'leaves', label: 'Leaves', icon: <CalendarDays size={15} /> },
  { id: 'overtime', label: 'Overtime', icon: <Timer size={15} /> },
  { id: 'performance', label: 'Performance', icon: <TrendingUp size={15} /> },
  { id: 'early', label: 'Early checkout', icon: <LogOut size={15} /> },
  { id: 'low', label: 'Low hours', icon: <AlertTriangle size={15} /> },
  { id: 'salary', label: 'Salary', icon: <Briefcase size={15} /> },
];

export default function EmployeeSummaryPage() {
  return (
    <RequireRole roles={['admin', 'hr']}>
      <EmployeeSummaryInner />
    </RequireRole>
  );
}

function EmployeeSummaryInner() {
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const employeeId = params.get('employee') || '';
  const period = (params.get('period') as Period) || 'month';
  const month = Number(params.get('month') || now.getMonth() + 1);
  const year = Number(params.get('year') || Math.max(2026, now.getFullYear()));
  const [tab, setTab] = useState<TabId>('attendance');
  const [tabPage, setTabPage] = useState(1);

  const [emps, setEmps] = useState<EmpOption[]>([]);
  const [emp, setEmp] = useState<EmpOption | null>(null);
  const [attendance, setAttendance] = useState<Att[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [overtime, setOvertime] = useState<Ot[]>([]);
  const [earlyCheckouts, setEarlyCheckouts] = useState<EarlyCheckout[]>([]);
  const [salary, setSalary] = useState<Salary[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  useEffect(() => {
    setTabPage(1);
  }, [tab, employeeId, period, month, year]);

  useEffect(() => {
    api<ListResult<EmpOption>>('/employees?limit=10000&status=active')
      .then((r) => setEmps(r.data || []))
      .catch(() => setEmps([]));
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setEmp(null);
      return;
    }
    api<EmpOption>(`/employees/${employeeId}`)
      .then(setEmp)
      .catch(() => setEmp(null));
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) {
      setAttendance([]);
      setLeaves([]);
      setOvertime([]);
      setEarlyCheckouts([]);
      setSalary([]);
      setSummary(null);
      setError('');
      return;
    }

    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const today = todayISO();
        const attQ: Record<string, string | number> = { employee_id: employeeId, limit: 10000 };
        const leaveQ: Record<string, string | number> = { employee_id: employeeId, limit: 10000 };
        const otQ: Record<string, string | number> = { employee_id: employeeId, limit: 10000 };
        const salQ: Record<string, string | number> = { employee_id: employeeId, limit: 10000 };

        if (period === 'today') {
          attQ.month = Number(today.slice(5, 7));
          attQ.year = Number(today.slice(0, 4));
          leaveQ.from_date = today;
          leaveQ.to_date = today;
          otQ.from_date = today;
          otQ.to_date = today;
          salQ.month = Number(today.slice(5, 7));
          salQ.year = Number(today.slice(0, 4));
        } else if (period === 'month') {
          attQ.month = month;
          attQ.year = year;
          leaveQ.month = month;
          leaveQ.year = year;
          otQ.month = month;
          otQ.year = year;
          salQ.month = month;
          salQ.year = year;
        } else if (period === 'year') {
          attQ.year = year;
          leaveQ.from_date = `${year}-01-01`;
          leaveQ.to_date = `${year}-12-31`;
          otQ.from_date = `${year}-01-01`;
          otQ.to_date = `${year}-12-31`;
          salQ.year = year;
        }

        const requests: Promise<any>[] = [
          api<ListResult<Att>>(`/attendance${buildQuery(attQ)}`),
          api<ListResult<Leave>>(`/leaves${buildQuery(leaveQ)}`),
          api<ListResult<Ot>>(`/overtime${buildQuery(otQ)}`),
          api<ListResult<Salary>>(`/salary${buildQuery(salQ)}`),
          api<ListResult<EarlyCheckout>>(
            `/attendance/early-checkout-requests${buildQuery({
              ...attQ,
              status: 'Approved',
            })}`
          ),
        ];

        if (period === 'month' || period === 'today') {
          const sm = period === 'today' ? Number(today.slice(5, 7)) : month;
          const sy = period === 'today' ? Number(today.slice(0, 4)) : year;
          requests.push(api(`/monthly-summary${buildQuery({ employee_id: employeeId, month: sm, year: sy })}`));
        }

        const results = await Promise.allSettled(requests);
        if (!alive) return;

        const attRes = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
        let attData: Att[] = attRes.data || [];
        if (period === 'today') attData = attData.filter((a) => a.date === today);

        let earlyData: EarlyCheckout[] =
          results[4].status === 'fulfilled' ? results[4].value.data || [] : [];
        if (period === 'today') earlyData = earlyData.filter((a) => a.date === today);

        setAttendance(attData);
        setLeaves(results[1].status === 'fulfilled' ? results[1].value.data || [] : []);
        setOvertime(results[2].status === 'fulfilled' ? results[2].value.data || [] : []);
        setSalary(results[3].status === 'fulfilled' ? results[3].value.data || [] : []);
        setEarlyCheckouts(earlyData);
        setSummary(
          results[5] && results[5].status === 'fulfilled' ? results[5].value : null
        );

        const failed = results.find((r) => r.status === 'rejected');
        if (failed && failed.status === 'rejected') {
          setError(failed.reason instanceof Error ? failed.reason.message : 'Failed to load some data');
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [employeeId, period, month, year]);

  const shiftEnd =
    emp?.custom_shift_end ||
    (emp?.department_id && typeof emp.department_id === 'object' ? emp.department_id.shift_end : undefined) ||
    '17:30';

  const earlyRows = useMemo(() => {
    const endSec = timeToSeconds(shiftEnd);
    const attByDate = new Map(attendance.map((a) => [a.date, a]));
    return earlyCheckouts
      .filter((r) => r.status === 'Approved')
      .map((r) => {
        const leaveAt = r.requested_time || attByDate.get(r.date)?.check_out || null;
        const leaveSec = timeToSeconds(leaveAt);
        const earlyMins =
          leaveSec != null && endSec != null && leaveSec < endSec
            ? Math.round(((endSec - leaveSec) / 60) * 100) / 100
            : 0;
        return {
          ...r,
          leaveAt,
          earlyMins,
          worked: attByDate.get(r.date)?.working_hours,
          attendanceStatus: attByDate.get(r.date)?.status,
        };
      })
      .filter((r) => r.earlyMins > 0);
  }, [earlyCheckouts, attendance, shiftEnd]);

  const lowRows = useMemo(
    () => attendance.filter((a) => a.status === 'Low' || (a.surplus_shortfall != null && a.surplus_shortfall < 0)),
    [attendance]
  );

  const breakRows = useMemo(
    () => attendance.filter((a) => Number(a.break_total || 0) > 0),
    [attendance]
  );

  const metrics = useMemo(() => {
    const attendanceDays = attendance.filter((a) => a.check_in).length;
    const leaveCount = leaves.length;
    const otCount = overtime.length;
    const lowCount = lowRows.length;
    return [
      { label: 'Attendance days', value: attendanceDays, accent: '', iconClass: 'blue', icon: <Clock3 size={18} /> },
      { label: 'Leave requests', value: leaveCount, accent: 'amber', iconClass: 'amber', icon: <CalendarDays size={18} /> },
      { label: 'Overtime entries', value: otCount, accent: 'violet', iconClass: 'violet', icon: <Timer size={18} /> },
      { label: 'Low hours days', value: lowCount, accent: 'coral', iconClass: 'coral', icon: <AlertTriangle size={18} /> },
    ];
  }, [attendance, leaves, overtime, lowRows]);

  const label = periodLabel(period, month, year);

  return (
    <div className="esum-page">
      <div className="page-header">
        <div>
          <h1>Employee Summary</h1>
          <p className="page-header-sub">Review one employee’s attendance, leaves, OT, and more</p>
        </div>
      </div>

      <div className="esum-toolbar card">
        <div className="esum-employee-pick">
          <span className="esum-pick-icon" aria-hidden>
            <UserRound size={18} />
          </span>
          <select
            className="select esum-employee-select"
            value={employeeId}
            onChange={(e) => setFilter('employee', e.target.value)}
            aria-label="Select employee"
          >
            <option value="">Select employee…</option>
            {emps.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
                {e.employee_id ? ` (${e.employee_id})` : ''}
                {deptName(e) ? ` · ${deptName(e)}` : ''}
              </option>
            ))}
          </select>
        </div>

        {(period === 'month' || period === 'year') && (
          <div className="esum-date-picks">
            {period === 'month' && (
              <select
                className="select select-month"
                value={month}
                onChange={(e) => setFilter('month', e.target.value)}
                aria-label="Month"
              >
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            )}
            <select
              className="select select-year"
              value={year}
              onChange={(e) => setFilter('year', e.target.value)}
              aria-label="Year"
            >
              {[2026, 2027, 2028, 2029].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        <div className="esum-filters">
          <div className="esum-period" role="group" aria-label="Duration filter">
            {(
              [
                ['today', 'Today'],
                ['month', 'Month'],
                ['year', 'Year'],
                ['all', 'All'],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                className={`esum-period-btn${period === id ? ' active' : ''}`}
                onClick={() => setFilter('period', id)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!employeeId && (
        <div className="card esum-empty">
          <UserRound size={36} strokeWidth={1.5} />
          <h3>Choose an employee</h3>
          <p>Select someone above to see their summary for the chosen duration.</p>
        </div>
      )}

      {employeeId && (
        <>
          <div className="esum-identity card card-accent">
            <div className="esum-avatar" aria-hidden>
              {(emp?.name || '?')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() || '')
                .join('')}
            </div>
            <div className="esum-identity-text">
              <div className="esum-identity-row">
                <h2>{emp?.name || 'Loading…'}</h2>
                {emp?.status && <StatusBadge status={emp.status} />}
              </div>
              <p>
                {emp?.employee_id || '—'}
                {deptName(emp) ? ` · ${deptName(emp)}` : ''}
                {emp?.email ? ` · ${emp.email}` : ''}
              </p>
            </div>
            <div className="esum-period-tag">{label}</div>
          </div>

          <div className="esum-metrics">
            {metrics.map((m) => (
              <div key={m.label} className={`card card-accent ${m.accent} esum-metric`}>
                <div className="dash-metric-top">
                  <span className={`stat-icon ${m.iconClass}`}>{m.icon}</span>
                </div>
                <span className="label">{m.label}</span>
                <div className="dash-metric-value">{loading ? '…' : m.value}</div>
                <span className="emp-stat-hint">{label}</span>
              </div>
            ))}
          </div>

          {(period === 'month' || period === 'today') && summary && (
            <div className="card card-accent teal esum-month-strip">
              <div>
                <span className="label">Hours counted</span>
                <strong>{formatHours(summary.monthly_counted_hours)}</strong>
                <span className="emp-stat-hint"> / {formatHours(summary.monthly_target_hours)} target</span>
              </div>
              <div>
                <span className="label">Overtime</span>
                <strong>{formatHours(summary.overtime_hours)}</strong>
              </div>
              <div>
                <span className="label">Leave days</span>
                <strong>{summary.approved_leave_days_in_month ?? 0}</strong>
              </div>
              <div>
                <span className="label">Balance</span>
                <strong>{hoursBadge(summary.monthly_shortfall_or_surplus)}</strong>
              </div>
            </div>
          )}

          <div className="card esum-panel">
            <div className="esum-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`esum-tab${tab === t.id ? ' active' : ''}`}
                  onClick={() => {
                    setTab(t.id);
                    setTabPage(1);
                  }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {error && <p style={{ color: 'var(--error)', margin: '0.75rem 0' }}>{error}</p>}
            {loading && <div className="state-box">Loading…</div>}

            {!loading && tab === 'attendance' && (
              <SummaryTable
                empty="No attendance records"
                head={['Date', 'Check-in', 'Check-out', 'Worked', 'Break', 'Status']}
                rows={attendance.map((a) => [
                  a.date,
                  displayClock(a.check_in),
                  displayClock(a.check_out),
                  formatWorked(a.working_hours),
                  formatBreakMinutes(a.break_total),
                  <span key="s" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    <StatusBadge status={a.status} />
                    {hoursBadge(a.surplus_shortfall, a.status)}
                  </span>,
                ])}
                page={tabPage}
                onPageChange={setTabPage}
              />
            )}

            {!loading && tab === 'breaks' && (
              <SummaryTable
                empty="No break time logged"
                head={['Date', 'Break', 'Check-in', 'Check-out', 'Status']}
                rows={breakRows.map((a) => [
                  a.date,
                  formatBreakMinutes(a.break_total),
                  displayClock(a.check_in),
                  displayClock(a.check_out),
                  <StatusBadge key="s" status={a.status} />,
                ])}
                page={tabPage}
                onPageChange={setTabPage}
              />
            )}

            {!loading && tab === 'leaves' && (
              <SummaryTable
                empty="No leave requests"
                head={['From', 'To', 'Day type', 'Reason', 'Status']}
                rows={leaves.map((l) => [
                  l.from_date,
                  l.to_date,
                  l.day_type || '—',
                  l.reason || '—',
                  <StatusBadge key="s" status={l.status} />,
                ])}
                page={tabPage}
                onPageChange={setTabPage}
              />
            )}

            {!loading && tab === 'overtime' && (
              <SummaryTable
                empty="No overtime requests"
                head={['Date', 'Hours', 'Type', 'Reason', 'Status']}
                rows={overtime.map((o) => [
                  o.date,
                  formatHours(o.hours),
                  o.ot_type || '—',
                  o.reason || '—',
                  <StatusBadge key="s" status={o.status} />,
                ])}
                page={tabPage}
                onPageChange={setTabPage}
              />
            )}

            {!loading && tab === 'performance' && (
              period === 'month' || period === 'today' ? (
                summary ? (
                  <div className="esum-perf-grid">
                    <PerfItem label="Working days" value={summary.working_days_in_month ?? '—'} />
                    <PerfItem label="Counted hours" value={formatHours(summary.monthly_counted_hours)} />
                    <PerfItem label="Target hours" value={formatHours(summary.monthly_target_hours)} />
                    <PerfItem label="Carry in" value={formatHours(summary.carried_forward_hours)} />
                    <PerfItem label="Attendance OT" value={formatHours(summary.attendance_ot_hours)} />
                    <PerfItem label="Management OT" value={formatHours(summary.management_ot_hours)} />
                    <PerfItem label="Low hours" value={formatHours(summary.low_hours)} />
                    <PerfItem label="Pending" value={formatHours(summary.pending_hours)} />
                    <PerfItem
                      label="Shortfall action"
                      value={summary.shortfall_action || '—'}
                    />
                    <PerfItem
                      label="Balance"
                      value={hoursBadge(summary.monthly_shortfall_or_surplus)}
                    />
                  </div>
                ) : (
                  <div className="state-box">No monthly summary</div>
                )
              ) : (
                <div className="state-box">
                  Switch to Month (or Today) to see the performance rollup for that period.
                </div>
              )
            )}

            {!loading && tab === 'early' && (
              <SummaryTable
                empty="No approved early checkouts"
                head={['Date', 'Left at', 'Shift end', 'Early', 'Worked', 'Status']}
                rows={earlyRows.map((a) => [
                  a.date,
                  displayClock(a.leaveAt),
                  displayClock(shiftEnd),
                  `${a.earlyMins}m`,
                  formatWorked(a.worked),
                  <StatusBadge key="s" status={a.status || a.attendanceStatus || 'Approved'} />,
                ])}
                page={tabPage}
                onPageChange={setTabPage}
              />
            )}

            {!loading && tab === 'low' && (
              <SummaryTable
                empty="No low-hour days"
                head={['Date', 'Worked', 'Shortfall', 'Check-in', 'Check-out', 'Status']}
                rows={lowRows.map((a) => [
                  a.date,
                  formatWorked(a.working_hours),
                  formatHours(a.surplus_shortfall),
                  displayClock(a.check_in),
                  displayClock(a.check_out),
                  <StatusBadge key="s" status={a.status} />,
                ])}
                page={tabPage}
                onPageChange={setTabPage}
              />
            )}

            {!loading && tab === 'salary' && (
              <SummaryTable
                empty="No salary slips"
                head={['Period', 'Target', 'Counted', 'OT', 'Shortfall', 'Net', 'Status']}
                rows={salary.map((s) => [
                  `${s.month || '—'}/${s.year || '—'}`,
                  formatHours(s.monthly_target_hours),
                  formatHours(s.monthly_counted_hours),
                  formatHours(s.overtime_hours),
                  formatHours(s.shortfall_hours),
                  s.net_pay != null ? `₹${Number(s.net_pay).toLocaleString('en-IN')}` : '—',
                  <span key="s" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    <StatusBadge status={s.status} />
                    <StatusBadge status={s.payment_status} />
                  </span>,
                ])}
                page={tabPage}
                onPageChange={setTabPage}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PerfItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="esum-perf-item">
      <span className="label">{label}</span>
      <div className="esum-perf-value">{value}</div>
    </div>
  );
}

function SummaryTable({
  head,
  rows,
  empty,
  page,
  onPageChange,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: string;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  if (!rows.length) return <div className="state-box">{empty}</div>;
  const pageSafe = page || 1;
  const start = (pageSafe - 1) * PAGE_SIZE;
  const visible = onPageChange ? rows.slice(start, start + PAGE_SIZE) : rows;
  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((cells, i) => (
              <tr key={i}>
                {cells.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onPageChange ? (
        <ListPagination total={rows.length} page={pageSafe} onPageChange={onPageChange} />
      ) : null}
    </>
  );
}
