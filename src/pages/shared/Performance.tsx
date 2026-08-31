import { useEffect, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, formatHours } from '../../components/StatusBadge';
import type { SalaryCompanyKey } from '../../services/salarySlipDefaults';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PerformanceRow = {
  employee_id?: {
    _id: string;
    name: string;
    employee_id?: string;
    email?: string;
    department_id?: { name: string };
  };
  month: number;
  year: number;
  working_hours: number;
  monthly_hours: number;
  monthly_target_hours: number;
  base_monthly_target_hours: number;
  carried_forward_hours: number;
  carried_to_next_hours: number;
  pending_hours: number;
  shortfall_action: 'deduct' | 'carry_forward' | null;
  needs_shortfall_decision: boolean;
  shortfall_management_active?: boolean;
  extra_working_hours: number;
  general_ot_hours: number;
  attendance_ot_hours: number;
  management_ot_hours: number;
  low_working_hours: number;
  monthly_shortfall_or_surplus: number;
  working_days_in_month: number;
  approved_leave_days_in_month: number;
  daily_target_hours: number;
  status: string;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PerformancePage() {
  const list = useListParams();
  const [data, setData] = useState<PerformanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depts, setDepts] = useState<{ _id: string; name: string }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decideRow, setDecideRow] = useState<PerformanceRow | null>(null);

  const year = list.get('year') || String(new Date().getFullYear());
  const month = list.get('month') || String(new Date().getMonth() + 1);
  const shortfallMgmtActive = Number(year) > 2026 || (Number(year) === 2026 && Number(month) >= 8);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        department_id: list.get('department_id'),
        month,
        year,
      });
      const res = await api<ListResult<PerformanceRow>>(`/performance${q}`);
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

  useEffect(() => {
    api<ListResult<{ _id: string; name: string }>>('/departments?limit=50')
      .then((r) => setDepts(r.data))
      .catch(() => {});
  }, []);

  const applyDecision = async (
    row: PerformanceRow,
    action: 'deduct' | 'carry_forward',
    companyKey: SalaryCompanyKey = 'kriraai'
  ) => {
    if (!row.employee_id?._id) return;
    setBusyId(row.employee_id._id);
    try {
      await api('/performance/shortfall-decision', {
        method: 'POST',
        body: {
          employee_id: row.employee_id._id,
          month: row.month,
          year: row.year,
          action,
          company_key: companyKey,
        },
      });
      setDecideRow(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ListingPage
        title="Performance"
        searchPlaceholder="Search employee…"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        subtitle={
          shortfallMgmtActive
            ? 'Month-end Salary Deduction / Carry Forward for shortfall hours.'
            : 'Salary Deduction / Carry Forward starts from August 2026. Earlier months show hours only.'
        }
        filters={
          <>
            <select
              className="select select-month"
              value={month}
              onChange={(e) => list.setFilter('month', e.target.value)}
            >
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
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Month</th>
                <th>Working Hours</th>
                <th>Monthly Hours</th>
                <th>Target</th>
                <th>Carry In</th>
                <th>General OT</th>
                <th>Management OT</th>
                <th>Pending Hours</th>
                <th>Decision</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.employee_id?._id}>
                  <td>
                    <div>{row.employee_id?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{row.employee_id?.employee_id}</div>
                  </td>
                  <td>{row.employee_id?.department_id?.name || '—'}</td>
                  <td>
                    {MONTH_NAMES[row.month - 1]} {row.year}
                  </td>
                  <td>{formatHours(row.working_hours)}</td>
                  <td>{formatHours(row.monthly_hours)}</td>
                  <td>
                    <div>{formatHours(row.monthly_target_hours)}</div>
                    {row.carried_forward_hours > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        base {formatHours(row.base_monthly_target_hours)} + carry {formatHours(row.carried_forward_hours)}
                      </div>
                    )}
                  </td>
                  <td>
                    {row.carried_forward_hours > 0 ? (
                      <span className="badge badge-warn">+{formatHours(row.carried_forward_hours)}</span>
                    ) : (
                      formatHours(0)
                    )}
                  </td>
                  <td>
                    {(row.general_ot_hours ?? row.extra_working_hours) > 0 ? (
                      <span className="badge badge-success">+{formatHours(row.general_ot_hours ?? row.extra_working_hours)}</span>
                    ) : (
                      formatHours(0)
                    )}
                  </td>
                  <td>
                    {row.management_ot_hours > 0 ? (
                      <span className="badge badge-info">+{formatHours(row.management_ot_hours)}</span>
                    ) : (
                      formatHours(0)
                    )}
                  </td>
                  <td>
                    {row.pending_hours > 0 ? (
                      <span className="badge badge-error">−{formatHours(row.pending_hours)}</span>
                    ) : (
                      formatHours(0)
                    )}
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                    {row.shortfall_action === 'carry_forward' && row.carried_to_next_hours > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                        → next month +{formatHours(row.carried_to_next_hours)}
                      </div>
                    )}
                  </td>
                  <td className="row-actions">
                    {row.needs_shortfall_decision && (
                      <Button
                        disabled={busyId === row.employee_id?._id}
                        onClick={() => setDecideRow(row)}
                      >
                        Month-end
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>

      {decideRow && (
        <ShortfallModal
          row={decideRow}
          busy={busyId === decideRow.employee_id?._id}
          onClose={() => setDecideRow(null)}
          onDecide={(action, companyKey) => applyDecision(decideRow, action, companyKey)}
        />
      )}
    </>
  );
}

function ShortfallModal({
  row,
  busy,
  onClose,
  onDecide,
}: {
  row: PerformanceRow;
  busy: boolean;
  onClose: () => void;
  onDecide: (action: 'deduct' | 'carry_forward', companyKey: SalaryCompanyKey) => void;
}) {
  const [companyKey, setCompanyKey] = useState<SalaryCompanyKey>('kriraai');
  const nextMonth = row.month === 12 ? 1 : row.month + 1;
  const nextYear = row.month === 12 ? row.year + 1 : row.year;
  const nextTargetApprox = (row.base_monthly_target_hours || row.monthly_target_hours) + row.pending_hours;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Month-end shortfall</DialogTitle>
        </DialogHeader>
        <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
          {row.employee_id?.name} · {MONTH_NAMES[row.month - 1]} {row.year}
        </p>
        <div style={{ marginBottom: 16, lineHeight: 1.6 }}>
          <div>
            Covered: <strong>{formatHours(row.monthly_hours)}</strong> / Target:{' '}
            <strong>{formatHours(row.monthly_target_hours)}</strong>
          </div>
          <div>
            Pending hours: <strong style={{ color: 'var(--error)' }}>{formatHours(row.pending_hours)}</strong>
          </div>
          {row.carried_forward_hours > 0 && (
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              Includes {formatHours(row.carried_forward_hours)} carried in from previous month
            </div>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          Salary format company
          <select
            className="select"
            style={{ width: 140 }}
            value={companyKey}
            disabled={busy}
            onChange={(e) => setCompanyKey(e.target.value as SalaryCompanyKey)}
          >
            <option value="kriraai">KriraAI</option>
            <option value="ondial">Ondial</option>
          </select>
        </label>

        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: 12 }}>
            <strong>Salary Deduction</strong>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: '6px 0 0' }}>
              Create / update salary slip with deduction for {formatHours(row.pending_hours)} shortfall. No hours
              move to next month.
            </p>
            <Button
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => onDecide('deduct', companyKey)}
            >
              Apply salary deduction
            </Button>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <strong>Carry Forward</strong>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: '6px 0 0' }}>
              Move {formatHours(row.pending_hours)} to {MONTH_NAMES[nextMonth - 1]} {nextYear}. Employee must cover
              that month’s target plus this pending (approx. {formatHours(nextTargetApprox)} if base stays similar).
              No salary cut for these hours.
            </p>
            <Button
              variant="outline"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => onDecide('carry_forward', companyKey)}
            >
              Carry forward to next month
            </Button>
          </div>
        </div>

        {row.shortfall_action && (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 12 }}>
            Current decision: <StatusBadge status={row.status} /> — choosing again will overwrite it.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
