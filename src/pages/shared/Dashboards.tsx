import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Clock3,
  Coffee,
  Download,
  FileText,
  LogIn,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api, apiUrl } from '../../services/api';
import { formatHours, hoursBadge, StatusBadge } from '../../components/StatusBadge';
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
import { Textarea } from '@/components/ui/textarea';
import {
  displayClock,
  formatDurationMinutes,
  minutesBetween,
  pad2,
  timeToSeconds,
  effectiveWorkStart,
  LATE_CHECKIN_PENALTY_MINUTES,
  displayDateTime,
} from '../../utils/timeFormat';

function nowHMS(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function EmployeeDashboard() {
  return (
    <div className="emp-dash">
      <PersonalAttendanceBody title="Dashboard" />
    </div>
  );
}

function PersonalAttendanceBody({ title }: { title: string }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [earlyErr, setEarlyErr] = useState('');
  const [earlyBusy, setEarlyBusy] = useState(false);
  const [tick, setTick] = useState(() => new Date());

  const load = () =>
    api('/attendance/me/today')
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed'));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const action = async (path: string) => {
    setBusy(true);
    setErr('');
    setEarlyOpen(false);
    try {
      await api(path, { method: 'POST', body: {} });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  // Poll while checked in (and not checked out) so HR decisions appear without a manual refresh.
  useEffect(() => {
    if (data?.attendance?.check_out) return;
    const id = window.setInterval(() => load(), 30000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(23, 55, 0, 0);
    const ms = cutoff.getTime() - now.getTime();
    const autoId =
      ms > 0
        ? window.setTimeout(() => load(), ms + 400)
        : window.setTimeout(() => load(), 400);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(autoId);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.attendance?.check_out]);

  const live = useMemo(() => {
    if (!data) return null;
    const att = data.attendance;
    const shift = data.shift || {};
    const now = nowHMS(tick);
    const checkedIn = !!att.check_in;
    const checkedOut = !!att.check_out;
    const onBreak = att.status === 'OnBreak' || !!att.break_started_at;

    let breakMins = Number(att.break_total || 0);
    let breakSessionMins = 0;
    if (onBreak && att.break_started_at && !checkedOut) {
      breakSessionMins = minutesBetween(att.break_started_at, now);
      breakMins = Number(att.break_total || 0) + breakSessionMins;
    }

    let workMins = 0;
    if (checkedIn) {
      let end = checkedOut ? att.check_out : now;
      // Open session / auto-checkout: time after shift end is not General OT
      if ((!checkedOut || att.auto_checkout) && shift.shift_end) {
        const endSec = timeToSeconds(end);
        const se = timeToSeconds(shift.shift_end);
        if (endSec != null && se != null && endSec > se) end = shift.shift_end;
      }
      const start =
        data.work_start ||
        effectiveWorkStart(att.check_in, shift.shift_start, !!att.penalty_waived) ||
        att.check_in;
      const span = minutesBetween(start, end);
      workMins = Math.max(0, span - breakMins);
    }

    const threshold = Number(shift.working_hours_per_day || 8);
    const workHours = workMins / 60;
    const overtimeMins = Math.max(0, workMins - threshold * 60);
    const shortfallMins = Math.max(0, threshold * 60 - workMins);
    const shiftEndSec = timeToSeconds(shift.shift_end);
    const nowSec = timeToSeconds(now)!;
    const isEarly = checkedIn && !checkedOut && shiftEndSec != null && nowSec < shiftEndSec;
    const penaltyMinutes = Number(data.penalty_minutes || 0);
    const lateMinutes = Number(data.late_minutes || 0);

    return {
      now,
      clock: now,
      breakMins,
      breakSessionMins,
      workMins,
      workHours,
      overtimeMins,
      shortfallMins,
      threshold,
      isEarly,
      onBreak,
      checkedIn,
      checkedOut,
      workStart: data.work_start || effectiveWorkStart(att.check_in, shift.shift_start, !!att.penalty_waived),
      penaltyMinutes,
      lateMinutes,
      penaltyWaived: !!att.penalty_waived,
      latePenaltyRule: Number(data.late_penalty_rule_minutes || LATE_CHECKIN_PENALTY_MINUTES),
    };
  }, [data, tick]);

  if (!data || !live) return <div className="state-box">{err || 'Loading…'}</div>;

  const att = data.attendance;
  const shift = data.shift || {};
  const summary = data.monthly_summary;
  const ecr = data.early_checkout_request || null;
  const monthTarget = Number(summary?.monthly_target_hours || 0);
  const monthCounted = Number(summary?.monthly_counted_hours || 0);
  const monthPct = monthTarget > 0 ? Math.min(100, Math.round((monthCounted / monthTarget) * 100)) : 0;
  const workedSeconds = Math.max(0, Math.round(live.workMins * 60));
  const workedClock = {
    hours: pad2(Math.floor(workedSeconds / 3600)),
    minutes: pad2(Math.floor((workedSeconds % 3600) / 60)),
    seconds: pad2(workedSeconds % 60),
  };

  const submitEarlyRequest = async () => {
    if (!earlyReason.trim()) {
      setEarlyErr('Please add a reason for leaving early.');
      return;
    }
    setEarlyBusy(true);
    setEarlyErr('');
    try {
      await api('/attendance/me/early-checkout-request', {
        method: 'POST',
        body: { reason: earlyReason },
      });
      setEarlyOpen(false);
      setEarlyReason('');
      await load();
    } catch (e) {
      setEarlyErr(e instanceof Error ? e.message : 'Failed to send request');
    } finally {
      setEarlyBusy(false);
    }
  };

  const cancelEarlyRequest = async () => {
    if (!ecr?._id) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/attendance/me/early-checkout-request/${ecr._id}/cancel`, { method: 'POST', body: {} });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to cancel request');
    } finally {
      setBusy(false);
    }
  };

  const requestCheckout = () => {
    if (ecr?.status === 'Pending') return;
    if (live.isEarly) {
      setEarlyOpen(true);
      return;
    }
    action('/attendance/me/check-out');
  };

  return (
    <>

      <section className="card attendance-widget">
        <header className="attendance-widget-head">
          <h3>Today's Attendance</h3>
          {live.checkedOut && hoursBadge(att.surplus_shortfall, att.status)}
        </header>

        <div className="attendance-widget-main">
          <div className="attendance-work-timer">
            <span className="attendance-eyebrow">Work Timer</span>
            <div className="attendance-clock" aria-label={`${workedClock.hours} hours, ${workedClock.minutes} minutes, ${workedClock.seconds} seconds`}>
              <div><strong>{workedClock.hours}</strong><span>hours</span></div>
              <b>:</b>
              <div><strong>{workedClock.minutes}</strong><span>minutes</span></div>
              <b>:</b>
              <div><strong>{workedClock.seconds}</strong><span>seconds</span></div>
            </div>
          </div>

          <div className="attendance-actions">
            {err && <p className="att-controls-error">{err}</p>}
            {!live.checkedIn && (
              <Button className="attendance-action attendance-action-primary" disabled={busy} onClick={() => action('/attendance/me/check-in')}>
                <LogIn size={16} /> Check In
              </Button>
            )}
            {live.checkedIn && !live.checkedOut && (
              <>
                <Button
                  variant="outline"
                  className={`attendance-action attendance-action-break ${live.onBreak ? 'is-active' : ''}`}
                  disabled={busy}
                  onClick={() => action(live.onBreak ? '/attendance/me/end-break' : '/attendance/me/start-break')}
                >
                  <Coffee size={16} /> {live.onBreak ? 'End Break' : 'Break'}
                </Button>
                <Button
                  className="attendance-action attendance-action-primary"
                  disabled={busy || ecr?.status === 'Pending'}
                  onClick={live.isEarly ? requestCheckout : () => action('/attendance/me/check-out')}
                >
                  {ecr?.status === 'Pending'
                    ? 'Early Checkout Pending'
                    : live.isEarly
                      ? 'Early Checkout Request'
                      : 'Check Out'}
                </Button>
                {ecr?.status === 'Pending' && (
                  <button className="attendance-cancel" disabled={busy} onClick={cancelEarlyRequest}>
                    Cancel request
                  </button>
                )}
              </>
            )}
            {live.checkedOut && (
              <div className="attendance-day-closed">
                Day closed{att.auto_checkout ? ' · Auto checkout' : ''}
              </div>
            )}
          </div>
        </div>

        <div className="attendance-widget-meta">
          <div><span>Check In</span><strong>{displayClock(att.check_in)}</strong></div>
          <div><span>Check Out</span><strong>{displayClock(att.check_out)}</strong></div>
          <div><span>Break Time</span><strong>{formatDurationMinutes(live.breakMins)}</strong></div>
          <div>
            <span>Status</span>
            <strong className={live.onBreak && !live.checkedOut ? 'is-on-break' : ''}>
              {live.onBreak && !live.checkedOut
                ? 'On Break'
                : live.checkedIn && !live.checkedOut
                  ? 'Active'
                  : live.checkedOut
                    ? 'Completed'
                    : 'Not Started'}
            </strong>
          </div>
        </div>

        {ecr?.status === 'Rejected' && (
          <div className="attendance-notice is-error">
            <strong>Early checkout request declined.</strong>{' '}
            {ecr.decision_note || 'HR/Admin did not approve your early checkout.'}
          </div>
        )}
        {ecr?.status === 'Approved' && !live.checkedOut && (
          <div className="attendance-notice is-success">Your early checkout request has been approved.</div>
        )}
      </section>

      <div className="emp-dash-stats">
        <div className="card emp-stat card-accent">
          <div className="stat-card">
            <span className="stat-icon blue"><Clock3 size={20} /></span>
            <div>
              <span className="label">Worked today</span>
              <div className="emp-stat-value">{formatDurationMinutes(live.workMins)}</div>
              <span className="emp-stat-hint">Live · breaks excluded</span>
            </div>
          </div>
        </div>
        <div className="card emp-stat card-accent amber">
          <div className="stat-card">
            <span className="stat-icon amber"><Coffee size={20} /></span>
            <div>
              <span className="label">Break time</span>
              <div className="emp-stat-value">{formatDurationMinutes(live.breakMins)}</div>
              <span className="emp-stat-hint">
                {live.onBreak && !live.checkedOut
                  ? `Live session · total today`
                  : live.breakMins > 0
                    ? 'Total for current day'
                    : 'No break yet'}
              </span>
            </div>
          </div>
        </div>
        <div className="card emp-stat card-accent coral">
          <div className="stat-card">
            <span className="stat-icon coral"><Timer size={20} /></span>
            <div>
              <span className="label">{live.overtimeMins > 0 ? 'Overtime today' : 'Remaining today'}</span>
              <div className={`emp-stat-value ${live.overtimeMins > 0 ? 'is-extra' : live.shortfallMins > 0 && live.checkedIn ? 'is-low' : ''}`}>
                {live.overtimeMins > 0
                  ? `+${formatDurationMinutes(live.overtimeMins)}`
                  : live.checkedIn
                    ? formatDurationMinutes(live.shortfallMins)
                    : formatHours(live.threshold)}
              </div>
              <span className="emp-stat-hint">
                {live.overtimeMins > 0 ? 'Above daily target' : live.checkedIn ? 'To hit daily target' : 'Target hours'}
              </span>
            </div>
          </div>
        </div>
        <div className="card emp-stat card-accent teal">
          <div className="stat-card">
            <span className="stat-icon teal"><TrendingUp size={20} /></span>
            <div>
              <span className="label">Month overtime</span>
              <div className="emp-stat-value is-extra">{formatHours(summary?.overtime_hours)}</div>
              <span className="emp-stat-hint">Counted Extra this month</span>
            </div>
          </div>
        </div>
      </div>

      <div className="emp-dash-month card card-accent violet">
        <div className="emp-dash-month-head">
          <h3 style={{ margin: 0 }}>Working hours this month</h3>
        </div>
        <p className="emp-dash-month-hours">
          {formatHours(monthCounted)} <span>/ {formatHours(monthTarget)}</span>
        </p>
        <div className="emp-progress">
          <div className="emp-progress-bar" style={{ width: `${monthPct}%` }} />
        </div>
        <div className="emp-dash-month-grid">
          <div>
            <span className="label">Working days</span>
            <strong>{summary?.working_days_in_month ?? '—'}</strong>
          </div>
          <div>
            <span className="label">Leave days</span>
            <strong>{summary?.approved_leave_days_in_month ?? 0}</strong>
          </div>
          <div>
            <span className="label">Overtime</span>
            <strong>{formatHours(summary?.overtime_hours)}</strong>
          </div>
          <div>
            <span className="label">Low</span>
            <strong>{formatHours(summary?.monthly_shortfall_or_surplus)}</strong>
          </div>
        </div>
      </div>

      <Dialog open={earlyOpen} onOpenChange={(o) => !o && setEarlyOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Early Checkout Request</DialogTitle>
            <DialogDescription>
              Your shift ends at {displayClock(shift.shift_end)} and the current time is {displayClock(live.clock)}. Leave a note so
              HR/Admin can approve your request — you'll stay checked in until they decide.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label className="label" htmlFor="early-reason">
              Reason <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <Textarea
              id="early-reason"
              rows={3}
              placeholder="e.g. Doctor's appointment, family emergency, personal work…"
              value={earlyReason}
              onChange={(e) => setEarlyReason(e.target.value)}
            />
          </div>
          {earlyErr && <p style={{ color: 'var(--error)', margin: 0 }}>{earlyErr}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={earlyBusy} onClick={() => setEarlyOpen(false)}>
              Cancel
            </Button>
            <Button disabled={earlyBusy} onClick={submitEarlyRequest}>
              {earlyBusy ? 'Sending…' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type DashTotals = {
  employees: number | null;
  departments: number | null;
  leavesPending: number | null;
  overtimePending: number | null;
};

function useDashTotals() {
  const [totals, setTotals] = useState<DashTotals>({
    employees: null,
    departments: null,
    leavesPending: null,
    overtimePending: null,
  });

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api<any>('/employees?limit=1'),
      api<any>('/departments?limit=1'),
      api<any>('/leaves?limit=1&status=Pending'),
      api<any>('/overtime?limit=1&status=Pending'),
    ]).then((results) => {
      if (!alive) return;
      const num = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? Number(r.value?.total ?? 0) : null;
      setTotals({
        employees: num(results[0]),
        departments: num(results[1]),
        leavesPending: num(results[2]),
        overtimePending: num(results[3]),
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  return totals;
}

function DashMetric({
  to,
  accent,
  iconClass,
  icon,
  label,
  value,
  hint,
}: {
  to: string;
  accent: string;
  iconClass: string;
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Link to={to} className={`card card-accent ${accent} dash-metric`}>
      <div className="dash-metric-top">
        <span className={`stat-icon ${iconClass}`}>{icon}</span>
        <ArrowUpRight size={16} className="dash-metric-arrow" aria-hidden />
      </div>
      <span className="label">{label}</span>
      <div className="dash-metric-value">{value}</div>
      <span className="emp-stat-hint">{hint}</span>
    </Link>
  );
}

export function AdminDashboard() {
  const [year, setYear] = useState(2026);
  const [wd, setWd] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const totals = useDashTotals();

  useEffect(() => {
    api(`/working-days?year=${year}`).then(setWd).catch(() => setWd(null));
  }, [year]);

  const fmt = (n: number | null) => (n == null ? '—' : n);

  return (
    <div className="dash-page">
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="page-header-sub">Overview of working calendar and system controls</p>
        </div>
      </div>

      <div className="dash-metrics">
        <DashMetric
          to="/admin/employees"
          accent=""
          iconClass="blue"
          icon={<Users size={20} />}
          label="Employees"
          value={fmt(totals.employees)}
          hint="Active roster"
        />
        <DashMetric
          to="/admin/departments"
          accent="teal"
          iconClass="teal"
          icon={<Building2 size={20} />}
          label="Departments"
          value={fmt(totals.departments)}
          hint="Teams & shifts"
        />
        <DashMetric
          to="/admin/leaves"
          accent="amber"
          iconClass="amber"
          icon={<CalendarDays size={20} />}
          label="Pending leaves"
          value={fmt(totals.leavesPending)}
          hint="Awaiting approval"
        />
        <DashMetric
          to="/admin/overtime"
          accent="violet"
          iconClass="violet"
          icon={<Timer size={20} />}
          label="Pending OT"
          value={fmt(totals.overtimePending)}
          hint="Overtime requests"
        />
      </div>

      <div className="dash-panels">
        <div className="card card-accent dash-hero-card">
          <div className="dash-panel-head">
            <div className="stat-card">
              <span className="stat-icon blue"><CalendarDays size={20} /></span>
              <div>
                <h3 style={{ margin: 0 }}>Working days</h3>
                <p className="emp-stat-hint" style={{ margin: '0.15rem 0 0' }}>
                  Calendar for {year}
                </p>
              </div>
            </div>
            <select
              className="select select-year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Year"
            >
              {[2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <p className="dash-hero-value">{wd?.working_days ?? '…'}</p>
          <p className="dash-hero-caption">
            {wd ? `${wd.working_days} of ${wd.total_days} days · ${year}` : `Counted working days for ${year}`}
          </p>

          <div className="dash-wd-chips">
            <span className="dash-chip">
              <strong>{wd?.total_days ?? '—'}</strong> total days
            </span>
            <span className="dash-chip teal">
              <strong>{wd?.non_working_days ?? '—'}</strong> non-working
            </span>
            <span className="dash-chip violet">
              <strong>{wd?.breakdown?.festivals ?? '—'}</strong> festivals
            </span>
          </div>

          <Button type="button" variant="outline" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} breakdown
          </Button>
          {open && wd?.breakdown && (
            <ul className="dash-breakdown">
              <li>Sundays: {wd.breakdown.sundays}</li>
              <li>Alt Saturdays: {wd.breakdown.alternate_saturdays}</li>
              <li>Festivals: {wd.breakdown.festivals}</li>
              <li>Manual holidays: {wd.breakdown.manual_holidays}</li>
              <li>Vacation days: {wd.breakdown.vacation_days}</li>
              <li className="dash-breakdown-total">
                Total off days: {wd.breakdown.sundays + wd.breakdown.alternate_saturdays + wd.breakdown.festivals + wd.breakdown.manual_holidays + wd.breakdown.vacation_days}
              </li>
              <li className="dash-breakdown-note">{wd.breakdown.note}</li>
            </ul>
          )}
        </div>

        <div className="card card-accent teal dash-shortcuts">
          <h3 style={{ marginTop: 0 }}>Quick links</h3>
          <div className="dash-shortcut-list">
            <Link to="/admin/summary"><Users size={16} /> Emp. Summary</Link>
            <Link to="/admin/analytics"><TrendingUp size={16} /> Analytics</Link>
            <Link to="/admin/attendance"><Clock3 size={16} /> Attendance</Link>
            <Link to="/admin/performance"><TrendingUp size={16} /> Performance</Link>
            <Link to="/admin/salary"><Wallet size={16} /> Salary</Link>
            <Link to="/admin/holidays"><CalendarDays size={16} /> Holidays</Link>
            <Link to="/admin/global"><Building2 size={16} /> Global / Bulk</Link>
            <Link to="/admin/audit"><ArrowUpRight size={16} /> Audit logs</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HrDashboard() {
  const totals = useDashTotals();
  const fmt = (n: number | null) => (n == null ? '—' : n);

  return (
    <div className="emp-dash">
      <PersonalAttendanceBody title="HR Dashboard" />

      <div className="dash-metrics">
        <DashMetric
          to="/hr/employees"
          accent=""
          iconClass="blue"
          icon={<Users size={20} />}
          label="Employees"
          value={fmt(totals.employees)}
          hint="Manage profiles"
        />
        <DashMetric
          to="/hr/leaves"
          accent="amber"
          iconClass="amber"
          icon={<CalendarDays size={20} />}
          label="Pending leaves"
          value={fmt(totals.leavesPending)}
          hint="Needs review"
        />
        <DashMetric
          to="/hr/overtime"
          accent="violet"
          iconClass="violet"
          icon={<Timer size={20} />}
          label="Pending OT"
          value={fmt(totals.overtimePending)}
          hint="Overtime requests"
        />
        <DashMetric
          to="/hr/attendance"
          accent="teal"
          iconClass="teal"
          icon={<Clock3 size={20} />}
          label="Attendance"
          value="Open"
          hint="Daily tracking"
        />
      </div>

      <div className="card card-accent dash-shortcuts">
        <h3 style={{ marginTop: 0 }}>Quick links</h3>
        <div className="dash-shortcut-list">
          <Link to="/hr/summary"><Users size={16} /> Emp. Summary</Link>
          <Link to="/hr/analytics"><TrendingUp size={16} /> Analytics</Link>
          <Link to="/hr/employees"><Users size={16} /> Employees</Link>
          <Link to="/hr/attendance"><Clock3 size={16} /> Attendance</Link>
          <Link to="/hr/performance"><TrendingUp size={16} /> Performance</Link>
          <Link to="/hr/salary"><Wallet size={16} /> Salary</Link>
          <Link to="/hr/holidays"><CalendarDays size={16} /> Holidays</Link>
        </div>
      </div>
    </div>
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  // Use UTC parts for date-only values stored at midnight UTC
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function displayValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return <span className="profile-empty">Not provided</span>;
  }
  return String(value);
}

function maskAccount(account?: string) {
  if (!account) return null;
  const digits = String(account).replace(/\s/g, '');
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="profile-field">
      <div className="label">{label}</div>
      <div className="profile-value">{children}</div>
    </div>
  );
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function ProfilePage() {
  const { user } = useAuth();
  const [emp, setEmp] = useState<any>(null);
  const [err, setErr] = useState('');
  const [revealAccount, setRevealAccount] = useState(false);
  const [offerErr, setOfferErr] = useState('');
  const [downloadingOffer, setDownloadingOffer] = useState(false);

  useEffect(() => {
    if (!user) return;
    setErr('');
    api(`/employees/${user._id}`)
      .then(setEmp)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load profile'));
  }, [user]);

  if (err) return <div className="state-box" style={{ color: 'var(--error)' }}>{err}</div>;
  if (!emp) return <div className="state-box">Loading…</div>;

  const pd = emp.profile_details || {};
  const bd = emp.bank_details || {};
  const bond = emp.bond_details || {};
  const bonds = Array.isArray(emp.bonds) && emp.bonds.length
    ? emp.bonds
    : (bond.bond_start_date || bond.bond_status)
      ? [bond]
      : [];
  const salarySchedule = Array.isArray(emp.salary_schedule) ? emp.salary_schedule : [];
  const photoSrc = emp.photo_url ? apiUrl(emp.photo_url) : null;
  const roleLabel = String(emp.role || '').replace(/^\w/, (c: string) => c.toUpperCase());

  return (
    <div className="profile-page">
      <div className="profile-header-row">
        <h1>My Profile</h1>
        <p className="profile-subtitle">View your personal, bank, and employment details</p>
      </div>

      <div className="card profile-hero card-accent">
        <div className="profile-hero-main">
          <div className="profile-avatar" aria-hidden>
            {photoSrc ? (
              <img src={photoSrc} alt="" />
            ) : (
              <span>{initials(emp.name)}</span>
            )}
          </div>
          <div className="profile-hero-text">
            <div className="profile-name-row">
              <h2>{emp.name}</h2>
              <StatusBadge status={emp.status} />
            </div>
            <p className="profile-meta">{emp.employee_id}</p>
            <div className="profile-chips">
              <span className="profile-chip">{emp.department_id?.name || 'No department'}</span>
              <span className="profile-chip">{roleLabel}</span>
              {emp.joining_date && (
                <span className="profile-chip">Joined {formatDate(emp.joining_date)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="profile-hero-contacts">
          <div>
            <div className="label">Work email</div>
            <div className="profile-value">
              {emp.email ? <a href={`mailto:${emp.email}`}>{emp.email}</a> : displayValue(null)}
            </div>
          </div>
          <div>
            <div className="label">Phone</div>
            <div className="profile-value">
              {emp.phone ? <a href={`tel:${emp.phone}`}>{emp.phone}</a> : displayValue(null)}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-sections">
        <div className="card">
          <h3>Documents</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={18} style={{ color: 'var(--muted)' }} />
              <div>
                <div className="profile-value">Offer letter</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {emp.offer_letter_url
                    ? emp.offer_letter_name || 'Available for download'
                    : 'Not uploaded by admin yet'}
                </div>
              </div>
            </div>
            {emp.offer_letter_url ? (
              <Button
                type="button"
                disabled={downloadingOffer}
                onClick={async () => {
                  setOfferErr('');
                  setDownloadingOffer(true);
                  try {
                    const blob = await api<Blob>(`/employees/${emp._id}/offer-letter`);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = emp.offer_letter_name || `Offer-Letter-${emp.employee_id || 'employee'}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    setOfferErr(e instanceof Error ? e.message : 'Download failed');
                  } finally {
                    setDownloadingOffer(false);
                  }
                }}
              >
                <Download size={16} />
                {downloadingOffer ? 'Downloading…' : 'Download'}
              </Button>
            ) : (
              <span className="badge badge-neutral">Unavailable</span>
            )}
          </div>
          {offerErr && <p style={{ color: 'var(--error)', marginTop: 8 }}>{offerErr}</p>}
        </div>

        <div className="card">
          <h3>Personal details</h3>
          <div className="form-grid profile-grid">
            <ProfileField label="Date of birth">{displayValue(formatDate(pd.dob))}</ProfileField>
            <ProfileField label="Gender">{displayValue(pd.gender)}</ProfileField>
            <ProfileField label="Blood group">{displayValue(pd.blood_group)}</ProfileField>
            <ProfileField label="Marital status">{displayValue(pd.marital_status)}</ProfileField>
            <ProfileField label="Personal email">
              {pd.personal_email ? (
                <a href={`mailto:${pd.personal_email}`}>{pd.personal_email}</a>
              ) : (
                displayValue(null)
              )}
            </ProfileField>
            <ProfileField label="Emergency contact">{displayValue(pd.emergency_contact)}</ProfileField>
            <ProfileField label="Aadhaar number">{displayValue(pd.aadhaar_number)}</ProfileField>
            <div className="profile-field profile-field-wide">
              <div className="label">Address</div>
              <div className="profile-value">{displayValue(pd.address)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Bank details</h3>
          <div className="form-grid profile-grid">
            <ProfileField label="Bank name">{displayValue(bd.bank_name)}</ProfileField>
            <ProfileField label="Account holder">{displayValue(bd.account_holder_name)}</ProfileField>
            <ProfileField label="Account number">
              {bd.account_number ? (
                <span className="profile-account">
                  <span>{revealAccount ? bd.account_number : maskAccount(bd.account_number)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="profile-reveal-btn"
                    onClick={() => setRevealAccount((v) => !v)}
                  >
                    {revealAccount ? 'Hide' : 'Show'}
                  </Button>
                </span>
              ) : (
                displayValue(null)
              )}
            </ProfileField>
            <ProfileField label="IFSC code">{displayValue(bd.ifsc_code)}</ProfileField>
            <ProfileField label="Tax ID / PAN">{displayValue(bd.tax_id)}</ProfileField>
          </div>
        </div>

        <div className="card">
          <h3>Bond details</h3>
          {!bonds.length ? (
            <p style={{ color: 'var(--muted)', margin: 0 }}>Not provided</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Joining proof</th>
                    <th>Proof status</th>
                    <th>Bond status</th>
                  </tr>
                </thead>
                <tbody>
                  {bonds.map((b: any, i: number) => (
                    <tr key={b._id || i}>
                      <td>{b.type || 'Job'}</td>
                      <td>{displayValue(formatDate(b.start_date || b.bond_start_date))}</td>
                      <td>{displayValue(formatDate(b.end_date || b.bond_end_date))}</td>
                      <td>
                        {b.proof_type === 'marksheet_12th'
                          ? '12th Marksheet'
                          : b.proof_type === 'salary_deduction'
                            ? `Salary deduction (${b.salary_deduction_percent || 15}%/month)`
                            : '—'}
                      </td>
                      <td>
                        {b.proof_status ? <StatusBadge status={b.proof_status} /> : '—'}
                        {b.proof_status === 'Returned' && b.proof_returned_date && (
                          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 2 }}>
                            {formatDate(b.proof_returned_date)}
                          </div>
                        )}
                      </td>
                      <td>
                        {(b.status || b.bond_status)
                          ? <StatusBadge status={b.status || b.bond_status} />
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Salary schedule</h3>
          {!salarySchedule.length ? (
            <div className="form-grid profile-grid">
              <ProfileField label="Current monthly salary">
                {emp.base_salary != null
                  ? `₹${Number(emp.base_salary).toLocaleString('en-IN')}`
                  : displayValue(null)}
              </ProfileField>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Band</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Monthly salary</th>
                  </tr>
                </thead>
                <tbody>
                  {salarySchedule.map((s: any, i: number) => (
                    <tr key={i}>
                      <td>{s.label || `Band ${i + 1}`}</td>
                      <td>{displayValue(formatDate(s.start_date))}</td>
                      <td>{displayValue(formatDate(s.end_date))}</td>
                      <td>₹{Number(s.monthly_salary || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GlobalDataPage() {
  const [depts, setDepts] = useState<any[]>([]);
  const [form, setForm] = useState({ department_id: '', month: String(new Date().getMonth() + 1), year: '2026' });
  const [msg, setMsg] = useState('');
  const [settings, setSettings] = useState({ overtime_multiplier: 1.5, deduction_multiplier: 1 });

  useEffect(() => {
    api<any>('/departments?limit=50').then((r) => setDepts(r.data));
    api<any>('/settings').then(setSettings).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Global / Bulk Data</h1>
          <p className="page-header-sub">Recalculate attendance and tune salary multipliers</p>
        </div>
      </div>
      <div className="card card-accent" style={{ marginBottom: 16 }}>
        <h3>Bulk monthly recalculation</h3>
        <div className="form-grid">
          <div>
            <label className="label">Department (optional)</label>
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">All</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Month</label>
            <select className="select" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="select" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
              {[2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <Button
          style={{ marginTop: 12 }}
          onClick={async () => {
            const res = await api<any>('/attendance/bulk/recalc', {
              method: 'POST',
              body: { ...form, month: Number(form.month), year: Number(form.year), department_id: form.department_id || undefined },
            });
            setMsg(`Recalculated ${res.employees} employees`);
          }}
        >
          Recalculate
        </Button>
        {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      </div>
      <div className="card card-accent teal">
        <h3>Salary rate settings</h3>
        <div className="form-grid">
          <div>
            <label className="label">OT multiplier</label>
            <input className="input" type="number" step="0.1" value={settings.overtime_multiplier} onChange={(e) => setSettings({ ...settings, overtime_multiplier: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Deduction multiplier</label>
            <input className="input" type="number" step="0.1" value={settings.deduction_multiplier} onChange={(e) => setSettings({ ...settings, deduction_multiplier: Number(e.target.value) })} />
          </div>
        </div>
        <Button style={{ marginTop: 12 }} onClick={async () => { await api('/settings', { method: 'PUT', body: settings }); setMsg('Settings saved'); }}>Save settings</Button>
      </div>
    </div>
  );
}

export function AuditPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    api<any>('/audit-logs?limit=50').then((r) => { setData(r.data); setTotal(r.total); });
  }, []);
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p className="page-header-sub">Recent system actions and changes</p>
        </div>
      </div>
      <div className="card card-accent violet">
        <p style={{ color: 'var(--muted)' }}>Total: {total}</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Time</th><th>Action</th><th>By</th><th>Target</th><th>Details</th></tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a._id}>
                  <td>{displayDateTime(a.timestamp)}</td>
                  <td>{a.action}</td>
                  <td>{a.performed_by?.name}</td>
                  <td>{a.target_employee_id?.name || '—'}</td>
                  <td><code style={{ fontSize: 12 }}>{JSON.stringify(a.details)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
