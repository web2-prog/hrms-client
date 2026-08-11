import type { RefObject } from 'react';
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
} from '../services/salarySlipDefaults';
import './SalarySlipPreview.css';

type Row = { label: string; amount: number; ytd: number };

type Props = {
  form: SalarySlipFormData;
  previewRef?: RefObject<HTMLDivElement | null>;
};

function buildEarningRows(form: SalarySlipFormData): Row[] {
  const rows: Row[] = [{ label: 'Basic', amount: form.basic, ytd: form.ytdBasic }];
  if (form.overtime > 0) {
    rows.push({ label: 'Overtime', amount: form.overtime, ytd: form.ytdOvertime });
  }
  return rows;
}

function buildDeductionRows(form: SalarySlipFormData): Row[] {
  const rows: Row[] = [];
  if (form.shortfallDeduction > 0) {
    rows.push({
      label: 'Shortfall Deduction',
      amount: form.shortfallDeduction,
      ytd: form.ytdShortfallDeduction,
    });
  }
  if (form.leaveDeduction > 0) {
    rows.push({
      label: 'Leave Deduction (LOP)',
      amount: form.leaveDeduction,
      ytd: form.ytdLeaveDeduction,
    });
  }
  if (form.earlyCheckoutDeduction > 0) {
    rows.push({
      label: 'Early Checkout Deduction',
      amount: form.earlyCheckoutDeduction,
      ytd: form.ytdEarlyCheckoutDeduction,
    });
  }
  if (form.bondSecurity > 0) {
    const pct = form.bondSecurityPercent ? ` (${form.bondSecurityPercent}%)` : '';
    rows.push({
      label: `Bond Security Hold${pct}`,
      amount: form.bondSecurity,
      ytd: form.ytdBondSecurity,
    });
  }
  rows.push({ label: 'TDS', amount: form.tds, ytd: form.ytdTds });
  return rows;
}

function CompanyLogo({ form }: { form: SalarySlipFormData }) {
  const company = SALARY_COMPANIES[resolveCompanyKeyFromForm(form)];
  return <img src={company.logoSrc} alt={company.label} className="company-logo" />;
}

export function SalarySlipPreview({ form, previewRef }: Props) {
  const grossEarnings = calculateGrossEarnings(form);
  const totalDeductions = calculateTotalDeductions(form);
  const netPay = calculateNetPay(form);
  const monthLabel = MONTH_NAMES[form.month - 1] || '';
  const payPeriod = `${monthLabel} ${form.year}`;
  const earningRows = buildEarningRows(form);
  const deductionRows = buildDeductionRows(form);
  const maxRows = Math.max(earningRows.length, deductionRows.length);

  return (
    <div ref={previewRef} className="payslip">
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
            <span className="detail-value">{form.payDate || '—'}</span>
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
              <span className="meta-value">{form.paidDays}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">LOP Days</span>
              <span className="meta-value">{form.lopDays}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="id-section">
        <div className="id-item">
          <span className="id-label">PF A/C Number</span>
          <span className="id-colon">:</span>
          <span className="id-value">{form.pfNo || 'NA'}</span>
        </div>
        <div className="id-item">
          <span className="id-label">UAN</span>
          <span className="id-colon">:</span>
          <span className="id-value">{form.uan || 'NA'}</span>
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
                <td className="col-name">{earning?.label || ''}</td>
                <td className="col-amt">{earning ? formatSlipAmount(earning.amount, true) : ''}</td>
                <td className="col-ytd">{earning ? formatSlipAmount(earning.ytd, true) : ''}</td>
                <td className="col-name">{deduction?.label || ''}</td>
                <td className="col-amt">{deduction ? formatSlipAmount(deduction.amount, true) : ''}</td>
                <td className="col-ytd">{deduction ? formatSlipAmount(deduction.ytd, true) : ''}</td>
              </tr>
            );
          })}

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
