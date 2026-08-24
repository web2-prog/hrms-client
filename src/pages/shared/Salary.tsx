import { useEffect, useRef, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, formatHours } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { SalarySlipPreview } from '../../components/SalarySlipPreview';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  apiPayslipToForm,
  applyCompanyToForm,
  formToAdjustPayload,
  getSalaryPdfFilename,
  resolveCompanyKeyFromForm,
  SALARY_COMPANIES,
  type SalaryCompanyKey,
  type SalarySlipFormData,
} from '../../services/salarySlipDefaults';
import { downloadSalarySlipPdf } from '../../services/salarySlipPdf';

type Slip = {
  _id: string;
  month: number;
  year: number;
  base_salary: number;
  monthly_target_hours: number;
  monthly_counted_hours: number;
  overtime_hours: number;
  shortfall_hours: number;
  deduction_amount: number;
  leave_days?: number;
  lop_days?: number;
  early_checkout_minutes?: number;
  leave_deduction_amount?: number;
  early_checkout_deduction_amount?: number;
  overtime_amount: number;
  bond_security_deduction?: number;
  bond_security_percent?: number;
  net_pay: number;
  status: string;
  payment_status: string;
  company_key?: SalaryCompanyKey;
  company_name?: string;
  paid_date?: string;
  payment_reference?: string;
  sent_on?: string;
  employee_id?: { _id: string; name: string; department_id?: { name: string } };
  payslip?: Record<string, unknown>;
  adjustment_note?: string;
};

