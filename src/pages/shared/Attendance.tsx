import { useEffect, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { hoursBadge, formatHours } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { displayClock, formatBreakMinutes, parseBreakMinutes } from '../../utils/timeFormat';

type Att = {
  _id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  break_total?: number;
  working_hours?: number;
  status?: string;
  surplus_shortfall?: number;
  employee_id?: { _id: string; name: string; department_id?: { name: string } };
};

type EditState = Att & { break_display?: string };

export function AttendancePage(_props: { allowBulk?: boolean }) {
  const list = useListParams();
  const { user } = useAuth();
  const [data, setData] = useState<Att[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [depts, setDepts] = useState<{ _id: string; name: string }[]>([]);
  const [emps, setEmps] = useState<{ _id: string; name: string }[]>([]);

  const year = list.get('year') || String(new Date().getFullYear());
  const month = list.get('month') || String(new Date().getMonth() + 1);

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
        month,
        year,
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

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);
  useEffect(() => {
    if (user?.role !== 'employee') {
      api<ListResult<any>>('/departments?limit=50').then((r) => setDepts(r.data));
      api<ListResult<any>>('/employees?limit=100').then((r) => setEmps(r.data)).catch(() => {});
    }
  }, [user]);

  const openEdit = (r: Att) => {
    setEdit({
      ...r,
      break_display: String(Math.floor(r.break_total ?? 0)),
    });
  };

  return (
    <>
      <ListingPage
        title="Attendance"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <>
            {user?.role !== 'employee' && (
              <>
                <select className="select" style={{ width: 140 }} value={list.get('department_id')} onChange={(e) => list.setFilter('department_id', e.target.value)}>
                  <option value="">Department</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
                <select className="select" style={{ width: 160 }} value={list.get('employee_id')} onChange={(e) => list.setFilter('employee_id', e.target.value)}>
                  <option value="">Employee</option>
                  {emps.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
              </>
            )}
            <select className="select" style={{ width: 100 }} value={month} onChange={(e) => list.setFilter('month', e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="select" style={{ width: 100 }} value={year} onChange={(e) => list.setFilter('year', e.target.value)}>
              {[2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="select" style={{ width: 120 }} value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
              <option value="">Status</option>
              {['Extra', 'Low', 'OnTime', 'Working', 'OnBreak', 'Absent'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>In</th>
                <th>Out</th>
                <th>Break</th>
                <th>Hours</th>
                <th>Status / OT</th>
                {(user?.role === 'admin' || user?.role === 'hr') && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r._id}>
                  <td>{r.date}</td>
                  <td>{r.employee_id?.name || '—'}</td>
                  <td>{displayClock(r.check_in)}</td>
                  <td>{displayClock(r.check_out)}</td>
                  <td>{formatBreakMinutes(r.break_total ?? 0)}</td>
                  <td>{formatHours(r.working_hours)}</td>
                  <td>{hoursBadge(r.surplus_shortfall, r.status)}</td>
                  {(user?.role === 'admin' || user?.role === 'hr') && (
                    <td><button className="btn btn-ghost" onClick={() => openEdit(r)}>Manage</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>
      {edit && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Edit attendance — {edit.date}</h2>
            <div className="form-grid">
              <div>
                <label className="label">Check-in (HH:MM:SS)</label>
                <input
                  className="input"
                  placeholder="09:00:00"
                  value={edit.check_in || ''}
                  onChange={(e) => setEdit({ ...edit, check_in: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Check-out (HH:MM:SS)</label>
                <input
                  className="input"
                  placeholder="18:00:00"
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
                  step={1}
                  placeholder="24"
                  value={edit.break_display ?? String(Math.floor(edit.break_total ?? 0))}
                  onChange={(e) => setEdit({ ...edit, break_display: e.target.value })}
                />
              </div>
            </div>
            <p className="emp-action-help" style={{ marginTop: 8 }}>
              Times use seconds (HH:MM:SS). Break is shown in whole minutes (e.g. 24m). Hours and OT recalculate on save.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button
                className="btn"
                onClick={async () => {
                  const breakMins = parseBreakMinutes(edit.break_display ?? edit.break_total ?? 0);
                  await api(`/attendance/${edit._id}`, {
                    method: 'PUT',
                    body: {
                      check_in: edit.check_in,
                      check_out: edit.check_out,
                      break_total: breakMins,
                    },
                  });
                  setEdit(null);
                  load();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
