import { useEffect, useMemo, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, formatHours } from '../../components/StatusBadge';
import { displayClock, formatBreakMinutes, formatClockInput, parseBreakMinutes, to24HourClock } from '../../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TodayRow = {
  employee: {
    _id: string;
    name: string;
    employee_id?: string;
    email?: string;
    department_id?: { _id: string; name: string } | null;
  };
  date: string;
  attendance_id?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  work_start?: string | null;
  break_total?: number;
  break_started_at?: string | null;
  working_hours?: number;
  live_work_minutes?: number;
  live_break_minutes?: number;
  live_status: string;
  status?: string;
  penalty_waived?: boolean;
  late_minutes?: number;
  penalty_minutes?: number;
  shift?: { shift_start?: string; shift_end?: string; working_hours_per_day?: number };
};

type TodayResult = ListResult<TodayRow> & {
  date: string;
  now?: string;
  counts?: Record<string, number>;
};

type EditState = {
  employeeId: string;
  name: string;
  check_in: string;
  check_out: string;
  break_display: string;
  break_started_at: string;
  penalty_waived: boolean;
  end_break: boolean;
};

const LIVE_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'Working', label: 'Working' },
  { value: 'OnBreak', label: 'On break' },
  { value: 'OnOvertime', label: 'On overtime' },
  { value: 'Absent', label: 'Absent' },
  { value: 'OnTime', label: 'On time' },
  { value: 'Extra', label: 'Extra' },
  { value: 'Low', label: 'Low' },
] as const;

export function TodayAttendancePage() {
  const list = useListParams();
  const [data, setData] = useState<TodayRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depts, setDepts] = useState<{ _id: string; name: string }[]>([]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        department_id: list.get('department_id'),
        live_status: list.get('live_status'),
      });
      const res = await api<TodayResult>(`/attendance/today${q}`);
      setData(res.data || []);
      setTotal(res.total || 0);
      setCounts(res.counts || {});
      setDate(res.date || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.page, list.limit, list.search, list.params]);

  useEffect(() => {
    api<ListResult<{ _id: string; name: string }>>('/departments?limit=50')
      .then((r) => setDepts(r.data))
      .catch(() => {});
  }, []);

  const summary = useMemo(
    () => [
      { label: 'Working', value: counts.Working || 0, key: 'Working' },
      { label: 'On break', value: counts.OnBreak || 0, key: 'OnBreak' },
      { label: 'On overtime', value: counts.OnOvertime || 0, key: 'OnOvertime' },
      { label: 'Absent', value: counts.Absent || 0, key: 'Absent' },
    ],
    [counts]
  );

  const openEdit = (r: TodayRow) => {
    setEdit({
      employeeId: r.employee._id,
      name: r.employee.name,
      check_in: formatClockInput(r.check_in),
      check_out: formatClockInput(r.check_out),
      break_display: String(Math.floor(r.break_total ?? 0)),
      break_started_at: formatClockInput(r.break_started_at),
      penalty_waived: !!r.penalty_waived,
      end_break: false,
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/attendance/today/${edit.employeeId}`, {
        method: 'PUT',
        body: {
          check_in: to24HourClock(edit.check_in),
          check_out: to24HourClock(edit.check_out),
          break_total: parseBreakMinutes(edit.break_display),
          break_started_at: edit.end_break ? null : to24HourClock(edit.break_started_at),
          end_break: edit.end_break,
          penalty_waived: edit.penalty_waived,
        },
      });
      setEdit(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="today-summary" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {summary.map((s) => (
          <button
            key={s.key}
            type="button"
            className="card"
            style={{
              padding: '12px 16px',
              minWidth: 120,
              cursor: 'pointer',
              border:
                list.get('live_status') === s.key ? '1px solid var(--color-primary, #1a3866)' : undefined,
            }}
            onClick={() =>
              list.setFilter('live_status', list.get('live_status') === s.key ? '' : s.key)
            }
          >
            <div className="label">{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{s.value}</div>
          </button>
        ))}
      </div>

      <ListingPage
        title={`Today${date ? ` — ${date}` : ''}`}
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <select
            className="select"
            value={list.get('department_id')}
            onChange={(e) => list.setFilter('department_id', e.target.value)}
          >
            <option value="">Department</option>
            {depts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        }
        typeFilters={
          <select
            className="select"
            value={list.get('live_status')}
            onChange={(e) => list.setFilter('live_status', e.target.value)}
          >
            {LIVE_STATUSES.map((s) => (
              <option key={s.value || 'all'} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dept</th>
                <th>In</th>
                <th>Work from</th>
                <th>Out</th>
                <th>Break</th>
                <th>Worked</th>
                <th>Status</th>
                <th>Penalty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.employee._id}>
                  <td>
                    <div>{r.employee.name}</div>
                    <div className="label">{r.employee.employee_id}</div>
                  </td>
                  <td>{r.employee.department_id?.name || '—'}</td>
                  <td>{displayClock(r.check_in)}</td>
                  <td>{displayClock(r.work_start || r.check_in)}</td>
                  <td>{displayClock(r.check_out)}</td>
                  <td>
                    {formatBreakMinutes(r.live_break_minutes ?? r.break_total ?? 0)}
                    {r.break_started_at ? (
                      <div className="label">since {displayClock(r.break_started_at)}</div>
                    ) : null}
                  </td>
                  <td>{formatHours(r.working_hours)}</td>
                  <td>
                    <StatusBadge status={r.live_status} />
                  </td>
                  <td>
                    {r.late_minutes && r.late_minutes > 0 ? (
                      r.penalty_waived ? (
                        <span className="label">Waived</span>
                      ) : (
                        <span>{Math.round(r.penalty_minutes || 15)}m penalty</span>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Button variant="outline" onClick={() => openEdit(r)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage today — {edit?.name}</DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="form-grid">
                <div>
                  <label className="label">Check-in (e.g. 9:15:00 AM)</label>
                  <input
                    className="input"
                    placeholder="9:15:00 AM"
                    value={edit.check_in}
                    onChange={(e) => setEdit({ ...edit, check_in: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Check-out (e.g. 5:30:00 PM)</label>
                  <input
                    className="input"
                    placeholder="5:30:00 PM"
                    value={edit.check_out}
                    onChange={(e) => setEdit({ ...edit, check_out: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Break (minutes)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={1}
                    value={edit.break_display}
                    onChange={(e) => setEdit({ ...edit, break_display: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Break started at (optional)</label>
                  <input
                    className="input"
                    placeholder="1:00:00 PM"
                    value={edit.break_started_at}
                    disabled={edit.end_break}
                    onChange={(e) => setEdit({ ...edit, break_started_at: e.target.value })}
                  />
                </div>
              </div>
              <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={edit.end_break}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      end_break: e.target.checked,
                      break_started_at: e.target.checked ? '' : edit.break_started_at,
                    })
                  }
                />
                End active break now (adds elapsed to break total)
              </label>
              <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={edit.penalty_waived}
                  onChange={(e) => setEdit({ ...edit, penalty_waived: e.target.checked })}
                />
                Remove / waive late check-in penalty (work starts from actual check-in; no +15m)
              </label>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveEdit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TodayAttendancePage;
