import { useEffect, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, formatHours } from '../../components/StatusBadge';
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

export function OvertimePage() {
  const list = useListParams();
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'hr';
  const [data, setData] = useState<OtRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [decideRow, setDecideRow] = useState<OtRequest | null>(null);

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

  useEffect(() => {
    load();
  }, [list.page, list.limit, list.search, list.params]);

  return (
    <>
      <ListingPage
        title="Overtime"
        searchPlaceholder="Search employee…"
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
          <>
            <select className="select" value={source} onChange={(e) => list.setFilter('source', e.target.value === 'all' ? '' : e.target.value)}>
              <option value="all">All OT</option>
              <option value="attendance">Attendance Extra</option>
              <option value="requests">OT Requests</option>
            </select>
            <select className="select" value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
              <option value="">Status</option>
              <option value="Extra">Extra (attendance)</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            {isManager && (
              <select className="select" value={list.get('ot_type')} onChange={(e) => list.setFilter('ot_type', e.target.value)}>
                <option value="">OT Type</option>
                <option value="Attendance">Attendance OT</option>
                <option value="General">General OT</option>
                <option value="Management">Management OT</option>
              </select>
            )}
          </>
        }
        actions={
          <Button onClick={() => setShowApply(true)}>
            Request Overtime
          </Button>
        }
      >
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
          Attendance Extra = hours worked beyond shift (auto from attendance). OT Requests = submitted General / Management OT.
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
                {isManager && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row._id}>
                  {isManager && <td>{row.employee_id?.name || '—'}</td>}
                  <td>{row.date}</td>
                  <td>{formatHours(row.hours)}</td>
                  <td style={{ maxWidth: 280 }}>{row.reason}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>
                    {row.ot_type === 'General' ? (
                      <span className="badge badge-success">General OT</span>
                    ) : row.ot_type === 'Management' ? (
                      <span className="badge badge-info">Management OT</span>
                    ) : row.ot_type === 'Attendance' || row.source === 'attendance' ? (
                      <span className="badge badge-success">Attendance OT</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  {isManager && row.source !== 'attendance' && row.status === 'Pending' && (
                    <td className="row-actions">
                      <Button onClick={() => setDecideRow(row)}>
                        Decide
                      </Button>
                    </td>
                  )}
                  {isManager && (row.source === 'attendance' || row.status !== 'Pending') && <td />}
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
          }}
        />
      )}
      {decideRow && (
        <DecideOtModal
          row={decideRow}
          onClose={() => setDecideRow(null)}
          onSaved={() => {
            setDecideRow(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ApplyOtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request overtime</DialogTitle>
        </DialogHeader>
        <div className="form-grid">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Hours</label>
            <input
              className="input"
              type="number"
              min="0.25"
              step="0.25"
              placeholder="e.g. 1.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Reason</label>
            <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is overtime needed?" />
          </div>
        </div>
        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              try {
                if (!date) return setErr('Date required');
                if (!hours || Number(hours) <= 0) return setErr('Hours required');
                if (!reason.trim()) return setErr('Reason required');
                await api('/overtime', { method: 'POST', body: { date, hours: Number(hours), reason } });
                onSaved();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              }
            }}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecideOtModal({
  row,
  onClose,
  onSaved,
}: {
  row: OtRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [otType, setOtType] = useState<'General' | 'Management'>('General');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (status: 'Approved' | 'Rejected') => {
    setBusy(true);
    setErr('');
    try {
      await api(`/overtime/${row._id}/decide`, {
        method: 'PATCH',
        body: {
          status,
          ot_type: status === 'Approved' ? otType : undefined,
          decision_note: note,
        },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decide overtime request</DialogTitle>
        </DialogHeader>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
          {row.employee_id?.name || 'Employee'} · {row.date} · {formatHours(row.hours)}
        </p>
        <p style={{ marginBottom: 12 }}>{row.reason}</p>
        <div className="form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Credit OT to</label>
            <select className="select" value={otType} onChange={(e) => setOtType(e.target.value as 'General' | 'Management')}>
              <option value="General">General OT</option>
              <option value="Management">Management OT</option>
            </select>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 6 }}>
              General OT adds to regular overtime. Management OT is tracked on Performance.
            </p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Note (optional)</label>
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => submit('Rejected')}>
            Reject
          </Button>
          <Button disabled={busy} onClick={() => submit('Approved')}>
            Approve as {otType} OT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
