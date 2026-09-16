import type { ReactNode, RefObject } from 'react';
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
type Row = { key: string; label: string; amount: number; customIndex?: number };

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
  next: number
): SalarySlipFormData {
  return { ...form, [field]: next };
}

function buildEarningRows(form: SalarySlipFormData, editable: boolean): Row[] {
  const rows: Row[] = [{ key: 'basic', label: 'Basic', amount: form.basic }];
  (form.customEarnings || []).forEach((item, index) => {
    if (!editable && !item.label) return;
    rows.push({
      key: `ce-${index}`,
      label: item.label,
      amount: item.amount,
      customIndex: index,
    });
  });
  return rows;
}

function buildDeductionRows(form: SalarySlipFormData, editable: boolean): Row[] {
  const rows: Row[] = [];
  const lopAmount = Number(form.leaveDeduction) || 0;
  const lopDays = Number(form.lopDays) || 0;
  const showLop = editable || lopAmount !== 0 || lopDays > 0;
  if (showLop) {
    rows.push({
      key: 'lop',
      label: form.leaveDeductionLabel || 'LOP Deduction',
      amount: lopAmount,
    });
  }
  (form.customDeductions || []).forEach((item, index) => {
    if (!editable && !(item.label && item.amount)) return;
    rows.push({
      key: `cd-${index}`,
      label: item.label || 'Manual Deduction',
      amount: item.amount,
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
      src={`${company.logoSrc}?v=9`}
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

function InfoCell({
  label,
  value,
  editable,
  disabled,
  onChange,
}: {
  label: string;
  value: ReactNode;
  editable?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="info-cell">
      <span className="info-label">{label}</span>
      <span className="info-value">
        {editable && onChange && typeof value === 'string' ? (
          <TextField value={value} disabled={disabled} onChange={onChange} />
        ) : (
          value || '—'
        )}
      </span>
    </div>
  );
}

function fmtAmt(n: number) {
  if (!Number.isFinite(n) || n === 0) return '0';
  return formatSlipAmount(n, false).replace(/\.00$/, '');
}

export function SalarySlipPreview({ form, previewRef, editable = false, disabled, onChange }: Props) {
  const update = (next: SalarySlipFormData) => onChange?.(next);
  const grossEarnings = calculateGrossEarnings(form);
  const totalDeductions = calculateTotalDeductions(form);
  const netPay = calculateNetPay(form);
  const exGratia = Number(form.overtime) || 0;
  /** Sample layout: overtime shown under Ex-Gratia, not inside GROSS line. */
  const displayGross = Math.round((grossEarnings - exGratia) * 100) / 100;
  const monthLabel = MONTH_NAMES[form.month - 1] || '';
  const monthDash = `${monthLabel}-${form.year}`;
  const companyKey = resolveCompanyKeyFromForm(form);
  const company = SALARY_COMPANIES[companyKey];
  const earningRows = buildEarningRows(form, editable);
  const deductionRows = buildDeductionRows(form, editable);
  const maxRows = Math.max(earningRows.length, deductionRows.length, 1);
  const department = form.department || form.designation || '—';

  const setCustom = (key: 'customEarnings' | 'customDeductions', index: number, patch: Partial<Line>) => {
    const lines = [...(form[key] || [])];
    const current = lines[index] || { label: '', amount: 0, ytd: 0 };
    const amount = patch.amount != null ? patch.amount : current.amount;
    lines[index] = {
      ...current,
      ...patch,
      amount,
      ytd: amount,
    };
    update({ ...form, [key]: lines });
  };

  const removeCustom = (key: 'customEarnings' | 'customDeductions', index: number) => {
    update({ ...form, [key]: (form[key] || []).filter((_, i) => i !== index) });
  };

  const addCustom = (key: 'customEarnings' | 'customDeductions') => {
    update({
      ...form,
      [key]: [
        ...(form[key] || []),
        {
          label: key === 'customDeductions' ? 'Manual Deduction' : 'Extra Earning',
          amount: 0,
          ytd: 0,
        },
      ],
    });
  };

  const renderAmountCell = (row: Row | undefined, side: 'earn' | 'ded') => {
    if (!row) return '';
    if (!editable || !onChange) return fmtAmt(row.amount);
    if (row.key === 'basic') {
      return (
        <AmountField
          value={form.basic}
          disabled={disabled}
          onChange={(v) => {
            let next = patchAmount(form, 'basic', v);
            if ((Number(next.lopDays) || 0) > 0) next = applyLopDays(next, next.lopDays);
            update(next);
          }}
        />
      );
    }
    if (row.key === 'lop') {
      return (
        <AmountField
          value={form.leaveDeduction}
          disabled={disabled}
          onChange={(v) => update(patchAmount(form, 'leaveDeduction', v))}
        />
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
    return fmtAmt(row.amount);
  };

  const renderNameCell = (row: Row | undefined, side: 'earn' | 'ded') => {
    if (!row) return '';
    if (editable && onChange && row.key === 'lop') {
      return (
        <span className="payslip-custom-name">
          <TextField
            value={form.leaveDeductionLabel || 'LOP Deduction'}
            disabled={disabled}
            className="payslip-input-label"
            onChange={(v) => update({ ...form, leaveDeductionLabel: v })}
          />
        </span>
      );
    }
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
      <div className="payslip-box payslip-header-box">
        <div className="payslip-logo-wrap">
          <CompanyLogo form={form} />
        </div>
        <p className="company-address">{form.companyAddress}</p>
      </div>

      <div className="payslip-box payslip-title-box">
        <h1 className="payslip-title">
          Payslip for {monthLabel} {form.year}
        </h1>
      </div>

      <div className="payslip-box info-grid">
        <InfoCell label="Emp Name" value={form.empName || '—'} />
        <InfoCell label="Emp No" value={form.empNo || '—'} />

        <InfoCell label="Department" value={department} />
        <InfoCell label="Month" value={monthDash} />

        <InfoCell label="Bank" value={form.bankName || '—'} />
        <InfoCell label="Bank A/c No" value={form.bankAccount || '—'} />

        <InfoCell label="Designation" value={form.designation || department || '—'} />
        <InfoCell label="PF No" value={form.pfNo || 'NA'} />

        <div className="info-cell">
          <span className="info-label">STD days</span>
          <span className="info-value">
            {editable && onChange ? (
              <DaysField
                value={form.workingDays}
                disabled={disabled}
                onChange={(v) => {
                  const workingDays = Math.max(0, Number(v) || 0);
                  const lop = Number(form.lopDays) || 0;
                  update({
                    ...form,
                    workingDays,
                    paidDays: Math.max(0, Math.round((workingDays - lop) * 100) / 100),
                  });
                }}
              />
            ) : (
              form.workingDays || '—'
            )}
          </span>
        </div>
        <InfoCell label="ESIC No" value={form.esicNo || 'NA'} />

        <div className="info-cell">
          <span className="info-label">Worked Days</span>
          <span className="info-value">
            {editable && onChange ? (
              <DaysField
                value={form.paidDays}
                disabled={disabled}
                onChange={(v) => update({ ...form, paidDays: v })}
              />
            ) : (
              form.paidDays
            )}
          </span>
        </div>
        <div className="info-cell">
          <span className="info-label">Leave Balance</span>
          <span className="info-value">
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

        {editable && onChange && (
          <>
            <div className="info-cell">
              <span className="info-label">Pay Date</span>
              <span className="info-value">
                <TextField
                  value={form.payDate}
                  disabled={disabled}
                  onChange={(v) => update({ ...form, payDate: v })}
                />
              </span>
            </div>
            <div className="info-cell">
              <span className="info-label">LOP Days</span>
              <span className="info-value">
                <DaysField
                  value={form.lopDays}
                  disabled={disabled}
                  onChange={(v) => update(applyLopDays(form, v))}
                />
              </span>
            </div>
          </>
        )}
      </div>

      <div className="payslip-box payslip-amount-box">
        <table className="payslip-amount-table">
          <thead>
            <tr>
              <th className="col-name th-earn">Earnings</th>
              <th className="col-amt">Amount In Rs.</th>
              <th className="col-name th-ded">Statutory Deduction</th>
              <th className="col-amt">Amount In Rs.</th>
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
                  <td className="col-name">{renderNameCell(deduction, 'ded')}</td>
                  <td className="col-amt">{renderAmountCell(deduction, 'ded')}</td>
                </tr>
              );
            })}

            {editable && onChange && (
              <tr className="add-row">
                <td className="col-name" colSpan={2}>
                  <button type="button" className="payslip-add" disabled={disabled} onClick={() => addCustom('customEarnings')}>
                    <Plus size={12} /> Add earning
                  </button>
                </td>
                <td className="col-name" colSpan={2}>
                  <button type="button" className="payslip-add" disabled={disabled} onClick={() => addCustom('customDeductions')}>
                    <Plus size={12} /> Add Deduction
                  </button>
                </td>
              </tr>
            )}

            <tr className="total-row">
              <td className="col-name total-label">GROSS EARNINGS</td>
              <td className="col-amt total-amt">{fmtAmt(displayGross)}</td>
              <td className="col-name total-label">GROSS DEDUCTIONS</td>
              <td className="col-amt total-amt">{fmtAmt(totalDeductions)}</td>
            </tr>

            <tr className="extra-row">
              <td className="col-name">Add: Ex-Gratia Payment</td>
              <td className="col-amt">
                {editable && onChange ? (
                  <AmountField
                    value={exGratia}
                    disabled={disabled}
                    onChange={(v) => update(patchAmount(form, 'overtime', v))}
                  />
                ) : (
                  fmtAmt(exGratia)
                )}
              </td>
              <td className="col-name">Less: Advance etc</td>
              <td className="col-amt">0</td>
            </tr>

            <tr className="net-row">
              <td className="net-label" colSpan={3}>
                NET SALARY EARNED
              </td>
              <td className="col-amt net-amt">{fmtAmt(netPay)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="amount-in-words">
        <span className="amount-in-words-label">Amount In Words :</span>{' '}
        <strong>{amountToWords(netPay)}</strong>
      </p>

      <div className="payslip-box sign-block">
        <div className="sign-cell sign-prepared">
          <div className="sign-content">
            <p className="authorised-name">{company.authorisedName}</p>
            <p className="authorised-title">{company.authorisedTitle}</p>
          </div>
          <span className="sign-label">Prepared By</span>
        </div>
        <div className="sign-cell sign-authorised">
          <div className="sign-content">
            <img
              src="/images/authorised-sign.png?v=3"
              alt="Authorised signature"
              className="sign-image sign-image--authorised"
              crossOrigin="anonymous"
              decoding="sync"
            />
          </div>
          <span className="sign-label">Authorised Sign.</span>
        </div>
      </div>
    </div>
  );
}
