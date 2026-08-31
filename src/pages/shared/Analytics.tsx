import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  LogOut,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListPagination, PAGE_SIZE } from '../../components/ListingPage';
import { formatHours } from '../../components/StatusBadge';
import { RequireRole } from '../../components/StatusBadge';
import { Button } from '@/components/ui/button';

type AnalyticType =
  | 'working_hours'
  | 'early_checkout'
  | 'late_checkin'
  | 'penalty'
  | 'low_time'
  | 'overtime';

type OtFilter = 'all' | 'general' | 'management';
type BreakdownView = 'department' | 'employee';

type MonthRow = {
  month: number;
  label: string;
  total_working_hours: number;
  early_checkout_minutes: number;
  early_checkout_count: number;
  late_checkin_count: number;
  late_checkin_minutes: number;
  penalty_minutes: number;
  low_time_hours: number;
  low_time_count: number;
  overtime_all_hours: number;
  overtime_general_hours: number;
  overtime_management_hours: number;
  overtime_pending_hours: number;
  attendance_ot_hours: number;
};

type EmpRow = {
  employee_id: string;
  name: string;
  code?: string;
  department?: string;
  total_working_hours: number;
  early_checkout_minutes: number;
  early_checkout_count: number;
  late_checkin_count: number;
  late_checkin_minutes: number;
  penalty_minutes: number;
  low_time_hours: number;
  low_time_count: number;
  overtime_all_hours: number;
  overtime_general_hours: number;
  overtime_management_hours: number;
  overtime_pending_hours: number;
  attendance_ot_hours: number;
};

type DeptRow = {
  department_id: string | null;
  department: string;
  employee_count: number;
  attendance_days?: number;
  total_working_hours: number;
  early_checkout_minutes: number;
  early_checkout_count: number;
  late_checkin_count: number;
  late_checkin_minutes: number;
  penalty_minutes: number;
  low_time_hours: number;
  low_time_count: number;
  overtime_all_hours: number;
  overtime_general_hours: number;
  overtime_management_hours: number;
  overtime_pending_hours: number;
  attendance_ot_hours: number;
};

type AnalyticsPayload = {
  year: number;
  month: number | null;
  months: MonthRow[];
  totals: Omit<MonthRow, 'month' | 'label'>;
  employee_count: number;
  by_employee: EmpRow[];
  by_department: DeptRow[];
};

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const TYPES: {
  id: AnalyticType;
  title: string;
  blurb: string;
  unit: string;
  accent: string;
  iconClass: string;
  icon: typeof Clock3;
}[] = [
  {
    id: 'working_hours',
    title: 'Working Hours',
    blurb: 'Hours actually worked',
    unit: 'hours',
    accent: '',
    iconClass: 'blue',
    icon: Clock3,
  },
  {
    id: 'early_checkout',
    title: 'Early Checkout',
    blurb: 'Approved early-leave request minutes',
    unit: 'minutes',
    accent: 'amber',
    iconClass: 'amber',
    icon: LogOut,
  },
  {
    id: 'late_checkin',
    title: 'Late Check-in',
    blurb: 'Arrived after shift start',
    unit: 'incidents',
    accent: 'coral',
    iconClass: 'coral',
    icon: AlertTriangle,
  },
  {
    id: 'penalty',
    title: 'Late Penalty',
    blurb: 'Penalty minutes charged',
    unit: 'minutes',
    accent: 'violet',
    iconClass: 'violet',
    icon: Timer,
  },
  {
    id: 'low_time',
    title: 'Low Time',
    blurb: 'Short of daily hours',
    unit: 'hours',
    accent: 'coral',
    iconClass: 'coral',
    icon: TrendingDown,
  },
  {
    id: 'overtime',
    title: 'Overtime',
    blurb: 'Extra hours earned',
    unit: 'hours',
    accent: 'teal',
    iconClass: 'teal',
    icon: TrendingUp,
  },
];

