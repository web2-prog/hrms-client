import { useEffect, useMemo, useState } from 'react';
import { api, type ListResult } from '../services/api';
import { ListPagination, PAGE_SIZE } from './ListingPage';
import { StatusBadge, formatHours } from './StatusBadge';
import { EmpCell } from './EmpCell';
import { displayClock } from '../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type EcRequest = {
  _id: string;
  date: string;
  requested_time?: string;
  reason: string;
  status: string;
  decision_note?: string;
  employee_id?: { name: string; department_id?: { name: string } };
};

type CtRequest = {
  _id: string;
  date: string;
  requested_hours: number;
  actual_cover_hours?: number;
  reason?: string;
  status: string;
  decision_note?: string;
  employee_id?: { name: string; department_id?: { name: string } };
};

type OtRequest = {
  _id: string;
  date: string;
  hours: number;
  reason?: string;
  status: string;
  decision_note?: string;
  employee_id?: { name: string; department_id?: { name: string } };
};

type Leave = {
  _id: string;
  from_date: string;
  to_date: string;
  day_type?: 'Full Day' | 'Half Day';
  reason?: string;
  status: string;
  employee_id?: { name: string; department_id?: { name: string } };
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function leaveUrgencyChip(l: Leave, today: string) {
  if (l.from_date <= today && l.to_date >= today) {
    return <span className="priority-chip is-high">Ongoing</span>;
  }
  if (l.from_date <= addDays(today, 1)) {
    return <span className="priority-chip is-medium">Starts soon</span>;
  }
  return <span className="priority-chip is-low">Upcoming</span>;
}

/** HR/Admin approval queue for early checkout requests. */
export function EarlyCheckoutRequestsCard() {
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
          ? `Approved — ${req.employee_id?.name || 'employee'} can now check out from their dashboard.`
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
            Employees leaving before shift end need approval. Approving unlocks checkout — the employee
            must check out themselves.
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

/** HR/Admin approval queue for cover time requests. */
export function CoverTimeRequestsCard() {
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

/** HR/Admin approval queue for management overtime requests. */
export function OvertimeRequestsCard() {
  const [pending, setPending] = useState<OtRequest[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [recent, setRecent] = useState<OtRequest[]>([]);
  const [rejecting, setRejecting] = useState<OtRequest | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const [p, r] = await Promise.all([
        api<ListResult<OtRequest>>(
          `/overtime?status=Pending&source=requests&page=${pendingPage}&limit=${PAGE_SIZE}`
        ),
        api<ListResult<OtRequest>>(`/overtime?status=Approved&source=requests&page=1&limit=${PAGE_SIZE}`),
      ]);
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
      setRecent(r.data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load overtime requests');
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  const decide = async (req: OtRequest, status: 'Approved' | 'Rejected', decisionNote = '') => {
    setBusyId(req._id);
    setErr('');
    try {
      await api(`/overtime/${req._id}/decide`, {
        method: 'PATCH',
        body: {
          status,
          ot_type: status === 'Approved' ? 'Management' : undefined,
          decision_note: decisionNote,
        },
      });
      setMsg(
        status === 'Approved'
          ? `Approved management OT for ${req.employee_id?.name || 'employee'}.`
          : 'Overtime request rejected.'
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
          <h3 style={{ margin: 0 }}>Management Overtime Requests</h3>
          <p className="emp-action-help" style={{ margin: '4px 0 0' }}>
            Company-paid overtime requested after daily target. General OT is automatic at checkout and does not appear here.
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
        <p className="ecr-empty">No pending management overtime requests.</p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Hours</th>
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
                    <td>{r.date}</td>
                    <td className="num-cell"><strong>{formatHours(r.hours)}</strong></td>
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

      {recent.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--hairline)', paddingTop: 12 }}>
          <span className="label">Recent OT approvals</span>
          <div className="ecr-recent-list">
            {recent.slice(0, 5).map((r) => (
              <div key={r._id} className="ecr-recent-item">
                <span style={{ fontWeight: 600 }}>{r.employee_id?.name || '—'}</span>
                <StatusBadge status={r.status} />
                <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                  {formatHours(r.hours)} · {r.date}
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
            <DialogTitle>Reject management OT</DialogTitle>
          </DialogHeader>
          {rejecting && (
            <>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {rejecting.employee_id?.name || 'Employee'} · {formatHours(rejecting.hours)} · {rejecting.date}
              </p>
              <p style={{ margin: '8px 0 0' }}>{rejecting.reason || 'No reason given'}</p>
              <div className="grid gap-1.5">
                <label className="label" htmlFor="otr-note">
                  Note (optional)
                </label>
                <Textarea
                  id="otr-note"
                  rows={3}
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

/** HR/Admin approval queue for leave requests. */
export function LeaveRequestsCard() {
  const today = useMemo(() => todayYmd(), []);
  const [pending, setPending] = useState<Leave[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [recent, setRecent] = useState<Leave[]>([]);
  const [rejecting, setRejecting] = useState<Leave | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const [p, r] = await Promise.all([
        api<ListResult<Leave>>(`/leaves?status=Pending&page=${pendingPage}&limit=${PAGE_SIZE}`),
        api<ListResult<Leave>>(`/leaves?status=Approved&page=1&limit=${PAGE_SIZE}`),
      ]);
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
      setRecent(r.data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load leave requests');
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  const decide = async (req: Leave, status: 'Approved' | 'Rejected') => {
    setBusyId(req._id);
    setErr('');
    try {
      await api(`/leaves/${req._id}/decide`, { method: 'PATCH', body: { status } });
      setMsg(
        status === 'Approved'
          ? `Leave approved for ${req.employee_id?.name || 'employee'}.`
          : 'Leave request rejected.'
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
          <h3 style={{ margin: 0 }}>Leave Requests</h3>
          <p className="emp-action-help" style={{ margin: '4px 0 0' }}>
            Full-day and half-day leave applications awaiting HR/Admin decision.
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
        <p className="ecr-empty">No pending leave requests.</p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Day type</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((l) => (
                  <tr key={l._id}>
                    <td>
                      <EmpCell name={l.employee_id?.name} dept={l.employee_id?.department_id?.name} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{l.from_date}</span>
                        {leaveUrgencyChip(l, today)}
                      </div>
                    </td>
                    <td>{l.to_date}</td>
                    <td>
                      <span className={`hol-chip ${l.day_type === 'Half Day' ? 'is-saturday' : 'is-neutral'}`}>
                        {l.day_type || 'Full Day'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 280 }}>{l.reason || '—'}</td>
                    <td className="row-actions">
                      <Button size="sm" disabled={busyId === l._id} onClick={() => decide(l, 'Approved')}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === l._id}
                        onClick={() => {
                          setRejecting(l);
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

      {recent.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--hairline)', paddingTop: 12 }}>
          <span className="label">Recent leave approvals</span>
          <div className="ecr-recent-list">
            {recent.slice(0, 5).map((l) => (
              <div key={l._id} className="ecr-recent-item">
                <span style={{ fontWeight: 600 }}>{l.employee_id?.name || '—'}</span>
                <StatusBadge status={l.status} />
                <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                  {l.from_date} – {l.to_date} · {l.day_type || 'Full Day'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
          </DialogHeader>
          {rejecting && (
            <>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {rejecting.employee_id?.name || 'Employee'} · {rejecting.from_date} – {rejecting.to_date}
              </p>
              <p style={{ margin: '8px 0 0' }}>{rejecting.reason || 'No reason given'}</p>
              <DialogFooter>
                <Button variant="outline" disabled={busyId === rejecting._id} onClick={() => setRejecting(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={busyId === rejecting._id}
                  onClick={() => decide(rejecting, 'Rejected')}
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

export async function fetchPendingRequestCount(): Promise<number> {
  const num = (r: ListResult<unknown> | null) => Number(r?.total || 0);
  try {
    const [leaves, ot, early, cover] = await Promise.all([
      api<ListResult<unknown>>('/leaves?limit=1&status=Pending'),
      api<ListResult<unknown>>('/overtime?limit=1&status=Pending&source=requests'),
      api<ListResult<unknown>>('/attendance/early-checkout-requests?limit=1&status=Pending'),
      api<ListResult<unknown>>('/attendance/cover-time-requests?limit=1&status=Pending'),
    ]);
    return num(leaves) + num(ot) + num(early) + num(cover);
  } catch {
    return 0;
  }
}
