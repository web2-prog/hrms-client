import type { RefObject } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { NumberInput } from './NumberInput';
import {
  type SalarySlipFormData,
  MONTH_NAMES,
  SALARY_COMPANIES,
  resolveCompanyKeyFromForm,
  calculateGrossEarnings,
  calculateTotalDeductions,
  calculateNetPay,
  formatSlipAmount,
  amountToWords,
  applyLopDays,
} from '../services/salarySlipDefaults';
import './SalarySlipPreview.css';

type Line = { label: string; amount: number; ytd: number };
type Row = { key: string; label: string; amount: number; ytd: number; customIndex?: number };

type Props = {
  form: SalarySlipFormData;
  previewRef?: RefObject<HTMLDivElement | null>;
  editable?: boolean;
  disabled?: boolean;
  onChange?: (form: SalarySlipFormData) => void;
};

function patchAmount(
  form: SalarySlipFormData,
  field: keyof SalarySlipFormData,
  ytdField: keyof SalarySlipFormData,
  next: number
): SalarySlipFormData {
  const prev = Number(form[field]) || 0;
  const prevYtd = Number(form[ytdField]) || 0;
  return { ...form, [field]: next, [ytdField]: Math.round((prevYtd - prev + next) * 100) / 100 };
}

function buildEarningRows(form: SalarySlipFormData, editable: boolean): Row[] {
  const rows: Row[] = [{ key: 'basic', label: 'Basic', amount: form.basic, ytd: form.ytdBasic }];
  if (editable || form.overtime > 0) {
    rows.push({ key: 'overtime', label: 'Overtime', amount: form.overtime, ytd: form.ytdOvertime });
  }
  (form.customEarnings || []).forEach((item, index) => {
    if (!editable && !item.label) return;
    rows.push({
      key: `ce-${index}`,
      label: item.label,
      amount: item.amount,
      ytd: item.ytd ?? item.amount,
      customIndex: index,
    });
  });
  return rows;
}

function buildDeductionRows(form: SalarySlipFormData, editable: boolean): Row[] {
  const rows: Row[] = [];
  if (editable || form.shortfallDeduction > 0) {
    rows.push({
      key: 'shortfall',
      label: 'Shortfall Deduction',
      amount: form.shortfallDeduction,
      ytd: form.ytdShortfallDeduction,
    });
  }
  rows.push({
    key: 'leave',
    label: `Leave Deduction (${form.lopDays} LOP day${form.lopDays === 1 ? '' : 's'})`,
    amount: form.leaveDeduction,
    ytd: form.ytdLeaveDeduction,
  });
  if (editable || form.earlyCheckoutDeduction > 0) {
    rows.push({
      key: 'early',
      label: `Early Checkout Deduction (${Math.round(form.earlyCheckoutMinutes)} min)`,
      amount: form.earlyCheckoutDeduction,
      ytd: form.ytdEarlyCheckoutDeduction,
    });
  }
  if (editable || form.bondSecurity > 0) {
    const pct = form.bondSecurityPercent ? ` (${form.bondSecurityPercent}%)` : '';
    rows.push({
      key: 'bond',
      label: `Bond Security Hold${pct}`,
      amount: form.bondSecurity,
      ytd: form.ytdBondSecurity,
    });
  }
  rows.push({ key: 'tds', label: 'TDS', amount: form.tds, ytd: form.ytdTds });
  (form.customDeductions || []).forEach((item, index) => {
    if (!editable && !item.label) return;
    rows.push({
      key: `cd-${index}`,
      label: item.label,
      amount: item.amount,
      ytd: item.ytd ?? item.amount,
      customIndex: index,
    });
  });
  return rows;
}

function CompanyLogo({ form }: { form: SalarySlipFormData }) {
  const key = resolveCompanyKeyFromForm(form);
  const company = SALARY_COMPANIES[key];
  return (
    <img
      src={company.logoSrc}
      alt={company.label}
      className={`company-logo company-logo--${key}`}
      crossOrigin="anonymous"
      decoding="sync"
    />
  );
}

