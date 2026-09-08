import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Timer, XCircle } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, formatHours } from '../../components/StatusBadge';
import { EmpCell } from '../../components/EmpCell';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type OtRequest = {
  _id: string;
  source?: 'request' | 'attendance';
  date: string;
  hours: number;
  reason?: string;
  status: string;
  ot_type?: 'General' | 'Management' | 'Attendance' | null;
  working_hours?: number;
  applied_on?: string;
  decision_note?: string;
  decided_by?: { name: string };
  employee_id?: { name: string; department_id?: { name: string } };
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function otTypeChip(row: OtRequest) {
  if (row.ot_type === 'General' || row.source === 'attendance') {
    return <span className="hol-chip is-vacation">General OT</span>;
  }
  if (row.ot_type === 'Management') return <span className="hol-chip is-festival">Management OT</span>;
  return '—';
}

export function OvertimePage() {
  const list = useListParams();
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'hr';
  const isEmployee = user?.role === 'employee';
  const [data, setData] = useState<OtRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);

  const [summary, setSummary] = useState<{ total: number; pending: number; approved: number; rejected: number } | null>(null);

  const year = list.get('year') || String(new Date().getFullYear());
  const month = list.get('month') || String(new Date().getMonth() + 1);
  const source = list.get('source') || 'all';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        status: list.get('status'),
        ot_type: list.get('ot_type'),
        source,
        month,
        year,
      });
      const res = await api<ListResult<OtRequest>>(`/overtime${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const base = {
        limit: 1,
        month,
        year,
        source,
        search: list.search || undefined,
        ot_type: list.get('ot_type') || undefined,
      };
      const res = await Promise.all([
        api<ListResult<OtRequest>>(`/overtime${buildQuery(base)}`),
        api<ListResult<OtRequest>>(`/overtime${buildQuery({ ...base, status: 'Pending' })}`),
        api<ListResult<OtRequest>>(`/overtime${buildQuery({ ...base, status: 'Approved' })}`),
        api<ListResult<OtRequest>>(`/overtime${buildQuery({ ...base, status: 'Rejected' })}`),
      ]).catch(() => null);
      if (!res) return setSummary(null);
      const [totalRes, pending, approved, rejected] = res;
      setSummary({
        total: totalRes.total ?? 0,
        pending: pending?.total ?? 0,
        approved: approved?.total ?? 0,
        rejected: rejected?.total ?? 0,
      });
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);
  useEffect(() => { loadSummary(); }, [month, year, source, list.params]);

  const periodLabel = `${MONTH_NAMES[Number(month) - 1]} ${year}`;

  return (
    <>
      <ListingPage
        title="Overtime"
        subtitle={
          isManager
            ? 'OT records and history — approve pending management OT in Requests'
            : 'General OT from checkout extras · Management OT from employee requests'
        }
        searchPlaceholder="Search employee…"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={() => { load(); loadSummary(); }}
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
          <>
            <select className="select" value={source} onChange={(e) => list.setFilter('source', e.target.value === 'all' ? '' : e.target.value)}>
              <option value="all">All OT</option>
              <option value="attendance">General OT (auto)</option>
              <option value="requests">Management requests</option>
            </select>
            <select className="select" value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
              <option value="">Status</option>
              <option value="Extra">Extra (auto General)</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            {isManager && (
              <select className="select" value={list.get('ot_type')} onChange={(e) => list.setFilter('ot_type', e.target.value)}>
                <option value="">OT Type</option>
                <option value="General">General OT</option>
                <option value="Management">Management OT</option>
              </select>
            )}
          </>
        }
        actions={
          isEmployee ? (
            <Button onClick={() => setShowApply(true)}>Request Management OT</Button>
          ) : null
        }
        prepend={
          summary && (
            <div className="page-stats">
              <div className="card emp-stat card-accent">
                <div className="stat-card">
                  <span className="stat-icon blue"><Timer size={20} /></span>
                  <div>
                    <span className="label">OT records</span>
                    <div className="emp-stat-value">{summary.total}</div>
                    <span className="emp-stat-hint">{periodLabel}</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent amber">
                <div className="stat-card">
                  <span className="stat-icon amber"><Clock3 size={20} /></span>
                  <div>
                    <span className="label">Pending</span>
                    <div className="emp-stat-value">{summary.pending}</div>
                    <span className="emp-stat-hint">Management OT awaiting decision</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent teal">
                <div className="stat-card">
                  <span className="stat-icon teal"><CheckCircle2 size={20} /></span>
                  <div>
                    <span className="label">Approved</span>
                    <div className="emp-stat-value">{summary.approved}</div>
                    <span className="emp-stat-hint">Management OT approved</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent coral">
                <div className="stat-card">
                  <span className="stat-icon coral"><XCircle size={20} /></span>
                  <div>
                    <span className="label">Rejected</span>
                    <div className="emp-stat-value">{summary.rejected}</div>
                    <span className="emp-stat-hint">Not counted</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      >
        <p className="listing-note">
          General OT is automatic when checkout hours exceed the daily target (status Extra, no request).
          Management OT is requested by employees after daily target and approved by HR/Admin.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {isManager && <th>Employee</th>}
                <th>Date</th>
                <th>Hours</th>
                <th>Reason</th>
                <th>Status</th>
                <th>OT Type</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row._id}>
                  {isManager && (
                    <td>
                      <EmpCell name={row.employee_id?.name} dept={row.employee_id?.department_id?.name} />
                    </td>
                  )}
                  <td>{row.date}</td>
                  <td className="num-cell"><strong>{formatHours(row.hours)}</strong></td>
                  <td style={{ maxWidth: 280 }}>{row.reason || '—'}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{otTypeChip(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>

      {showApply && (
        <ApplyOtModal
          onClose={() => setShowApply(false)}
          onSaved={() => {
            setShowApply(false);
            load();
            loadSummary();
          }}
        />
      )}
    </>
  );
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ApplyOtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(todayYmd());
  const [hours, setHours] = useState<number | null>(null);
  const [coverHours, setCoverHours] = useState(0);
  const [dailySurplus, setDailySurplus] = useState(0);
  const [shortfall, setShortfall] = useState(0);
  const [hoursHint, setHoursHint] = useState('Loading hours from attendance…');
  const [eligible, setEligible] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadHours = async () => {
      if (!date) {
        setHours(null);
        setEligible(false);
        setHoursHint('Select a date');
        return;
      }
      setHoursHint('Calculating surplus split…');
      try {
        const res = await api<{
          hours: number;
          eligible: boolean;
          message?: string | null;
          work_hours?: number;
          full_hours?: number | null;
          daily_surplus?: number;
          cover_hours?: number;
          management_ot_hours?: number;
          monthly_shortfall?: number;
        }>(`/overtime/eligible-hours?date=${encodeURIComponent(date)}`);
        if (cancelled) return;
        setHours(Number(res.management_ot_hours ?? res.hours) || 0);
        setCoverHours(Number(res.cover_hours) || 0);
        setDailySurplus(Number(res.daily_surplus) || 0);
        setShortfall(Number(res.monthly_shortfall) || 0);
        setEligible(!!res.eligible);
        setHoursHint(
          res.eligible
            ? `Surplus ${formatHours(res.daily_surplus)} → Cover ${formatHours(res.cover_hours)} + Mgmt OT ${formatHours(res.management_ot_hours)} (worked ${formatHours(res.work_hours)} / target ${formatHours(res.full_hours ?? 0)})`
            : res.message || 'No Management OT surplus for this date'
        );
      } catch (e) {
        if (cancelled) return;
        setHours(null);
        setEligible(false);
        setHoursHint(e instanceof Error ? e.message : 'Could not load hours');
      }
    };
    loadHours();
    const id = window.setInterval(loadHours, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [date]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Management OT</DialogTitle>
        </DialogHeader>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 12 }}>
          Cover Time takes surplus first (up to monthly shortfall). Only the leftover is Management OT — same minutes
          are never double-counted. Hours are calculated on the server.
        </p>
        <div className="form-grid">
          <div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={date}
              max={todayYmd()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Management OT hours (auto)</label>
            <input
              className="input"
              type="text"
              readOnly
              value={hours == null ? '—' : formatHours(hours)}
              aria-readonly="true"
            />
            <span className="emp-stat-hint">{hoursHint}</span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="emp-stat-hint">
              Split: surplus {formatHours(dailySurplus)} · cover {formatHours(coverHours)} · shortfall{' '}
              {formatHours(shortfall)}
            </span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Reason</label>
            <textarea
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is management overtime needed?"
            />
          </div>
        </div>
        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !eligible}
            onClick={async () => {
              try {
                if (!date) return setErr('Date required');
                if (!eligible || !(hours && hours > 0)) {
                  return setErr('No Management OT hours available for this date yet');
                }
                if (!reason.trim()) return setErr('Reason required');
                setBusy(true);
                setErr('');
                await api('/overtime', {
                  method: 'POST',
                  body: { date, reason, ot_type: 'Management' },
                });
                onSaved();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Sending…' : 'Submit Management OT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