function formatMinutes(mins?: number) {
  const m = Math.max(0, Math.round(Number(mins || 0)));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r}m`;
  return `${h}h ${r}m`;
}

function seriesValue(row: MonthRow, type: AnalyticType, ot: OtFilter) {
  switch (type) {
    case 'working_hours':
      return row.total_working_hours;
    case 'early_checkout':
      return row.early_checkout_minutes;
    case 'late_checkin':
      return row.late_checkin_count;
    case 'penalty':
      return row.penalty_minutes;
    case 'low_time':
      return row.low_time_hours;
    case 'overtime':
      if (ot === 'general') return row.overtime_general_hours;
      if (ot === 'management') return row.overtime_management_hours;
      return row.overtime_all_hours;
    default:
      return 0;
  }
}

function formatSeriesValue(type: AnalyticType, value: number) {
  if (type === 'working_hours' || type === 'low_time' || type === 'overtime') {
    return formatHours(value);
  }
  if (type === 'late_checkin') return String(Math.round(value));
  return formatMinutes(value);
}

function cardSnapshot(
  totals: AnalyticsPayload['totals'] | undefined,
  type: AnalyticType,
  ot: OtFilter
) {
  if (!totals) return { value: '—', hint: '' };
  switch (type) {
    case 'working_hours':
      return { value: formatHours(totals.total_working_hours), hint: 'worked' };
    case 'early_checkout':
      return {
        value: formatMinutes(totals.early_checkout_minutes),
        hint: `${totals.early_checkout_count} events`,
      };
    case 'late_checkin':
      return {
        value: String(totals.late_checkin_count),
        hint: formatMinutes(totals.late_checkin_minutes),
      };
    case 'penalty':
      return {
        value: formatMinutes(totals.penalty_minutes),
        hint: `${totals.late_checkin_count} late`,
      };
    case 'low_time':
      return {
        value: formatHours(totals.low_time_hours),
        hint: `${totals.low_time_count} days`,
      };
    case 'overtime':
      return {
        value: formatHours(
          ot === 'general'
            ? totals.overtime_general_hours
            : ot === 'management'
              ? totals.overtime_management_hours
              : totals.overtime_all_hours
        ),
        hint: `pending ${formatHours(totals.overtime_pending_hours)}`,
      };
    default:
      return { value: '—', hint: '' };
  }
}

function metricScore(
  row: Pick<
    EmpRow,
    | 'total_working_hours'
    | 'early_checkout_minutes'
    | 'late_checkin_count'
    | 'penalty_minutes'
    | 'low_time_hours'
    | 'overtime_all_hours'
    | 'overtime_general_hours'
    | 'overtime_management_hours'
  >,
  type: AnalyticType,
  ot: OtFilter
) {
  if (type === 'working_hours') return row.total_working_hours;
  if (type === 'early_checkout') return row.early_checkout_minutes;
  if (type === 'late_checkin') return row.late_checkin_count;
  if (type === 'penalty') return row.penalty_minutes;
  if (type === 'low_time') return row.low_time_hours;
  if (type === 'overtime') {
    if (ot === 'general') return row.overtime_general_hours;
    if (ot === 'management') return row.overtime_management_hours;
    return row.overtime_all_hours;
  }
  return 0;
}

function empMetric(row: EmpRow, type: AnalyticType, ot: OtFilter) {
  switch (type) {
    case 'working_hours':
      return formatHours(row.total_working_hours);
    case 'early_checkout':
      return `${formatMinutes(row.early_checkout_minutes)} · ${row.early_checkout_count}x`;
    case 'late_checkin':
      return `${row.late_checkin_count}`;
    case 'penalty':
      return formatMinutes(row.penalty_minutes);
    case 'low_time':
      return `${formatHours(row.low_time_hours)} · ${row.low_time_count}d`;
    case 'overtime':
      if (ot === 'general') return formatHours(row.overtime_general_hours);
      if (ot === 'management') return formatHours(row.overtime_management_hours);
      return formatHours(row.overtime_all_hours);
    default:
      return '—';
  }
}

function deptMetric(row: DeptRow, type: AnalyticType, ot: OtFilter) {
  switch (type) {
    case 'working_hours':
      return formatHours(row.total_working_hours);
    case 'early_checkout':
      return `${formatMinutes(row.early_checkout_minutes)} · ${row.early_checkout_count}x`;
    case 'late_checkin':
      return `${row.late_checkin_count}`;
    case 'penalty':
      return formatMinutes(row.penalty_minutes);
    case 'low_time':
      return `${formatHours(row.low_time_hours)} · ${row.low_time_count}d`;
    case 'overtime':
      if (ot === 'general') return formatHours(row.overtime_general_hours);
      if (ot === 'management') return formatHours(row.overtime_management_hours);
      return formatHours(row.overtime_all_hours);
    default:
      return '—';
  }
}

export default function AnalyticsPage() {
  return (
    <RequireRole roles={['admin', 'hr']}>
      <AnalyticsInner />
    </RequireRole>
  );
}

function AnalyticsInner() {
  const now = new Date();
  const [year, setYear] = useState(Math.max(2026, now.getFullYear()));
  const [month, setMonth] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [type, setType] = useState<AnalyticType>('working_hours');
  const [otFilter, setOtFilter] = useState<OtFilter>('all');
  const [view, setView] = useState<BreakdownView>('department');
  const [depts, setDepts] = useState<{ _id: string; name: string }[]>([]);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api<ListResult<any>>('/departments?limit=100')
      .then((r) => setDepts(r.data || []))
      .catch(() => setDepts([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [year, month, departmentId, type, otFilter, view]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api<AnalyticsPayload>(
      `/analytics${buildQuery({
        year,
        month: month || undefined,
        department_id: departmentId || undefined,
      })}`
    )
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e) => {
        if (alive) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Failed to load analytics');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year, month, departmentId]);

  const active = TYPES.find((t) => t.id === type)!;
  const selectedMonthNum = month ? Number(month) : null;
  const monthLabel = selectedMonthNum
    ? MONTH_OPTIONS.find((m) => m.value === selectedMonthNum)?.label
    : null;
  const scopeLabel = monthLabel ? `${monthLabel} ${year}` : `Full year ${year}`;
  const deptLabel = departmentId
    ? depts.find((d) => d._id === departmentId)?.name || 'Department'
    : 'All departments';

  const chart = useMemo(() => {
    const months = data?.months || [];
    const values = months.map((m) => seriesValue(m, type, otFilter));
    const max = Math.max(...values, 0);
    return months.map((m, i) => ({
      month: m.month,
      label: m.label,
      value: values[i],
      // Zero stays zero — avoids every metric looking like equal stub bars
      pct: max > 0 && values[i] > 0 ? Math.max(4, (values[i] / max) * 100) : 0,
      active: selectedMonthNum == null || m.month === selectedMonthNum,
    }));
  }, [data, type, otFilter, selectedMonthNum]);

  const chartHasData = chart.some((b) => b.value > 0);

  const kpi = useMemo(() => {
    const t = data?.totals;
    const emps = Math.max(1, data?.employee_count || 1);
    if (!t) return { primary: '—', secondary: '', extras: [] as { label: string; value: string }[] };
    switch (type) {
      case 'working_hours':
        return {
          primary: formatHours(t.total_working_hours),
          secondary: 'total hours worked',
          extras: [
            {
              label: 'Avg / employee',
              value: formatHours(t.total_working_hours / emps),
            },
          ],
        };
      case 'early_checkout':
        return {
          primary: formatMinutes(t.early_checkout_minutes),
          secondary: 'from approved early-leave requests',
          extras: [
            { label: 'Events', value: String(t.early_checkout_count) },
            {
              label: 'Avg / event',
              value:
                t.early_checkout_count > 0
                  ? formatMinutes(t.early_checkout_minutes / t.early_checkout_count)
                  : '0m',
            },
          ],
        };
      case 'late_checkin':
        return {
          primary: String(t.late_checkin_count),
          secondary: 'late arrival incidents',
          extras: [
            { label: 'Late minutes', value: formatMinutes(t.late_checkin_minutes) },
            {
              label: 'Avg late',
              value:
                t.late_checkin_count > 0
                  ? formatMinutes(t.late_checkin_minutes / t.late_checkin_count)
                  : '0m',
            },
          ],
        };
      case 'penalty':
        return {
          primary: formatMinutes(t.penalty_minutes),
          secondary: 'penalty minutes charged',
          extras: [
            { label: 'Late events', value: String(t.late_checkin_count) },
            {
              label: 'Avg penalty',
              value:
                t.late_checkin_count > 0
                  ? formatMinutes(t.penalty_minutes / t.late_checkin_count)
                  : '0m',
            },
          ],
        };
      case 'low_time':
        return {
          primary: formatHours(t.low_time_hours),
          secondary: 'hours under daily target',
          extras: [
            { label: 'Low days', value: String(t.low_time_count) },
            {
              label: 'Avg shortfall',
              value:
                t.low_time_count > 0 ? formatHours(t.low_time_hours / t.low_time_count) : formatHours(0),
            },
          ],
        };
      case 'overtime': {
        const v =
          otFilter === 'general'
            ? t.overtime_general_hours
            : otFilter === 'management'
              ? t.overtime_management_hours
              : t.overtime_all_hours;
        return {
          primary: formatHours(v),
          secondary:
            otFilter === 'all'
              ? 'all overtime hours'
              : otFilter === 'general'
                ? 'general overtime'
                : 'management overtime',
          extras: [
            { label: 'General', value: formatHours(t.overtime_general_hours) },
            { label: 'Management', value: formatHours(t.overtime_management_hours) },
            { label: 'Pending', value: formatHours(t.overtime_pending_hours) },
          ],
        };
      }
      default:
        return { primary: '—', secondary: '', extras: [] };
    }
  }, [data, type, otFilter]);

  // Exception metrics only list people/depts that actually have that issue
  const onlyPositive = type !== 'working_hours';

  const rankedDepts = useMemo(() => {
    if (!data?.by_department?.length) return [];
    const scored = data.by_department.map((d) => ({
      ...d,
      score: metricScore(d, type, otFilter),
    }));
    const filtered = onlyPositive ? scored.filter((d) => Number(d.score) > 0) : scored;
    return filtered.sort((a, b) => b.score - a.score);
  }, [data, type, otFilter, onlyPositive]);

  const rankedEmps = useMemo(() => {
    if (!data?.by_employee?.length) return [];
    const scored = data.by_employee.map((e) => ({
      ...e,
      score: metricScore(e, type, otFilter),
    }));
    const filtered = onlyPositive ? scored.filter((e) => Number(e.score) > 0) : scored;
    return filtered.sort((a, b) => b.score - a.score);
  }, [data, type, otFilter, onlyPositive]);

  const ranked = view === 'department' ? rankedDepts : rankedEmps;
  const pages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const paged = ranked.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <div className="an-page">
      <div className="page-header">
        <div className="an-header-left">
          <div>
            <h1>Analytics</h1>
            <p className="page-header-sub">
              Workforce trends by month, year, and department
            </p>
          </div>
        </div>
        <div className="an-toolbar-filters">
          <select
            className="select select-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Month"
          >
            <option value="">All months</option>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            className="select select-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Year"
          >
            {[2026, 2027, 2028, 2029].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label="Department"
          >
            <option value="">All departments</option>
            {depts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="an-scope-chip">
        Showing <strong>{scopeLabel}</strong>
        <span aria-hidden>·</span>
        <strong>{deptLabel}</strong>
      </div>

      <div className="an-type-grid">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const snap = cardSnapshot(data?.totals, t.id, otFilter);
          return (
            <button
              key={t.id}
              type="button"
              className={`card card-accent ${t.accent} an-type-card${type === t.id ? ' active' : ''}`}
              onClick={() => setType(t.id)}
            >
              <span className={`stat-icon ${t.iconClass}`}>
                <Icon size={18} />
              </span>
              <div className="an-type-card-body">
                <strong>{t.title}</strong>
                <p>{t.blurb}</p>
                <div className="an-type-card-value">{snap.value}</div>
                <span className="an-type-card-hint">{snap.hint || t.unit}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className={`card card-accent ${active.accent} an-panel`}>
        <div className="an-panel-head">
          <div>
            <h2>{active.title}</h2>
            <p className="page-header-sub" style={{ margin: 0 }}>
              Showing only {active.title.toLowerCase()} for {scopeLabel} · {deptLabel}
            </p>
          </div>
          {type === 'overtime' && (
            <div className="esum-period" role="group" aria-label="Overtime filter">
              {(
                [
                  ['all', 'All OT'],
                  ['general', 'General OT'],
                  ['management', 'Management OT'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`esum-period-btn${otFilter === id ? ' active' : ''}`}
                  onClick={() => setOtFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <div className="state-box">Loading analytics…</div>}
        {error && !loading && (
          <div className="state-box" style={{ color: 'var(--error)' }}>
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="an-kpi-row">
              <div className="an-kpi">
                <span className="label">{active.title}</span>
                <div className={`an-kpi-value${type === 'penalty' ? ' is-penalty' : ''}`}>
                  {kpi.primary}
                </div>
                <span className="emp-stat-hint">{kpi.secondary}</span>
              </div>
              {kpi.extras.map((extra) => (
                <div className="an-kpi" key={extra.label}>
                  <span className="label">{extra.label}</span>
                  <div className="an-kpi-value an-kpi-value-sm">{extra.value}</div>
                </div>
              ))}
              <div className="an-kpi">
                <span className="label">{view === 'department' ? 'Depts with data' : 'People with data'}</span>
                <div className="an-kpi-value an-kpi-value-sm">{ranked.length}</div>
                <span className="emp-stat-hint">
                  {onlyPositive ? 'non-zero for this metric' : 'in selected scope'}
                </span>
              </div>
            </div>

            <div className="an-chart-head">
              <h3 style={{ margin: 0 }}>{active.title} by month · {year}</h3>
              <span className="emp-stat-hint">
                {selectedMonthNum
                  ? `${monthLabel} selected — click again to clear`
                  : 'Click a month bar to filter tables'}
              </span>
            </div>
            {chartHasData ? (
              <div className="an-chart" aria-label={`${active.title} monthly chart`}>
                {chart.map((bar) => (
                  <button
                    key={bar.label}
                    type="button"
                    className={`an-bar-col${bar.active ? '' : ' is-dim'}${
                      selectedMonthNum === bar.month ? ' is-selected' : ''
                    }`}
                    onClick={() =>
                      setMonth((prev) => (prev === String(bar.month) ? '' : String(bar.month)))
                    }
                    title={`${bar.label}: ${formatSeriesValue(type, bar.value)}`}
                  >
                    <div className="an-bar-value">
                      {bar.value > 0 ? formatSeriesValue(type, bar.value) : '—'}
                    </div>
                    <div className="an-bar-track">
                      <div
                        className={`an-bar-fill an-bar-${type}`}
                        style={{ height: `${bar.pct}%` }}
                      />
                    </div>
                    <div className="an-bar-label">{bar.label}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="state-box an-empty-metric">
                No {active.title.toLowerCase()} in {scopeLabel} for {deptLabel}.
              </div>
            )}

            <div className="an-table-head">
              <div>
                <h3 style={{ margin: 0 }}>
                  {view === 'department' ? 'By department' : 'By employee'} · {active.title}
                </h3>
                <span className="emp-stat-hint">
                  {onlyPositive
                    ? `Only rows with ${active.title.toLowerCase()} · ${scopeLabel}`
                    : `Sorted by hours · ${scopeLabel}`}
                </span>
              </div>
              <div className="esum-period" role="group" aria-label="Breakdown view">
                <button
                  type="button"
                  className={`esum-period-btn${view === 'department' ? ' active' : ''}`}
                  onClick={() => setView('department')}
                >
                  Department
                </button>
                <button
                  type="button"
                  className={`esum-period-btn${view === 'employee' ? ' active' : ''}`}
                  onClick={() => setView('employee')}
                >
                  Employee
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  {view === 'department' ? (
                    <tr>
                      <th>Department</th>
                      <th>Employees</th>
                      <th>{active.title}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Employee</th>
                      <th>ID</th>
                      <th>Department</th>
                      <th>{active.title}</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={view === 'department' ? 3 : 4} style={{ color: 'var(--muted)' }}>
                        No {active.title.toLowerCase()} for this filter
                      </td>
                    </tr>
                  )}
                  {view === 'department' &&
                    (paged as typeof rankedDepts).map((d) => (
                      <tr key={String(d.department_id || d.department)}>
                        <td>{d.department}</td>
                        <td>{d.employee_count}</td>
                        <td className={type === 'penalty' ? 'penalty-mins' : undefined}>
                          {deptMetric(d, type, otFilter)}
                        </td>
                      </tr>
                    ))}
                  {view === 'employee' &&
                    (paged as typeof rankedEmps).map((e) => (
                      <tr key={String(e.employee_id)}>
                        <td>{e.name}</td>
                        <td>{e.code || '—'}</td>
                        <td>{e.department || '—'}</td>
                        <td className={type === 'penalty' ? 'penalty-mins' : undefined}>
                          {empMetric(e, type, otFilter)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <ListPagination total={ranked.length} page={pageSafe} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
