import { useEffect, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, hoursBadge, formatHours } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { displayClock, formatBreakMinutes, formatClockInput, parseBreakMinutes, to24HourClock } from '../../utils/timeFormat';
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
      check_in: formatClockInput(r.check_in),
      check_out: formatClockInput(r.check_out),
      break_display: String(Math.floor(r.break_total ?? 0)),
    });
  };

  return (
    <>
      {user?.role !== 'employee' && <EarlyCheckoutRequestsCard />}
      <ListingPage
        title="Attendance"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <>
            <select className="select select-month" value={month} onChange={(e) => list.setFilter('month', e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="select select-year" value={year} onChange={(e) => list.setFilter('year', e.target.value)}>
              {[2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {user?.role !== 'employee' && (
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
                  <td>
                    {displayClock(r.check_out)}
                    {r.auto_checkout ? <div className="label">Auto 11:55 PM</div> : null}
                  </td>
                  <td>{formatBreakMinutes(r.break_total ?? 0)}</td>
                  <td>{formatHours(r.working_hours)}</td>
                  <td>{hoursBadge(r.surplus_shortfall, r.status === 'OnBreak' ? 'Working' : r.status)}</td>
                  {(user?.role === 'admin' || user?.role === 'hr') && (
                    <td><Button variant="outline" onClick={() => openEdit(r)}>Manage</Button></td>
                  )}
                </tr>
              ))}
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
                  step={1}
                  placeholder="24"
                  value={edit.break_display ?? String(Math.floor(edit.break_total ?? 0))}
                  onChange={(e) => setEdit({ ...edit, break_display: e.target.value })}
                />
              </div>
            </div>
            <p className="emp-action-help" style={{ marginTop: 8 }}>
              Times use 12-hour clock with AM/PM (e.g. 9:15:00 AM). Break is shown in whole minutes (e.g. 24m). Hours and OT recalculate on save.
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
        api<ListResult<EcRequest>>('/attendance/early-checkout-requests?status=Pending&limit=50'),
        api<ListResult<EcRequest>>('/attendance/early-checkout-requests?limit=8'),
      ]);
      setPending(p.data || []);
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
  }, []);

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
          {pending.length > 0 && <span className="badge badge-warn">{pending.length} pending</span>}
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {msg && <p style={{ color: 'var(--success)', margin: '0.75rem 0 0' }}>{msg}</p>}
      {err && <p style={{ color: 'var(--error)', margin: '0.75rem 0 0' }}>{err}</p>}

      {pending.length === 0 ? (
        <p className="ecr-empty">No pending early checkout requests.</p>
      ) : (
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
                    <div>{r.employee_id?.name || '—'}</div>
                    {r.employee_id?.department_id?.name && (
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{r.employee_id.department_id.name}</div>
                    )}
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