export function SalaryPage({ allowBulk }: { allowBulk?: boolean }) {
  const list = useListParams();
  const { user } = useAuth();
  const [data, setData] = useState<Slip[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emps, setEmps] = useState<{ _id: string; name: string }[]>([]);
  const [gen, setGen] = useState({
    employee_id: '',
    month: String(new Date().getMonth() + 1),
    year: '2026',
    company_key: 'kriraai' as SalaryCompanyKey,
  });
  const [previewForm, setPreviewForm] = useState<SalarySlipFormData | null>(null);
  const [previewSlipId, setPreviewSlipId] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        employee_id: list.get('employee_id'),
        department_id: list.get('department_id'),
        month: list.get('month'),
        year: list.get('year'),
        payment_status: list.get('payment_status'),
        company_key: list.get('company_key'),
      });
      const res = await api<ListResult<Slip>>(`/salary${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const showGeneratedSlip = (slip: Slip) => {
    const next = new URLSearchParams(list.params);
    const empId =
      typeof slip.employee_id === 'object' && slip.employee_id?._id
        ? String(slip.employee_id._id)
        : gen.employee_id;
    if (empId) next.set('employee_id', empId);
    next.set('month', String(slip.month));
    next.set('year', String(slip.year));
    next.delete('payment_status');
    next.delete('company_key');
    next.delete('search');
    next.set('page', '1');
    list.setParams(next);
  };

  const handleGenerate = async () => {
    if (!gen.employee_id) {
      setError('Select an employee to generate a salary slip');
      return;
    }
    setGenBusy(true);
    setError(null);
    try {
      const slip = await api<Slip & { payslip: Record<string, unknown> }>('/salary/generate', {
        method: 'POST',
        body: {
          employee_id: gen.employee_id,
          month: Number(gen.month),
          year: Number(gen.year),
          company_key: gen.company_key,
        },
      });
      showGeneratedSlip(slip);
      if (slip.payslip) {
        setPreviewSlipId(slip._id);
        setPreviewStatus(slip.status);
        setPreviewForm(apiPayslipToForm(slip.payslip));
        setShowAdjust(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setGenBusy(false);
    }
  };

  const handleBulkGenerate = async () => {
    setGenBusy(true);
    setError(null);
    try {
      const res = await api<{ generated: number; skipped: { reason?: string }[] }>('/salary/generate-bulk', {
        method: 'POST',
        body: {
          month: Number(gen.month),
          year: Number(gen.year),
          company_key: gen.company_key,
        },
      });
      const next = new URLSearchParams(list.params);
      next.set('month', gen.month);
      next.set('year', gen.year);
      next.delete('payment_status');
      next.delete('employee_id');
      next.delete('company_key');
      next.delete('search');
      next.set('page', '1');
      list.setParams(next);
      const skipN = res.skipped?.length || 0;
      if (skipN > 0) {
        setError(`Generated ${res.generated}. Skipped ${skipN} (finalized or errors).`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk generate failed');
    } finally {
      setGenBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [list.page, list.limit, list.search, list.params]);

  useEffect(() => {
    if (user?.role === 'employee') return;
    // Payroll people list + current HR/admin so they can open / generate their own slips.
    api<ListResult<{ _id: string; name: string }>>('/employees?limit=200&role=employee')
      .then((r) => {
        const rows = [...(r.data || [])];
        if (user?._id && !rows.some((e) => String(e._id) === String(user._id))) {
          rows.unshift({ _id: user._id, name: `${user.name || 'Me'} (You)` });
        }
        setEmps(rows);
      })
      .catch(() => {
        if (user?._id) setEmps([{ _id: user._id, name: `${user.name || 'Me'} (You)` }]);
      });
  }, [user]);

  const openPreview = async (id: string) => {
    setPreviewLoading(true);
    try {
      const slip = await api<Slip & { payslip: Record<string, unknown> }>(`/salary/${id}`);
      setPreviewSlipId(slip._id);
      setPreviewStatus(slip.status);
      setPreviewForm(apiPayslipToForm(slip.payslip));
      setShowAdjust((user?.role === 'admin' || user?.role === 'hr') && slip.status === 'Draft');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payslip');
    } finally {
      setPreviewLoading(false);
    }
  };

  const changePreviewCompany = async (companyKey: SalaryCompanyKey) => {
    if (!previewForm) return;
    setPreviewForm(applyCompanyToForm(previewForm, companyKey));
    if (!previewSlipId || user?.role === 'employee') return;
    setCompanySaving(true);
    try {
      const slip = await api<Slip & { payslip: Record<string, unknown> }>(`/salary/${previewSlipId}/company`, {
        method: 'PATCH',
        body: { company_key: companyKey },
      });
      setPreviewForm(apiPayslipToForm(slip.payslip));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update company');
    } finally {
      setCompanySaving(false);
    }
  };

  const closePreview = () => {
    setPreviewForm(null);
    setPreviewSlipId(null);
    setPreviewStatus(null);
    setShowAdjust(false);
  };

  const canAdjust =
    (user?.role === 'admin' || user?.role === 'hr') && previewStatus === 'Draft' && Boolean(previewSlipId);

  const saveAdjustments = async () => {
    if (!previewSlipId || !previewForm) return;
    setAdjustSaving(true);
    setError(null);
    try {
      const slip = await api<Slip & { payslip: Record<string, unknown> }>(`/salary/${previewSlipId}/adjust`, {
        method: 'PATCH',
        body: formToAdjustPayload(previewForm),
      });
      setPreviewForm(apiPayslipToForm(slip.payslip));
      setPreviewStatus(slip.status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save salary values');
    } finally {
      setAdjustSaving(false);
    }
  };

  const resetAdjustments = async () => {
    if (!previewSlipId) return;
    setAdjustSaving(true);
    setError(null);
    try {
      const slip = await api<Slip & { payslip: Record<string, unknown> }>(`/salary/${previewSlipId}/adjust`, {
        method: 'PATCH',
        body: { reset: true },
      });
      setPreviewForm(apiPayslipToForm(slip.payslip));
      setPreviewStatus(slip.status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset salary values');
    } finally {
      setAdjustSaving(false);
    }
  };

  const downloadPreviewPdf = async () => {
    if (!previewRef.current || !previewForm) return;
    await downloadSalarySlipPdf(previewRef.current, getSalaryPdfFilename(previewForm));
  };

  const sendSlip = async (id: string) => {
    setSendBusy(id);
    setError(null);
    try {
      const res = await api<{ message: string; sent_on: string; sent_to: string }>(`/salary/${id}/send`, {
        method: 'POST',
        body: {},
      });
      setError(null);
      alert(res.message || 'Salary slip sent');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send salary slip');
    } finally {
      setSendBusy(null);
    }
  };

  return (
    <>
      <ListingPage
        title="Salary Slips"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <>
            <select
              className="select select-month"
              value={list.get('month')}
              onChange={(e) => list.setFilter('month', e.target.value)}
            >
              <option value="">Month</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="select select-year"
              value={list.get('year')}
              onChange={(e) => list.setFilter('year', e.target.value)}
            >
              <option value="">Year</option>
              {[2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {user?.role !== 'employee' && (
              <>
                <select
                  className="select"
                  value={list.get('employee_id')}
                  onChange={(e) => list.setFilter('employee_id', e.target.value)}
                >
                  <option value="">All employees</option>
                  {emps.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                {user?._id && (
                  <Button
                    type="button"
                    variant={list.get('employee_id') === String(user._id) ? 'default' : 'outline'}
                    onClick={() => list.setFilter('employee_id', String(user._id))}
                  >
                    My slips
                  </Button>
                )}
              </>
            )}
          </>
        }
        typeFilters={
          <>
            <select
              className="select"
              value={list.get('payment_status')}
              onChange={(e) => list.setFilter('payment_status', e.target.value)}
            >
              <option value="">Payment</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
            </select>
            <select
              className="select"
              value={list.get('company_key')}
              onChange={(e) => list.setFilter('company_key', e.target.value)}
            >
              <option value="">Company</option>
              <option value="kriraai">KriraAI</option>
              <option value="ondial">Ondial</option>
            </select>
          </>
        }
        actions={
          user?.role !== 'employee' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="select"
                title="Salary format company"
                value={gen.company_key}
                onChange={(e) => setGen({ ...gen, company_key: e.target.value as SalaryCompanyKey })}
              >
                <option value="kriraai">KriraAI</option>
                <option value="ondial">Ondial</option>
              </select>
              <select
                className="select"
                value={gen.employee_id}
                onChange={(e) => setGen({ ...gen, employee_id: e.target.value })}
              >
                <option value="">Employee</option>
                {emps.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <select
                className="select select-month"
                value={gen.month}
                onChange={(e) => setGen({ ...gen, month: e.target.value })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="select select-year"
                value={gen.year}
                onChange={(e) => setGen({ ...gen, year: e.target.value })}
              >
                {[2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <Button disabled={genBusy} onClick={handleGenerate}>
                {genBusy ? 'Generating…' : 'Generate'}
              </Button>
              {allowBulk && (
                <Button variant="outline" disabled={genBusy} onClick={handleBulkGenerate}>
                  Bulk generate
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Company</th>
                <th>Period</th>
                <th>Target</th>
                <th>Counted</th>
                <th>Mgmt OT</th>
                <th>Total leave / deduct</th>
                <th>Early checkout / deduct</th>
                <th title="Held from salary when joining proof is salary deduction (until returned)">Bond hold</th>
                <th>Net</th>
                <th>Status</th>
                <th>Payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s._id}>
                  <td>{s.employee_id?.name || '—'}</td>
                  <td>
                    {SALARY_COMPANIES[s.company_key === 'ondial' ? 'ondial' : 'kriraai'].label}
                  </td>
                  <td>
                    {s.month}/{s.year}
                  </td>
                  <td>{formatHours(s.monthly_target_hours)}</td>
                  <td>{formatHours(s.monthly_counted_hours)}</td>
                  <td>{formatHours(s.overtime_hours)}</td>
                  <td>
                    <div>{Number(s.leave_days || 0)} approved · {Number(s.lop_days || 0)} LOP</div>
                    <span className="emp-stat-hint">
                      {s.leave_deduction_amount
                        ? `₹${Number(s.leave_deduction_amount).toLocaleString('en-IN')}`
                        : 'No deduction'}
                    </span>
                  </td>
                  <td>
                    <div>{Math.round(Number(s.early_checkout_minutes || 0))} min</div>
                    <span className="emp-stat-hint">
                      {s.early_checkout_deduction_amount
                        ? `₹${Number(s.early_checkout_deduction_amount).toLocaleString('en-IN')}`
                        : 'No deduction'}
                    </span>
                  </td>
                  <td>
                    {s.bond_security_deduction
                      ? `₹${Number(s.bond_security_deduction).toLocaleString('en-IN')}${
                          s.bond_security_percent ? ` (${s.bond_security_percent}%)` : ''
                        }`
                      : '—'}
                  </td>
                  <td>₹{Number(s.net_pay).toLocaleString('en-IN')}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>
                    <StatusBadge status={s.payment_status} />
                  </td>
                  <td className="row-actions">
                    <Button variant="outline" onClick={() => openPreview(s._id)} disabled={previewLoading}>
                      {(user?.role === 'admin' || user?.role === 'hr') && s.status === 'Draft' ? 'Adjust' : 'View'}
                    </Button>
                    {(user?.role === 'admin' || user?.role === 'hr') && s.status === 'Draft' && (
                      <Button
                        onClick={async () => {
                          try {
                            setError(null);
                            await api(`/salary/${s._id}/finalize`, { method: 'POST', body: {} });
                            load();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Finalize failed');
                          }
                        }}
                      >
                        Finalize
                      </Button>
                    )}
                    {user?.role === 'admin' && s.status === 'Finalized' && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await api(`/salary/${s._id}/reverse`, { method: 'POST', body: { reason: 'reissue' } });
                          load();
                        }}
                      >
                        Reverse
                      </Button>
                    )}
                    {(user?.role === 'admin' || user?.role === 'hr') && s.status === 'Finalized' && (
                      <Button
                        variant="outline"
                        disabled={sendBusy === s._id}
                        onClick={() => sendSlip(s._id)}
                      >
                        {sendBusy === s._id ? 'Sending…' : s.sent_on ? 'Resend' : 'Send salary'}
                      </Button>
                    )}
                    {(user?.role === 'admin' || user?.role === 'hr') &&
                      s.status === 'Finalized' &&
                      s.payment_status === 'Pending' && (
                        <Button
                          onClick={async () => {
                            await api(`/salary/${s._id}/payment`, {
                              method: 'PATCH',
                              body: {
                                payment_status: 'Paid',
                                paid_date: new Date().toISOString().slice(0, 10),
                                payment_reference: 'MANUAL',
                              },
                            });
                            load();
                          }}
                        >
                          Mark paid
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>

      {previewForm && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) closePreview();
          }}
        >
          <DialogContent className="sm:max-w-[920px]" style={{ maxHeight: '92vh', overflow: 'auto' }}>
            <DialogHeader>
              <DialogTitle>Salary Slip Preview</DialogTitle>
            </DialogHeader>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(user?.role === 'admin' || user?.role === 'hr') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                  Company
                  <select
                    className="select"
                    style={{ width: 120 }}
                    disabled={companySaving}
                    value={resolveCompanyKeyFromForm(previewForm)}
                    onChange={(e) => changePreviewCompany(e.target.value as SalaryCompanyKey)}
                  >
                    <option value="kriraai">KriraAI</option>
                    <option value="ondial">Ondial</option>
                  </select>
                </label>
              )}
              {canAdjust && (
                <>
                  <Button variant="outline" onClick={() => setShowAdjust((v) => !v)}>
                    {showAdjust ? 'View slip' : 'Edit values'}
                  </Button>
                  {showAdjust && (
                    <>
                      <Button variant="outline" disabled={adjustSaving} onClick={resetAdjustments}>
                        Reset calculated
                      </Button>
                      <Button disabled={adjustSaving} onClick={saveAdjustments}>
                        {adjustSaving ? 'Saving…' : 'Save values'}
                      </Button>
                    </>
                  )}
                </>
              )}
              <Button onClick={downloadPreviewPdf}>
                Download PDF
              </Button>
              <Button variant="outline" onClick={closePreview}>
                Close
              </Button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <SalarySlipPreview
                form={previewForm}
                previewRef={previewRef}
                editable={canAdjust && showAdjust}
                disabled={adjustSaving}
                onChange={setPreviewForm}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
