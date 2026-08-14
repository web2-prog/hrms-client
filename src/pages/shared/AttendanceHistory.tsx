import { useEffect, useState } from 'react';
import { Clock3, Coffee, Timer, TrendingUp } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, hoursBadge, formatHours } from '../../components/StatusBadge';
import { displayClock, formatDurationMinutes } from '../../utils/timeFormat';

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
};

type MonthSummary = {
  monthly_target_hours?: number;
  monthly_counted_hours?: number;
  overtime_hours?: number;
  monthly_shortfall_or_surplus?: number;
  working_days_in_month?: number;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AttendanceHistoryPage() {
  const list = useListParams();
  const [data, setData] = useState<Att[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = list.get('year') || String(new Date().getFullYear());
  const month = list.get('month') || String(new Date().getMonth() + 1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        status: list.get('status'),
        month,
        year,
      });
      const [attRes, monthRes] = await Promise.all([
        api<ListResult<Att>>(`/attendance${q}`),
        api<MonthSummary>(`/monthly-summary${buildQuery({ month, year })}`).catch(() => null),
      ]);
      setData(attRes.data);
      setTotal(attRes.total);
      setSummary(monthRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.page, list.limit, list.params]);

  const monthLabel = `${MONTH_NAMES[Number(month) - 1] || month} ${year}`;
  const monthTarget = Number(summary?.monthly_target_hours || 0);
  const monthCounted = Number(summary?.monthly_counted_hours || 0);

  return (
    <div className="emp-dash">
      <div className="page-header">
        <div>
          <h1>Attendance History</h1>
          <p className="page-header-sub">
            Your daily check-in, check-out, break, and overtime for {monthLabel}
          </p>
        </div>
      </div>

      <div className="emp-dash-stats">
        <div className="card emp-stat card-accent">
          <div className="stat-card">
            <span className="stat-icon blue"><Clock3 size={20} /></span>
            <div>
              <span className="label">Hours this month</span>
              <div className="emp-stat-value">{formatHours(monthCounted)}</div>
              <span className="emp-stat-hint">of {formatHours(monthTarget)} target</span>
            </div>
          </div>
        </div>
        <div className="card emp-stat card-accent teal">
          <div className="stat-card">
            <span className="stat-icon teal"><TrendingUp size={20} /></span>
            <div>
              <span className="label">Month overtime</span>
              <div className="emp-stat-value is-extra">{formatHours(summary?.overtime_hours)}</div>
              <span className="emp-stat-hint">Counted extra</span>
            </div>
          </div>
        </div>
        <div className="card emp-stat card-accent coral">
          <div className="stat-card">
            <span className="stat-icon coral"><Timer size={20} /></span>
            <div>
              <span className="label">Balance</span>
              <div className={`emp-stat-value ${(summary?.monthly_shortfall_or_surplus ?? 0) >= 0 ? 'is-extra' : 'is-low'}`}>
                {formatHours(summary?.monthly_shortfall_or_surplus)}
              </div>
              <span className="emp-stat-hint">Surplus / shortfall</span>
            </div>
          </div>
        </div>
        <div className="card emp-stat card-accent amber">
          <div className="stat-card">
            <span className="stat-icon amber"><Coffee size={20} /></span>
            <div>
              <span className="label">Working days</span>
              <div className="emp-stat-value">{summary?.working_days_in_month ?? '—'}</div>
              <span className="emp-stat-hint">{total} day{total === 1 ? '' : 's'} in this view</span>
            </div>
          </div>
        </div>
      </div>

      <ListingPage
        hideSearch
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <>
            <select className="select select-month" value={month} onChange={(e) => list.setFilter('month', e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {MONTH_NAMES[m - 1]}
                </option>
              ))}
            </select>
            <select className="select select-year" value={year} onChange={(e) => list.setFilter('year', e.target.value)}>
              {[2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        }
        typeFilters={
          <select className="select" value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {['Extra', 'Low', 'OnTime', 'Working', 'OnBreak', 'Absent'].map((s) => (
              <option key={s} value={s}>
                {s === 'OnTime' ? 'On time' : s === 'OnBreak' ? 'On break' : s}
              </option>
            ))}
          </select>
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Break</th>
                <th>Worked</th>
                <th>Overtime</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r._id}>
                  <td>{r.date}</td>
                  <td>{displayClock(r.check_in)}</td>
                  <td>
                    {displayClock(r.check_out)}
                    {r.auto_checkout ? <div className="label">Auto 11:55 PM</div> : null}
                  </td>
                  <td>{formatDurationMinutes(r.break_total ?? 0)}</td>
                  <td>{formatHours(r.working_hours)}</td>
                  <td>
                    {!r.auto_checkout && Number(r.surplus_shortfall) > 0
                      ? hoursBadge(r.surplus_shortfall, r.status)
                      : '—'}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <StatusBadge status={r.status} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>
    </div>
  );
}

export default AttendanceHistoryPage;
