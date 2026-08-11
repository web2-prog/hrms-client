import { useEffect, useMemo, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Leave = {
  _id: string;
  from_date: string;
  to_date: string;
  day_type?: 'Full Day' | 'Half Day';
  reason?: string;
  status: string;
  applied_on?: string;
  employee_id?: { name: string; department_id?: { name: string } };
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function leaveTiming(from: string, to: string, today: string) {
  if (from > today) return 'future';
  if (to >= today) return 'ongoing';
  return 'past';
}

export function LeavesPage() {
  const list = useListParams();
  const { user } = useAuth();
  const [data, setData] = useState<Leave[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [upcoming, setUpcoming] = useState<Leave[]>([]);

  const year = list.get('year');
  const month = list.get('month');
  const when = list.get('when') || '';
  const today = useMemo(() => todayYmd(), []);
  const isStaff = user?.role === 'admin' || user?.role === 'hr';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        status: list.get('status'),
        day_type: list.get('day_type'),
        month: month || undefined,
        year: year || undefined,
        when: when || undefined,
        department_id: list.get('department_id'),
        employee_id: list.get('employee_id'),
      });
      const res = await api<ListResult<Leave>>(`/leaves${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadUpcoming = async () => {
    try {
      // Always include Pending + Approved upcoming leaves (ignore status filter on main table)
      const q = buildQuery({
        page: 1,
        limit: 5,
        when: 'upcoming',
      });
      const res = await api<ListResult<Leave>>(`/leaves${q}`);
      setUpcoming((res.data || []).filter((l) => l.status !== 'Rejected'));
    } catch {
      setUpcoming([]);
    }
  };

  useEffect(() => {
    load();
    loadUpcoming();
  }, [list.page, list.limit, list.search, list.params, user?._id]);

  const afterApply = () => {
    // Clear Approved/Rejected filter so the new Pending leave is visible
    const next = new URLSearchParams(list.params);
    next.delete('status');
    next.set('when', 'upcoming');
    next.set('page', '1');
    list.setParams(next);
    setShowApply(false);
  };

  return (
    <>
      {when !== 'past' && upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Upcoming & current leaves</h3>
            <Button type="button" variant="ghost" onClick={() => list.setFilter('when', 'upcoming')}>
              View all upcoming
            </Button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {isStaff && <th>Employee</th>}
                  <th>From</th>
                  <th>To</th>
                  <th>Day Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((l) => {
                  const timing = leaveTiming(l.from_date, l.to_date, today);
                  return (
                    <tr key={`up-${l._id}`}>
                      {isStaff && <td>{l.employee_id?.name || '—'}</td>}
                      <td>
                        {l.from_date}{' '}
                        {timing === 'future' && <span className="badge badge-info">Upcoming</span>}
                        {timing === 'ongoing' && <span className="badge badge-warn">Ongoing</span>}
                      </td>
                      <td>{l.to_date}</td>
                      <td>{l.day_type || 'Full Day'}</td>
                      <td>{l.reason || '—'}</td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ListingPage
        title="Leaves"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={() => {
          load();
          loadUpcoming();
        }}
        filters={
          <>
            <select className="select" style={{ width: 140 }} value={list.get('day_type')} onChange={(e) => list.setFilter('day_type', e.target.value)}>
              <option value="">Show all leave</option>
              <option value="Full Day">Full Day</option>
              <option value="Half Day">Half Day</option>
            </select>
            <select className="select" style={{ width: 130 }} value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
              <option value="">Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select className="select" style={{ width: 150 }} value={when} onChange={(e) => list.setFilter('when', e.target.value)}>
              <option value="">All dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="future">Future only</option>
              <option value="past">Past</option>
            </select>
            <select className="select" style={{ width: 110 }} value={month} onChange={(e) => list.setFilter('month', e.target.value)}>
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {MONTH_NAMES[m - 1]}
                </option>
              ))}
            </select>
            <select className="select" style={{ width: 100 }} value={year} onChange={(e) => list.setFilter('year', e.target.value)}>
              <option value="">All years</option>
              {[2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        }
        actions={
          <Button onClick={() => setShowApply(true)}>
            Apply Leave
          </Button>
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Employee</th>
                <th>From</th>
                <th>To</th>
                <th>Day Type</th>
                <th>Reason</th>
                <th>Status</th>
                {isStaff && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.map((l) => {
                const timing = leaveTiming(l.from_date, l.to_date, today);
                return (
                  <tr key={l._id}>
                    <td>{l.employee_id?.name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{l.from_date}</span>
                        {timing === 'future' && <span className="badge badge-info">Upcoming</span>}
                        {timing === 'ongoing' && <span className="badge badge-warn">Ongoing</span>}
                      </div>
                    </td>
                    <td>{l.to_date}</td>
                    <td>{l.day_type || 'Full Day'}</td>
                    <td>{l.reason}</td>
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                    {isStaff && l.status === 'Pending' && (
                      <td className="row-actions">
                        <Button
                          onClick={async () => {
                            await api(`/leaves/${l._id}/decide`, { method: 'PATCH', body: { status: 'Approved' } });
                            load();
                            loadUpcoming();
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            await api(`/leaves/${l._id}/decide`, { method: 'PATCH', body: { status: 'Rejected' } });
                            load();
                            loadUpcoming();
                          }}
                        >
                          Reject
                        </Button>
                      </td>
                    )}
                    {isStaff && l.status !== 'Pending' && <td />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ListingPage>
      {showApply && (
        <ApplyLeaveModal
          onClose={() => setShowApply(false)}
          onSaved={() => {
            afterApply();
          }}
        />
      )}
    </>
  );
}

function ApplyLeaveModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [from_date, setFrom] = useState('');
  const [to_date, setTo] = useState('');
  const [day_type, setDayType] = useState<'Full Day' | 'Half Day'>('Full Day');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
        </DialogHeader>
        <div className="form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Day Type</label>
            <select
              className="select"
              value={day_type}
              onChange={(e) => {
                const next = e.target.value as 'Full Day' | 'Half Day';
                setDayType(next);
                if (next === 'Half Day' && from_date) setTo(from_date);
              }}
            >
              <option value="Full Day">Full Day</option>
              <option value="Half Day">Half Day</option>
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input
              className="input"
              type="date"
              value={from_date}
              onChange={(e) => {
                setFrom(e.target.value);
                if (day_type === 'Half Day') setTo(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input" type="date" value={to_date} disabled={day_type === 'Half Day'} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Reason</label>
            <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
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
                if (!from_date) {
                  setErr('Please select From date');
                  return;
                }
                const to = day_type === 'Half Day' ? from_date : to_date;
                if (!to) {
                  setErr('Please select To date');
                  return;
                }
                await api('/leaves', { method: 'POST', body: { from_date, to_date: to, day_type, reason } });
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
