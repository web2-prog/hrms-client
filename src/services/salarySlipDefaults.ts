export type SalaryCompanyKey = 'kriraai' | 'ondial';

export const SALARY_COMPANIES: Record<
  SalaryCompanyKey,
  {
    label: string;
    companyName: string;
    companyAddress: string;
    logoSrc: string;
    pdfPrefix: string;
  }
> = {
  kriraai: {
    label: 'KriraAI',
    companyName: 'KriraAI Pvt. Ltd.',
    companyAddress:
      'C2-1310, Pragati IT Park, opp. AR Mall, Mota Varachha Road, Uttran, Surat',
    logoSrc: '/images/kriraai-logo.svg',
    pdfPrefix: 'KriraAI',
  },
  ondial: {
    label: 'Ondial',
    companyName: 'Ondial Pvt. Ltd.',
    companyAddress:
      'C2-1310, Pragati IT Park, opp. AR Mall, Mota Varachha Road, Uttran, Surat',
    logoSrc: '/images/ondial-logo.svg',
    pdfPrefix: 'Ondial',
  },
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Spec payslip form — maps hours-based slip + bond hold into Zoho layout */
export type SalarySlipFormData = {
  companyKey?: SalaryCompanyKey;
  companyName: string;
  companyAddress: string;
  empName: string;
  empNo: string;
  designation: string;
  doj: string;
  payDate: string;
  pfNo: string;
  uan: string;
  paidDays: number;
  leaveDays: number;
  lopDays: number;
  workingDays: number;
  month: number;
  year: number;
  basic: number;
  ytdBasic: number;
  overtime: number;
  ytdOvertime: number;
  shortfallDeduction: number;
  ytdShortfallDeduction: number;
  leaveDeduction: number;
  ytdLeaveDeduction: number;
  earlyCheckoutMinutes: number;
  earlyCheckoutDeduction: number;
  ytdEarlyCheckoutDeduction: number;
  bondSecurity: number;
  bondSecurityPercent: number;
  ytdBondSecurity: number;
  tds: number;
  ytdTds: number;
  customEarnings: { label: string; amount: number; ytd: number }[];
  customDeductions: { label: string; amount: number; ytd: number }[];
  /** Optional totals from API (also recomputed live when editing). */
  ytdGrossEarnings?: number;
  ytdTotalDeductions?: number;
  ytdNetPay?: number;
  /** Hours / rate breakdown for amount calculation */
  targetHours: number;
  countedHours: number;
  overtimeHours: number;
  shortfallHours: number;
  hourlyRate: number;
  overtimeRate: number;
  shortfallRate: number;
};

export const resolveCompanyKeyFromForm = (
  form: Pick<SalarySlipFormData, 'companyKey' | 'companyName'>
): SalaryCompanyKey => {
  if (form.companyKey && form.companyKey in SALARY_COMPANIES) return form.companyKey;
  if ((form.companyName || '').toLowerCase().includes('ondial')) return 'ondial';
  return 'kriraai';
};

/** Apply KriraAI / Ondial branding onto payslip form fields */
export const applyCompanyToForm = (
  form: SalarySlipFormData,
  companyKey: SalaryCompanyKey
): SalarySlipFormData => {
  const company = SALARY_COMPANIES[companyKey];
  return {
    ...form,
    companyKey,
    companyName: company.companyName,
    companyAddress: company.companyAddress,
  };
};

export const calculateGrossEarnings = (form: SalarySlipFormData) =>
  form.basic +
  form.overtime +
  (form.customEarnings || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

export const calculateTotalDeductions = (form: SalarySlipFormData) =>
  form.shortfallDeduction +
  form.leaveDeduction +
  form.earlyCheckoutDeduction +
  form.bondSecurity +
  form.tds +
  (form.customDeductions || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

export const calculateNetPay = (form: SalarySlipFormData) =>
  calculateGrossEarnings(form) - calculateTotalDeductions(form);

/** YTD gross from line YTDs (keeps in sync while HR edits amounts). */
export const calculateYtdGrossEarnings = (form: SalarySlipFormData) =>
  Number(form.ytdBasic || 0) +
  Number(form.ytdOvertime || 0) +
  (form.customEarnings || []).reduce((sum, item) => sum + (Number(item.ytd) || 0), 0);

export const calculateYtdTotalDeductions = (form: SalarySlipFormData) =>
  Number(form.ytdShortfallDeduction || 0) +
  Number(form.ytdLeaveDeduction || 0) +
  Number(form.ytdEarlyCheckoutDeduction || 0) +
  Number(form.ytdBondSecurity || 0) +
  Number(form.ytdTds || 0) +
  (form.customDeductions || []).reduce((sum, item) => sum + (Number(item.ytd) || 0), 0);

export const slipDailyRate = (form: Pick<SalarySlipFormData, 'basic' | 'workingDays' | 'paidDays' | 'lopDays'>) => {
  const days =
    Number(form.workingDays) ||
    Number(form.paidDays) + Number(form.lopDays) ||
    0;
  return days > 0 ? Number(form.basic) / days : 0;
};

/** LOP days → leave deduction amount (per-day rate × unpaid days). Approved leave is display-only. */
export const applyLopDays = (form: SalarySlipFormData, lopDays: number): SalarySlipFormData => {
  const days = Math.max(0, Number(lopDays) || 0);
  const workingDays = Number(form.workingDays) || Number(form.paidDays) + Number(form.lopDays) || 0;
  const amount = Math.round(days * slipDailyRate({ ...form, lopDays: days, workingDays }) * 100) / 100;
  const next = patchYtd({ ...form, workingDays }, 'leaveDeduction', 'ytdLeaveDeduction', amount);
  return {
    ...next,
    lopDays: days,
    paidDays: workingDays > 0 ? Math.max(0, Math.round((workingDays - days) * 100) / 100) : form.paidDays,
  };
};

function patchYtd(
  form: SalarySlipFormData,
  field: 'leaveDeduction',
  ytdField: 'ytdLeaveDeduction',
  next: number
): SalarySlipFormData {
  const prev = Number(form[field]) || 0;
  const prevYtd = Number(form[ytdField]) || 0;
  return { ...form, [field]: next, [ytdField]: Math.round((prevYtd - prev + next) * 100) / 100 };
}

export const formatSlipAmount = (value: number, withSymbol = false) => {
  if (!Number.isFinite(value)) return withSymbol ? '₹0.00' : '0.00';
  const formatted = value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `₹${formatted}` : formatted;
};

/** Decimal hours → H:MM:SS for payslip breakdown */
export const formatSlipHours = (n?: number) => {
  if (n == null || Number.isNaN(n)) return '0:00:00';
  const totalSec = Math.round(Math.abs(n) * 3600);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}`;
};

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigitWords = (n: number): string => {
  if (n < 20) return ones[n];
  return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`.trim();
};

const threeDigitWords = (n: number): string => {
  if (n === 0) return '';
  if (n < 100) return twoDigitWords(n);
  return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigitWords(n % 100)}` : ''}`.trim();
};

const indianNumberWords = (n: number): string => {
  if (n === 0) return '';
  if (n < 1000) return threeDigitWords(n);
  if (n < 100000) {
    const thousands = Math.floor(n / 1000);
    const remainder = n % 1000;
    return `${threeDigitWords(thousands)} Thousand${remainder ? ` ${indianNumberWords(remainder)}` : ''}`.trim();
  }
  if (n < 10000000) {
    const lakhs = Math.floor(n / 100000);
    const remainder = n % 100000;
    return `${threeDigitWords(lakhs)} Lakh${remainder ? ` ${indianNumberWords(remainder)}` : ''}`.trim();
  }
  const crores = Math.floor(n / 10000000);
  const remainder = n % 10000000;
  return `${threeDigitWords(crores)} Crore${remainder ? ` ${indianNumberWords(remainder)}` : ''}`.trim();
};

export const amountToWords = (amount: number): string => {
  if (!Number.isFinite(amount) || amount <= 0) return 'Indian Rupee Zero Only';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = `Indian Rupee ${indianNumberWords(rupees)}`;
  if (paise > 0) words += ` and ${indianNumberWords(paise)} Paise`;
  return `${words} Only`;
};

export const getSalaryPdfFilename = (form: SalarySlipFormData) => {
  const company = SALARY_COMPANIES[resolveCompanyKeyFromForm(form)];
  const monthLabel = MONTH_NAMES[form.month - 1] || form.month;
  const safeName = (form.empName || 'Employee')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  return `SALARYSLIP ${company.pdfPrefix} ${safeName} ${monthLabel} ${form.year}.pdf`;
};

/** Map API payslip payload → form */
export const apiPayslipToForm = (p: Partial<SalarySlipFormData> & Record<string, unknown>): SalarySlipFormData => {
  const companyKey = resolveCompanyKeyFromForm({
    companyKey: p.companyKey as SalaryCompanyKey | undefined,
    companyName: String(p.companyName || ''),
  });
  const company = SALARY_COMPANIES[companyKey];
  const basic = Number(p.basic) || 0;
  const overtime = Number(p.overtime) || 0;
  const shortfallDeduction = Number(p.shortfallDeduction) || 0;
  const targetHours = Number(p.targetHours ?? (p.hours as { target?: number } | undefined)?.target) || 0;
  const countedHours = Number(p.countedHours ?? (p.hours as { counted?: number } | undefined)?.counted) || 0;
  const overtimeHours = Number(p.overtimeHours ?? (p.hours as { overtime?: number } | undefined)?.overtime) || 0;
  const shortfallHours = Number(p.shortfallHours ?? (p.hours as { shortfall?: number } | undefined)?.shortfall) || 0;
  const hourlyRate =
    Number(p.hourlyRate) || (targetHours > 0 ? Math.round((basic / targetHours) * 100) / 100 : 0);
  const overtimeRate =
    Number(p.overtimeRate) ||
    (overtimeHours > 0
      ? Math.round((overtime / overtimeHours) * 100) / 100
      : Math.round(hourlyRate * 1.5 * 100) / 100);
  const shortfallRate =
    Number(p.shortfallRate) ||
    (shortfallHours > 0 ? Math.round((shortfallDeduction / shortfallHours) * 100) / 100 : hourlyRate);

  return {
    companyKey,
    companyName: String(p.companyName || company.companyName),
    companyAddress: String(p.companyAddress || company.companyAddress),
    empName: String(p.empName || ''),
    empNo: String(p.empNo || ''),
    designation: String(p.designation || ''),
    doj: String(p.doj || '—'),
    payDate: String(p.payDate || ''),
    pfNo: String(p.pfNo || 'NA'),
    uan: String(p.uan || 'NA'),
    paidDays: Number(p.paidDays) || 0,
    leaveDays: Number(p.leaveDays) || 0,
    lopDays: Number(p.lopDays) || 0,
    workingDays: Number(p.workingDays) || 0,
    month: Number(p.month) || 1,
    year: Number(p.year) || 2026,
    basic,
    ytdBasic: Number(p.ytdBasic) || 0,
    overtime,
    ytdOvertime: Number(p.ytdOvertime) || 0,
    shortfallDeduction,
    ytdShortfallDeduction: Number(p.ytdShortfallDeduction) || 0,
    leaveDeduction: Number(p.leaveDeduction) || 0,
    ytdLeaveDeduction: Number(p.ytdLeaveDeduction) || 0,
    earlyCheckoutMinutes: Number(p.earlyCheckoutMinutes) || 0,
    earlyCheckoutDeduction: Number(p.earlyCheckoutDeduction) || 0,
    ytdEarlyCheckoutDeduction: Number(p.ytdEarlyCheckoutDeduction) || 0,
    bondSecurity: Number(p.bondSecurity) || 0,
    bondSecurityPercent: Number(p.bondSecurityPercent) || 0,
    ytdBondSecurity: Number(p.ytdBondSecurity) || 0,
    tds: Number(p.tds) || 0,
    ytdTds: Number(p.ytdTds) || 0,
    customEarnings: Array.isArray(p.customEarnings)
      ? p.customEarnings.map((item) => ({
          label: String(item.label || ''),
          amount: Number(item.amount) || 0,
          ytd: item.ytd != null && Number.isFinite(Number(item.ytd))
            ? Number(item.ytd)
            : Number(item.amount) || 0,
        }))
      : [],
    customDeductions: Array.isArray(p.customDeductions)
      ? p.customDeductions.map((item) => ({
          label: String(item.label || ''),
          amount: Number(item.amount) || 0,
          ytd: item.ytd != null && Number.isFinite(Number(item.ytd))
            ? Number(item.ytd)
            : Number(item.amount) || 0,
        }))
      : [],
    ytdGrossEarnings: Number(p.ytdGrossEarnings) || 0,
    ytdTotalDeductions: Number(p.ytdTotalDeductions) || 0,
    ytdNetPay: Number(p.ytdNetPay) || 0,
    targetHours,
    countedHours,
    overtimeHours,
    shortfallHours,
    hourlyRate,
    overtimeRate,
    shortfallRate,
  };
};

export const formToAdjustPayload = (form: SalarySlipFormData) => ({
  pay_date: form.payDate,
  pf_no: form.pfNo,
  uan: form.uan,
  tds: form.tds,
  paid_days: form.paidDays,
  leave_days: form.leaveDays,
  lop_days: form.lopDays,
  base_salary: form.basic,
  overtime_amount: form.overtime,
  overtime_hours: form.overtimeHours,
  deduction_amount: form.shortfallDeduction,
  leave_deduction_amount: form.leaveDeduction,
  early_checkout_deduction_amount: form.earlyCheckoutDeduction,
  bond_security_deduction: form.bondSecurity,
  bond_security_percent: form.bondSecurityPercent,
  custom_earnings: (form.customEarnings || []).map((item) => ({ label: item.label, amount: item.amount })),
  custom_deductions: (form.customDeductions || []).map((item) => ({ label: item.label, amount: item.amount })),
});
