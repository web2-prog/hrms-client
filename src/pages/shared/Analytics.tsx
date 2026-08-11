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

type AnalyticsPayload = {
  year: number;
  months: MonthRow[];
  totals: Omit<MonthRow, 'month' | 'label'>;
  employee_count: number;
  by_employee: EmpRow[];
};

const TYPES: {
  id: AnalyticType;
  title: string;
  blurb: string;
  accent: string;
  iconClass: string;
  icon: typeof Clock3;
}[] = [
  {
    id: 'working_hours',
    title: 'Total Working Hours',
    blurb: 'Per-month total hours worked',
    accent: '',
    iconClass: 'blue',
    icon: Clock3,
  },
  {
    id: 'early_checkout',
    title: 'Early Checkout',
    blurb: 'Minutes left before shift end',
    accent: 'amber',
    iconClass: 'amber',
    icon: LogOut,
  },
  {
    id: 'late_checkin',
    title: 'Late Check-in',
    blurb: 'Late arrival incidents',
    accent: 'coral',
    iconClass: 'coral',
    icon: AlertTriangle,
  },
  {
    id: 'penalty',
    title: 'Penalty Minutes',
    blurb: 'Total lateness minutes',
    accent: 'violet',
    iconClass: 'violet',
    icon: Timer,
  },
  {
    id: 'low_time',
    title: 'Low Time',
    blurb: 'Hours below daily threshold',
    accent: 'coral',
    iconClass: 'coral',
    icon: TrendingDown,
  },
  {
    id: 'overtime',
    title: 'Working Hour Overtime',
    blurb: 'General & management OT',
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
  const [departmentId, setDepartmentId] = useState('');
  const [type, setType] = useState<AnalyticType>('working_hours');
  const [otFilter, setOtFilter] = useState<OtFilter>('all');
  const [depts, setDepts] = useState<{ _id: string; name: string }[]>([]);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    api<ListResult<any>>('/departments?limit=100')
      .then((r) => setDepts(r.data || []))
      .catch(() => setDepts([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [year, departmentId, type, otFilter]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api<AnalyticsPayload>(`/analytics${buildQuery({ year, department_id: departmentId || undefined })}`)
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
  }, [year, departmentId]);

  const active = TYPES.find((t) => t.id === type)!;

  const chart = useMemo(() => {
    const months = data?.months || [];
    const values = months.map((m) => seriesValue(m, type, otFilter));
    const max = Math.max(...values, 0.0001);
    return months.map((m, i) => ({
      label: m.label,
      value: values[i],
      pct: Math.max(2, (values[i] / max) * 100),
    }));
  }, [data, type, otFilter]);

  const kpi = useMemo(() => {
    const t = data?.totals;
    if (!t) return { primary: '—', secondary: '' };
    switch (type) {
      case 'working_hours':
        return { primary: formatHours(t.total_working_hours), secondary: 'hours worked this year' };
      case 'early_checkout':
        return {
          primary: formatMinutes(t.early_checkout_minutes),
          secondary: `${t.early_checkout_count} early checkout events`,
        };
      case 'late_checkin':
        return { primary: String(t.late_checkin_count), secondary: 'late arrival incidents' };
      case 'penalty':
        return { primary: formatMinutes(t.penalty_minutes), secondary: 'lateness minutes total' };
      case 'low_time':
        return {
          primary: formatHours(t.low_time_hours),
          secondary: `${t.low_time_count} low-hour days`,
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
              ? `Pending OT ${formatHours(t.overtime_pending_hours)}`
              : `${otFilter} overtime`,
        };
      }
      default:
        return { primary: '—', secondary: '' };
    }
  }, [data, type, otFilter]);

  const ranked = useMemo(() => {
    if (!data?.by_employee?.length) return [];
    const scored = [...data.by_employee].map((e) => {
      let score = 0;
      if (type === 'working_hours') score = e.total_working_hours;
      else if (type === 'early_checkout') score = e.early_checkout_minutes;
      else if (type === 'late_checkin') score = e.late_checkin_count;
      else if (type === 'penalty') score = e.penalty_minutes;
      else if (type === 'low_time') score = e.low_time_hours;
      else if (type === 'overtime') {
        score =
          otFilter === 'general'
            ? e.overtime_general_hours
            : otFilter === 'management'
              ? e.overtime_management_hours
              : e.overtime_all_hours;
      }
      return { ...e, score };
    });
    const filtered =
      type === 'overtime' ? scored.filter((e) => Number(e.score) > 0) : scored;
    return filtered.sort((a, b) => b.score - a.score);
  }, [data, type, otFilter]);

  const pages = Math.max(1, Math.ceil(ranked.length / limit));
  const pageSafe = Math.min(page, pages);
  const paged = ranked.slice((pageSafe - 1) * limit, pageSafe * limit);

  return (
    <div className="an-page">
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="page-header-sub">Workforce trends across hours, punctuality, and overtime</p>
        </div>
        <div className="an-toolbar-filters">
          <select
            className="select"
            style={{ width: 160 }}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label="Department"
          >
            <option value="">All departments</option>
            {depts.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 110 }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Year"
          >
            {[2026, 2027, 2028, 2029].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="an-type-grid">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`card card-accent ${t.accent} an-type-card${type === t.id ? ' active' : ''}`}
              onClick={() => setType(t.id)}
            >
              <span className={`stat-icon ${t.iconClass}`}><Icon size={18} /></span>
              <div>
                <strong>{t.title}</strong>
                <p>{t.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className={`card card-accent ${active.accent} an-panel`}>
        <div className="an-panel-head">
          <div>
            <h2>{active.title}</h2>
            <p className="page-header-sub" style={{ margin: 0 }}>{active.blurb} · {year}</p>
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
        {error && !loading && <div className="state-box" style={{ color: 'var(--error)' }}>{error}</div>}

        {!loading && !error && data && (
          <>
            <div className="an-kpi-row">
              <div className="an-kpi">
                <span className="label">Year total</span>
                <div className="an-kpi-value">{kpi.primary}</div>
                <span className="emp-stat-hint">{kpi.secondary}</span>
              </div>
              <div className="an-kpi">
                <span className="label">Employees</span>
                <div className="an-kpi-value">{data.employee_count}</div>
                <span className="emp-stat-hint">in selected scope</span>
              </div>
              {type === 'overtime' && (
                <div className="an-kpi">
                  <span className="label">Split</span>
                  <div className="an-kpi-split">
                    <span className="badge badge-teal">Gen {formatHours(data.totals.overtime_general_hours)}</span>
                    <span className="badge badge-violet">Mgmt {formatHours(data.totals.overtime_management_hours)}</span>
                    <span className="badge badge-warn">Pending {formatHours(data.totals.overtime_pending_hours)}</span>
                  </div>
                </div>
              )}
              {type === 'early_checkout' && (
                <div className="an-kpi">
                  <span className="label">Events</span>
                  <div className="an-kpi-value">{data.totals.early_checkout_count}</div>
                  <span className="emp-stat-hint">checkouts before shift end</span>
                </div>
              )}
            </div>

            <div className="an-chart" aria-label="Monthly chart">
              {chart.map((bar) => (
                <div key={bar.label} className="an-bar-col">
                  <div className="an-bar-value">{formatSeriesValue(type, bar.value)}</div>
                  <div className="an-bar-track">
                    <div
                      className={`an-bar-fill an-bar-${type}`}
                      style={{ height: `${bar.pct}%` }}
                      title={`${bar.label}: ${formatSeriesValue(type, bar.value)}`}
                    />
                  </div>
                  <div className="an-bar-label">{bar.label}</div>
                </div>
              ))}
            </div>

            <div className="an-table-head">
              <h3 style={{ margin: 0 }}>By employee</h3>
              <span className="emp-stat-hint">Sorted by this metric</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>ID</th>
                    <th>Department</th>
                    <th>{active.title}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--muted)' }}>No employee data</td>
                    </tr>
                  )}
                  {paged.map((e) => (
                    <tr key={String(e.employee_id)}>
                      <td>{e.name}</td>
                      <td>{e.code || '—'}</td>
                      <td>{e.department || '—'}</td>
                      <td>{empMetric(e, type, otFilter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Total: {ranked.length}</span>
              <select
                className="select"
                style={{ width: 90 }}
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span>
                Page {pageSafe} / {pages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={pageSafe >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
