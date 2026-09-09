import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type ListResult } from '../services/api';
import { ListPagination, PAGE_SIZE } from './ListingPage';
import { StatusBadge, formatHours } from './StatusBadge';
import { EmpCell } from './EmpCell';
import { displayClock } from '../utils/timeFormat';
import { useAuth } from '../context/AuthContext';
import { canDecideRequest } from '../lib/staffPermissions';
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

type EmpRef = {
  _id?: string;
  name: string;
  role?: 'admin' | 'hr' | 'employee' | string;
  department_id?: { name: string };
};

type EcRequest = {
  _id: string;
  date: string;
  requested_time?: string;
  reason: string;
  status: string;
  decision_note?: string;
  employee_id?: EmpRef;
  already_checked_out?: boolean;
  auto_checkout?: boolean;
};

function isAutoClosedEcrNote(note?: string) {
  if (!note) return false;
  return /auto-checked out at 11:55/i.test(note);
}

function formatEcrDate(ymd?: string) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const RECENT_DAYS = 10;

function daysAgoYmd(n: number, from = todayYmd()) {
  return addDays(from, -n);
}

function recentWindow() {
  const to = todayYmd();
  const from = daysAgoYmd(RECENT_DAYS - 1, to);
  return { from, to };
}

/** Shared button + modal shell for recent request history. */
function RecentRequestsModal({
  open,
  onOpenChange,
  title,
  loading,
  error,
  empty,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  children: ReactNode;
}) {
  const { from, to } = recentWindow();
  return (
    <>
      <div className="ecr-recent-bar">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
          Recent requests
        </Button>
      </div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="ecr-recent-dialog sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Decisions from the last {RECENT_DAYS} days ({formatEcrDate(from)} – {formatEcrDate(to)}).
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="ecr-flash is-err">{error}</p> : null}
          {loading ? (
            <p className="ecr-recent-empty">Loading…</p>
          ) : empty ? (
            <p className="ecr-recent-empty">No requests in the last {RECENT_DAYS} days.</p>
          ) : (
            <div className="table-wrap ecr-recent-table-wrap">{children}</div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}

function RequestCardHeader({
  title,
  help,
  pendingTotal,
  onRefresh,
}: {
  title: string;
  help: string;
  pendingTotal: number;
  onRefresh: () => void;
}) {
  return (
    <div className="ecr-head">
      <div className="ecr-head-top">
        <h3 className="ecr-title">{title}</h3>
        <div className="ecr-head-actions">
          {pendingTotal > 0 && <span className="badge badge-warn">{pendingTotal} pending</span>}
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      </div>
      <p className="ecr-help">{help}</p>
    </div>
  );
}

function DecideActions({
  canDecide,
  busy,
  onApprove,
  onReject,
}: {
  canDecide: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!canDecide) return <span className="ecr-admin-only">Admin only</span>;
  return (
    <div className="row-actions ecr-actions">
      <Button size="sm" disabled={busy} onClick={onApprove}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={onReject}>
        Reject
      </Button>
    </div>
  );
}

type CtRequest = {
  _id: string;
  date: string;
  requested_hours: number;
  requested_minutes?: number;
  actual_cover_hours?: number;
  actual_cover_minutes?: number;
  reason?: string;
  status: string;
  decision_note?: string;
  employee_id?: EmpRef;
};

type OtRequest = {
  _id: string;
  date: string;
  hours: number;
  minutes?: number;
  reason?: string;
  status: string;
  decision_note?: string;
  employee_id?: EmpRef;
};

type Leave = {
  _id: string;
  from_date: string;
  to_date: string;
  day_type?: 'Full Day' | 'Half Day';
  reason?: string;
  status: string;
  employee_id?: EmpRef;
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
  const { user } = useAuth();
  const [pending, setPending] = useState<EcRequest[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [rejecting, setRejecting] = useState<EcRequest | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<EcRequest[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentErr, setRecentErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const p = await api<ListResult<EcRequest>>(
        `/attendance/early-checkout-requests?status=Pending&page=${pendingPage}&limit=${PAGE_SIZE}`
      );
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load requests');
    }
  };

  const loadRecent = async () => {
    setRecentLoading(true);
    setRecentErr('');
    try {
      const { from, to } = recentWindow();
      const r = await api<ListResult<EcRequest>>(
        `/attendance/early-checkout-requests?page=1&limit=100&status=Approved,Rejected,Cancelled&from=${from}&to=${to}`
      );
      setRecent((r.data || []).filter((x) => x.status !== 'Pending'));
    } catch (e) {
      setRecentErr(e instanceof Error ? e.message : 'Failed to load recent requests');
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  useEffect(() => {
    if (recentOpen) loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentOpen]);

  const decide = async (req: EcRequest, status: 'Approved' | 'Rejected', decisionNote = '') => {
    setBusyId(req._id);
    setErr('');
    try {
      const result = await api<EcRequest>(`/attendance/early-checkout-requests/${req._id}/decide`, {
        method: 'POST',
        body: { status, note: decisionNote },
      });
      if (status === 'Approved') {
        setMsg(
          result.already_checked_out
            ? `Approved for record — ${req.employee_id?.name || 'employee'} was already checked out${
                result.auto_checkout || isAutoClosedEcrNote(req.decision_note) ? ' (auto 11:55 PM)' : ''
              }.`
            : `Approved — ${req.employee_id?.name || 'employee'} can now check out from their dashboard.`
        );
      } else {
        setMsg('Request rejected.');
      }
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
      <RequestCardHeader
        title="Early Checkout Requests"
        help="Approve to unlock checkout. Requests stay pending if the day auto-closes at 11:55 PM."
        pendingTotal={pendingTotal}
        onRefresh={load}
      />

      {msg && <p className="ecr-flash is-ok">{msg}</p>}
      {err && <p className="ecr-flash is-err">{err}</p>}

      {pendingTotal === 0 ? (
        <p className="ecr-empty">No pending early checkout requests.</p>
      ) : (
        <>
          <div className="table-wrap ecr-table-wrap">
            <table className="data ecr-table">
              <thead>
                <tr>
                  <th className="ecr-col-emp">Employee</th>
                  <th className="ecr-col-time">Requested</th>
                  <th className="ecr-col-date">Date</th>
                  <th className="ecr-col-reason">Reason</th>
                  <th className="ecr-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r._id}>
                    <td className="ecr-col-emp">
                      <div className="ecr-emp-block">
                        <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                        {isAutoClosedEcrNote(r.decision_note) ? (
                          <span className="ecr-auto-chip" title={r.decision_note}>
                            Auto-closed · needs decision
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="ecr-col-time">{displayClock(r.requested_time)}</td>
                    <td className="ecr-col-date">{formatEcrDate(r.date)}</td>
                    <td className="ecr-col-reason">{r.reason || '—'}</td>
                    <td className="ecr-col-actions">
                      <DecideActions
                        canDecide={canDecideRequest(user, r.employee_id)}
                        busy={busyId === r._id}
                        onApprove={() => decide(r, 'Approved')}
                        onReject={() => {
                          setRejecting(r);
                          setNote('');
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination total={pendingTotal} page={pendingPage} onPageChange={setPendingPage} />
        </>
      )}

      <RecentRequestsModal
        open={recentOpen}
        onOpenChange={setRecentOpen}
        title="Recent early checkout requests"
        loading={recentLoading}
        error={recentErr}
        empty={!recent.length}
      >
        <table className="data ecr-recent-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Date</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r._id}>
                <td>
                  <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td className="ecr-col-time">{displayClock(r.requested_time)}</td>
                <td>{formatEcrDate(r.date)}</td>
                <td>
                  {r.reason || '—'}
                  {r.decision_note ? (
                    <div className="ecr-recent-note">{r.decision_note}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RecentRequestsModal>

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
  const { user } = useAuth();
  const [pending, setPending] = useState<CtRequest[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [rejecting, setRejecting] = useState<CtRequest | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<CtRequest[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentErr, setRecentErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const p = await api<ListResult<CtRequest>>(
        `/attendance/cover-time-requests?status=Pending&page=${pendingPage}&limit=${PAGE_SIZE}`
      );
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load cover time requests');
    }
  };

  const loadRecent = async () => {
    setRecentLoading(true);
    setRecentErr('');
    try {
      const { from, to } = recentWindow();
      const r = await api<ListResult<CtRequest>>(
        `/attendance/cover-time-requests?page=1&limit=100&status=Approved,Rejected,Cancelled&from=${from}&to=${to}`
      );
      setRecent((r.data || []).filter((x) => x.status !== 'Pending'));
    } catch (e) {
      setRecentErr(e instanceof Error ? e.message : 'Failed to load recent requests');
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  useEffect(() => {
    if (recentOpen) loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentOpen]);

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
      <RequestCardHeader
        title="Cover Time Requests"
        help="Make up shortfall after daily hours. Approved cover counts toward monthly hours (not OT). Min 45m."
        pendingTotal={pendingTotal}
        onRefresh={load}
      />

      {msg && <p className="ecr-flash is-ok">{msg}</p>}
      {err && <p className="ecr-flash is-err">{err}</p>}

      {pendingTotal === 0 ? (
        <p className="ecr-empty">No pending cover time requests.</p>
      ) : (
        <>
          <div className="table-wrap ecr-table-wrap">
            <table className="data ecr-table">
              <thead>
                <tr>
                  <th className="ecr-col-emp">Employee</th>
                  <th className="ecr-col-hours">Requested</th>
                  <th className="ecr-col-hours">Covered</th>
                  <th className="ecr-col-date">Date</th>
                  <th className="ecr-col-reason">Reason</th>
                  <th className="ecr-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r._id}>
                    <td className="ecr-col-emp">
                      <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                    </td>
                    <td className="ecr-col-hours">{formatHours(r.requested_hours)}</td>
                    <td className="ecr-col-hours">{formatHours(r.actual_cover_hours || 0)}</td>
                    <td className="ecr-col-date">{formatEcrDate(r.date)}</td>
                    <td className="ecr-col-reason">{r.reason || '—'}</td>
                    <td className="ecr-col-actions">
                      <DecideActions
                        canDecide={canDecideRequest(user, r.employee_id)}
                        busy={busyId === r._id}
                        onApprove={() => decide(r, 'Approved')}
                        onReject={() => {
                          setRejecting(r);
                          setNote('');
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination total={pendingTotal} page={pendingPage} onPageChange={setPendingPage} />
        </>
      )}

      <RecentRequestsModal
        open={recentOpen}
        onOpenChange={setRecentOpen}
        title="Recent cover time requests"
        loading={recentLoading}
        error={recentErr}
        empty={!recent.length}
      >
        <table className="data ecr-recent-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Covered</th>
              <th>Date</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r._id}>
                <td>
                  <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{formatHours(r.requested_hours)}</td>
                <td>{formatHours(r.actual_cover_hours || 0)}</td>
                <td>{formatEcrDate(r.date)}</td>
                <td>
                  {r.reason || '—'}
                  {r.decision_note ? (
                    <div className="ecr-recent-note">{r.decision_note}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RecentRequestsModal>

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
  const { user } = useAuth();
  const [pending, setPending] = useState<OtRequest[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [rejecting, setRejecting] = useState<OtRequest | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<OtRequest[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentErr, setRecentErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const p = await api<ListResult<OtRequest>>(
        `/overtime?status=Pending&source=requests&page=${pendingPage}&limit=${PAGE_SIZE}`
      );
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load overtime requests');
    }
  };

  const loadRecent = async () => {
    setRecentLoading(true);
    setRecentErr('');
    try {
      const { from, to } = recentWindow();
      const r = await api<ListResult<OtRequest>>(
        `/overtime?status=Approved,Rejected&source=requests&page=1&limit=100&from_date=${from}&to_date=${to}`
      );
      setRecent((r.data || []).filter((x) => x.status !== 'Pending'));
    } catch (e) {
      setRecentErr(e instanceof Error ? e.message : 'Failed to load recent requests');
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  useEffect(() => {
    if (recentOpen) loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentOpen]);

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
      <RequestCardHeader
        title="Management Overtime Requests"
        help="Company-paid OT after daily target. General OT is automatic at checkout and does not appear here."
        pendingTotal={pendingTotal}
        onRefresh={load}
      />

      {msg && <p className="ecr-flash is-ok">{msg}</p>}
      {err && <p className="ecr-flash is-err">{err}</p>}

      {pendingTotal === 0 ? (
        <p className="ecr-empty">No pending management overtime requests.</p>
      ) : (
        <>
          <div className="table-wrap ecr-table-wrap">
            <table className="data ecr-table">
              <thead>
                <tr>
                  <th className="ecr-col-emp">Employee</th>
                  <th className="ecr-col-date">Date</th>
                  <th className="ecr-col-hours">Hours</th>
                  <th className="ecr-col-reason">Reason</th>
                  <th className="ecr-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r._id}>
                    <td className="ecr-col-emp">
                      <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                    </td>
                    <td className="ecr-col-date">{formatEcrDate(r.date)}</td>
                    <td className="ecr-col-hours">
                      <strong>{formatHours(r.minutes != null ? r.minutes / 60 : r.hours)}</strong>
                    </td>
                    <td className="ecr-col-reason">{r.reason || '—'}</td>
                    <td className="ecr-col-actions">
                      <DecideActions
                        canDecide={canDecideRequest(user, r.employee_id)}
                        busy={busyId === r._id}
                        onApprove={() => decide(r, 'Approved')}
                        onReject={() => {
                          setRejecting(r);
                          setNote('');
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination total={pendingTotal} page={pendingPage} onPageChange={setPendingPage} />
        </>
      )}

      <RecentRequestsModal
        open={recentOpen}
        onOpenChange={setRecentOpen}
        title="Recent overtime requests"
        loading={recentLoading}
        error={recentErr}
        empty={!recent.length}
      >
        <table className="data ecr-recent-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Date</th>
              <th>Hours</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r._id}>
                <td>
                  <EmpCell name={r.employee_id?.name} dept={r.employee_id?.department_id?.name} />
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{formatEcrDate(r.date)}</td>
                <td>{formatHours(r.hours)}</td>
                <td>
                  {r.reason || '—'}
                  {r.decision_note ? (
                    <div className="ecr-recent-note">{r.decision_note}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RecentRequestsModal>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject management OT</DialogTitle>
          </DialogHeader>
          {rejecting && (
            <>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {rejecting.employee_id?.name || 'Employee'} · {formatHours(rejecting.hours)} ·{' '}
                {formatEcrDate(rejecting.date)}
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
  const { user } = useAuth();
  const today = useMemo(() => todayYmd(), []);
  const [pending, setPending] = useState<Leave[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [rejecting, setRejecting] = useState<Leave | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<Leave[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentErr, setRecentErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const p = await api<ListResult<Leave>>(`/leaves?status=Pending&page=${pendingPage}&limit=${PAGE_SIZE}`);
      setPending(p.data || []);
      setPendingTotal(p.total || 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load leave requests');
    }
  };

  const loadRecent = async () => {
    setRecentLoading(true);
    setRecentErr('');
    try {
      const { from, to } = recentWindow();
      const r = await api<ListResult<Leave>>(
        `/leaves?status=Approved,Rejected&page=1&limit=100&decided_from=${from}&decided_to=${to}`
      );
      setRecent((r.data || []).filter((x) => x.status !== 'Pending'));
    } catch (e) {
      setRecentErr(e instanceof Error ? e.message : 'Failed to load recent requests');
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage]);

  useEffect(() => {
    if (recentOpen) loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentOpen]);

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
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card ecr-card" style={{ marginBottom: 16 }}>
      <RequestCardHeader
        title="Leave Requests"
        help="Full-day and half-day leave applications awaiting HR/Admin decision."
        pendingTotal={pendingTotal}
        onRefresh={load}
      />

      {msg && <p className="ecr-flash is-ok">{msg}</p>}
      {err && <p className="ecr-flash is-err">{err}</p>}

      {pendingTotal === 0 ? (
        <p className="ecr-empty">No pending leave requests.</p>
      ) : (
        <>
          <div className="table-wrap ecr-table-wrap">
            <table className="data ecr-table">
              <thead>
                <tr>
                  <th className="ecr-col-emp">Employee</th>
                  <th className="ecr-col-from">From</th>
                  <th className="ecr-col-to">To</th>
                  <th className="ecr-col-day">Day type</th>
                  <th className="ecr-col-reason">Reason</th>
                  <th className="ecr-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((l) => (
                  <tr key={l._id}>
                    <td className="ecr-col-emp">
                      <EmpCell name={l.employee_id?.name} dept={l.employee_id?.department_id?.name} />
                    </td>
                    <td className="ecr-col-from">
                      <div className="ecr-date-with-chip">
                        <span>{formatEcrDate(l.from_date)}</span>
                        {leaveUrgencyChip(l, today)}
                      </div>
                    </td>
                    <td className="ecr-col-to">{formatEcrDate(l.to_date)}</td>
                    <td className="ecr-col-day">
                      <span className={`hol-chip ${l.day_type === 'Half Day' ? 'is-saturday' : 'is-neutral'}`}>
                        {l.day_type || 'Full Day'}
                      </span>
                    </td>
                    <td className="ecr-col-reason">{l.reason || '—'}</td>
                    <td className="ecr-col-actions">
                      <DecideActions
                        canDecide={canDecideRequest(user, l.employee_id)}
                        busy={busyId === l._id}
                        onApprove={() => decide(l, 'Approved')}
                        onReject={() => setRejecting(l)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination total={pendingTotal} page={pendingPage} onPageChange={setPendingPage} />
        </>
      )}

      <RecentRequestsModal
        open={recentOpen}
        onOpenChange={setRecentOpen}
        title="Recent leave requests"
        loading={recentLoading}
        error={recentErr}
        empty={!recent.length}
      >
        <table className="data ecr-recent-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>From</th>
              <th>To</th>
              <th>Day type</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((l) => (
              <tr key={l._id}>
                <td>
                  <EmpCell name={l.employee_id?.name} dept={l.employee_id?.department_id?.name} />
                </td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td>{formatEcrDate(l.from_date)}</td>
                <td>{formatEcrDate(l.to_date)}</td>
                <td>
                  <span className={`hol-chip ${l.day_type === 'Half Day' ? 'is-saturday' : 'is-neutral'}`}>
                    {l.day_type || 'Full Day'}
                  </span>
                </td>
                <td>{l.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </RecentRequestsModal>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
          </DialogHeader>
          {rejecting && (
            <>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {rejecting.employee_id?.name || 'Employee'} · {formatEcrDate(rejecting.from_date)} –{' '}
                {formatEcrDate(rejecting.to_date)}
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