function TextField({
  value,
  disabled,
  className,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className={`payslip-input ${className || ''}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function AmountField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <NumberInput
      className="payslip-input payslip-input-amt"
      step="0.01"
      min={0}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

function DaysField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <NumberInput
      className="payslip-input payslip-input-days"
      step="0.5"
      min={0}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

export function SalarySlipPreview({ form, previewRef, editable = false, disabled, onChange }: Props) {
  const update = (next: SalarySlipFormData) => onChange?.(next);
  const grossEarnings = calculateGrossEarnings(form);
  const totalDeductions = calculateTotalDeductions(form);
  const netPay = calculateNetPay(form);
  const monthLabel = MONTH_NAMES[form.month - 1] || '';
  const payPeriod = `${monthLabel} ${form.year}`;
  const earningRows = buildEarningRows(form, editable);
  const deductionRows = buildDeductionRows(form, editable);
  const maxRows = Math.max(earningRows.length, deductionRows.length, 1);

  const setCustom = (key: 'customEarnings' | 'customDeductions', index: number, patch: Partial<Line>) => {
    const lines = [...(form[key] || [])];
    const current = lines[index] || { label: '', amount: 0, ytd: 0 };
    const amount = patch.amount != null ? patch.amount : current.amount;
    lines[index] = {
      ...current,
      ...patch,
      ytd: Math.round((current.ytd - current.amount + amount) * 100) / 100,
    };
    update({ ...form, [key]: lines });
  };

  const removeCustom = (key: 'customEarnings' | 'customDeductions', index: number) => {
    update({ ...form, [key]: (form[key] || []).filter((_, i) => i !== index) });
  };

  const addCustom = (key: 'customEarnings' | 'customDeductions') => {
    update({ ...form, [key]: [...(form[key] || []), { label: '', amount: 0, ytd: 0 }] });
  };

  const renderAmountCell = (row: Row | undefined, side: 'earn' | 'ded') => {
    if (!row) return '';
    if (!editable || !onChange) return formatSlipAmount(row.amount, true);
    if (row.key === 'basic') {
      return (
        <AmountField
          value={form.basic}
          disabled={disabled}
          onChange={(v) => {
            const next = patchAmount(form, 'basic', 'ytdBasic', v);
            update(form.lopDays > 0 ? applyLopDays(next, form.lopDays) : next);
          }}
        />
      );
    }
    if (row.key === 'overtime') {
      return (
        <AmountField
          value={form.overtime}
          disabled={disabled}
          onChange={(v) => update(patchAmount(form, 'overtime', 'ytdOvertime', v))}
        />
      );
    }
    if (row.key === 'shortfall') {
      return (
        <AmountField
          value={form.shortfallDeduction}
          disabled={disabled}
          onChange={(v) => update(patchAmount(form, 'shortfallDeduction', 'ytdShortfallDeduction', v))}
        />
      );
    }
    if (row.key === 'leave') {
      return (
        <AmountField
          value={form.leaveDeduction}
          disabled={disabled}
          onChange={(v) => update(patchAmount(form, 'leaveDeduction', 'ytdLeaveDeduction', v))}
        />
      );
    }
    if (row.key === 'early') {
      return (
        <AmountField
          value={form.earlyCheckoutDeduction}
          disabled={disabled}
          onChange={(v) => update(patchAmount(form, 'earlyCheckoutDeduction', 'ytdEarlyCheckoutDeduction', v))}
        />
      );
    }
    if (row.key === 'bond') {
      return (
        <AmountField
          value={form.bondSecurity}
          disabled={disabled}
          onChange={(v) => update(patchAmount(form, 'bondSecurity', 'ytdBondSecurity', v))}
        />
      );
    }
    if (row.key === 'tds') {
      return (
        <AmountField value={form.tds} disabled={disabled} onChange={(v) => update(patchAmount(form, 'tds', 'ytdTds', v))} />
      );
    }
    if (row.customIndex != null) {
      const key = side === 'earn' ? 'customEarnings' : 'customDeductions';
      return (
        <AmountField
          value={row.amount}
          disabled={disabled}
          onChange={(v) => setCustom(key, row.customIndex!, { amount: v })}
        />
      );
    }
    return formatSlipAmount(row.amount, true);
  };

  const renderNameCell = (row: Row | undefined, side: 'earn' | 'ded') => {
    if (!row) return '';
    if (editable && onChange && row.customIndex != null) {
      const key = side === 'earn' ? 'customEarnings' : 'customDeductions';
      return (
        <span className="payslip-custom-name">
          <TextField
            value={row.label}
            disabled={disabled}
            className="payslip-input-label"
            onChange={(v) => setCustom(key, row.customIndex!, { label: v })}
          />
          <button
            type="button"
            className="payslip-remove"
            disabled={disabled}
            aria-label="Remove line"
            onClick={() => removeCustom(key, row.customIndex!)}
          >
            <Trash2 size={12} />
          </button>
        </span>
      );
    }
    return row.label;
  };

  return (
    <div ref={previewRef} className={`payslip${editable ? ' is-editing' : ''}`}>
      <div className="payslip-header">
        <div className="header-left">
          <CompanyLogo form={form} />
          <div className="header-company">
            <p className="company-address">{form.companyAddress}</p>
          </div>
        </div>
        <div className="header-right">
          <p className="payslip-title-label">Payslip For the Month</p>
          <p className="payslip-title-month">
            {monthLabel} {form.year}
          </p>
        </div>
      </div>

      <div className="summary-section">
        <div className="employee-details">
          <div className="detail-row">
            <span className="detail-label">Employee Name</span>
            <span className="detail-colon">:</span>
            <span className="detail-value">{form.empName || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Designation</span>
            <span className="detail-colon">:</span>
            <span className="detail-value">{form.designation || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Employee ID</span>
            <span className="detail-colon">:</span>
            <span className="detail-value">{form.empNo || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Date of Joining</span>
            <span className="detail-colon">:</span>
            <span className="detail-value">{form.doj || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Pay Period</span>
            <span className="detail-colon">:</span>
            <span className="detail-value">{payPeriod}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Pay Date</span>
            <span className="detail-colon">:</span>
            <span className="detail-value">
              {editable && onChange ? (
                <TextField value={form.payDate} disabled={disabled} onChange={(v) => update({ ...form, payDate: v })} />
              ) : (
                form.payDate || '—'
              )}
            </span>
          </div>
        </div>

        <div className="net-pay-card">
          <div className="net-pay-accent">
            <p className="net-pay-amount">{formatSlipAmount(netPay, true)}</p>
            <p className="net-pay-label">Employee Net Pay</p>
          </div>
          <div className="net-pay-white">
            <div className="meta-row">
              <span className="meta-label">Paid Days</span>
              <span className="meta-value">
                {editable && onChange ? (
                  <DaysField value={form.paidDays} disabled={disabled} onChange={(v) => update({ ...form, paidDays: v })} />
                ) : (
                  form.paidDays
                )}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Total Approved Leave</span>
              <span className="meta-value">
                {editable && onChange ? (
                  <DaysField
                    value={form.leaveDays}
                    disabled={disabled}
                    onChange={(v) => update({ ...form, leaveDays: v })}
                  />
                ) : (
                  form.leaveDays
                )}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Leave Deduction Days</span>
              <span className="meta-value">
                {editable && onChange ? (
                  <DaysField
                    value={form.lopDays}
                    disabled={disabled}
                    onChange={(v) => update(applyLopDays(form, v))}
                  />
                ) : (
                  form.lopDays
                )}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Early Checkout</span>
              <span className="meta-value">{Math.round(form.earlyCheckoutMinutes)} min</span>
            </div>
          </div>
        </div>
      </div>

      <div className="id-section">
        <div className="id-item">
          <span className="id-label">PF A/C Number</span>
          <span className="id-colon">:</span>
          <span className="id-value">
            {editable && onChange ? (
              <TextField value={form.pfNo} disabled={disabled} onChange={(v) => update({ ...form, pfNo: v })} />
            ) : (
              form.pfNo || 'NA'
            )}
          </span>
        </div>
        <div className="id-item">
          <span className="id-label">UAN</span>
          <span className="id-colon">:</span>
          <span className="id-value">
            {editable && onChange ? (
              <TextField value={form.uan} disabled={disabled} onChange={(v) => update({ ...form, uan: v })} />
            ) : (
              form.uan || 'NA'
            )}
          </span>
        </div>
      </div>

      <table className="salary-table">
        <thead>
          <tr>
            <th className="col-name th-earn">EARNINGS</th>
            <th className="col-amt">AMOUNT</th>
            <th className="col-ytd">YTD</th>
            <th className="col-name th-ded">DEDUCTIONS</th>
            <th className="col-amt">AMOUNT</th>
            <th className="col-ytd">YTD</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }).map((_, index) => {
            const earning = earningRows[index];
            const deduction = deductionRows[index];
            return (
              <tr key={index}>
                <td className="col-name">{renderNameCell(earning, 'earn')}</td>
                <td className="col-amt">{renderAmountCell(earning, 'earn')}</td>
                <td className="col-ytd">{earning ? formatSlipAmount(earning.ytd, true) : ''}</td>
                <td className="col-name">{renderNameCell(deduction, 'ded')}</td>
                <td className="col-amt">{renderAmountCell(deduction, 'ded')}</td>
                <td className="col-ytd">{deduction ? formatSlipAmount(deduction.ytd, true) : ''}</td>
              </tr>
            );
          })}

          {editable && onChange && (
            <tr className="add-row">
              <td className="col-name" colSpan={3}>
                <button type="button" className="payslip-add" disabled={disabled} onClick={() => addCustom('customEarnings')}>
                  <Plus size={12} /> Add earning
                </button>
              </td>
              <td className="col-name" colSpan={3}>
                <button type="button" className="payslip-add" disabled={disabled} onClick={() => addCustom('customDeductions')}>
                  <Plus size={12} /> Add deduction
                </button>
              </td>
            </tr>
          )}

          <tr className="spacer-row" aria-hidden="true">
            <td className="col-name">&nbsp;</td>
            <td className="col-amt">&nbsp;</td>
            <td className="col-ytd">&nbsp;</td>
            <td className="col-name">&nbsp;</td>
            <td className="col-amt">&nbsp;</td>
            <td className="col-ytd">&nbsp;</td>
          </tr>

          <tr className="total-row">
            <td className="col-name total-label">Gross Earnings</td>
            <td className="col-amt total-amt">{formatSlipAmount(grossEarnings, true)}</td>
            <td className="col-ytd" />
            <td className="col-name total-label">Total Deductions</td>
            <td className="col-amt total-amt">{formatSlipAmount(totalDeductions, true)}</td>
            <td className="col-ytd" />
          </tr>
        </tbody>
      </table>

      <div className="net-payable-box">
        <div className="net-payable-left">
          <p className="net-payable-title">TOTAL NET PAYABLE</p>
          <p className="net-payable-sub">Gross Earnings - Total Deductions</p>
        </div>
        <div className="net-payable-right">
          <span className="net-payable-amt">{formatSlipAmount(netPay, true)}</span>
        </div>
      </div>

      <p className="amount-in-words">
        <span className="amount-in-words-label">Amount In Words :</span>{' '}
        <strong>{amountToWords(netPay)}</strong>
      </p>
    </div>
  );
}
