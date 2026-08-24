import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListPagination, PAGE_SIZE } from './ListingPage';
import { NumberInput } from './NumberInput';

export type Bond = {
  _id?: string;
  type?: string;
  start_date?: string | null;
  end_date?: string | null;
  period_months?: number;
  amount?: number;
  status?: string;
  notes?: string;
  /** marksheet_12th | salary_deduction */
  proof_type?: string;
  /** Held | Returned — company returns proof after bond */
  proof_status?: string;
  proof_returned_date?: string | null;
  salary_deduction_percent?: number;
};

export const PROOF_OPTIONS = [
  { value: 'marksheet_12th', label: '12th Marksheet' },
  { value: 'salary_deduction', label: 'Salary deduction (15%/month)' },
] as const;

export function proofLabel(type?: string) {
  if (type === 'marksheet_12th') return '12th Marksheet';
  if (type === 'salary_deduction') return 'Salary deduction (15%/month)';
  return '—';
}

export type SalaryBand = {
  start_date?: string | null;
  end_date?: string | null;
  monthly_salary?: number;
  label?: string;
  step_index?: number;
};

function isoDay(v?: string | Date | null) {
  if (!v) return '';
  return String(v).slice(0, 10);
}

function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function dayBefore(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function generateSalaryScheduleClient(opts: {
  start_date: string;
  period_months: number;
  starting_salary: number;
  increment_every_months: number;
  increment_amount: number;
  increment_percent?: number;
}): SalaryBand[] {
  const start = opts.start_date;
  const period = Math.max(1, opts.period_months || 12);
  const every = Math.max(1, opts.increment_every_months || period);
  let salary = Number(opts.starting_salary) || 0;
  const entries: SalaryBand[] = [];
  let cursor = 0;
  let step = 0;
  while (cursor < period) {
    const chunk = Math.min(every, period - cursor);
    const segStart = addMonths(start, cursor);
    const nextStart = addMonths(start, cursor + chunk);
    entries.push({
      start_date: segStart,
      end_date: dayBefore(nextStart),
      monthly_salary: Math.round(salary * 100) / 100,
      label: `Months ${cursor + 1}–${cursor + chunk}`,
      step_index: step,
    });
    cursor += chunk;
    step += 1;
    if (opts.increment_amount) salary += Number(opts.increment_amount);
    else if (opts.increment_percent) salary *= 1 + Number(opts.increment_percent) / 100;
  }
  return entries;
}

function money(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

type Props = {
  bonds: Bond[];
  salarySchedule: SalaryBand[];
  baseSalary: number;
  onChange: (next: { bonds: Bond[]; salary_schedule: SalaryBand[]; base_salary?: number }) => void;
};

export function BondSalaryManager({ bonds, salarySchedule, baseSalary, onChange }: Props) {
  const [showAddBond, setShowAddBond] = useState(false);
  const [schedulePage, setSchedulePage] = useState(1);
  const [bondForm, setBondForm] = useState({
    type: 'Job',
    start_date: '',
    period_months: '12',
    amount: '',
    status: 'Active',
    notes: '',
    proof_type: 'marksheet_12th',
    salary_deduction_percent: '15',
    starting_salary: String(baseSalary || ''),
    increment_every_months: '3',
    increment_amount: '',
    generate_schedule: true,
  });

  const list = Array.isArray(bonds) ? bonds : [];
  const schedule = Array.isArray(salarySchedule) ? salarySchedule : [];

  const currentBand = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return schedule.find((s) => {
      const from = isoDay(s.start_date);
      const to = isoDay(s.end_date);
      if (!from || from > today) return false;
      if (to && to < today) return false;
      return true;
    });
  }, [schedule]);

  const setBonds = (next: Bond[]) => onChange({ bonds: next, salary_schedule: schedule });
  const setSchedule = (next: SalaryBand[]) => onChange({ bonds: list, salary_schedule: next });

  const schedulePages = Math.max(1, Math.ceil(schedule.length / PAGE_SIZE));
  const schedulePageSafe = Math.min(Math.max(1, schedulePage), schedulePages);
  const scheduleStart = (schedulePageSafe - 1) * PAGE_SIZE;
  const visibleSchedule = schedule.slice(scheduleStart, scheduleStart + PAGE_SIZE);

  useEffect(() => {
    if (schedulePage > schedulePages) setSchedulePage(schedulePages);
  }, [schedule.length, schedulePage, schedulePages]);

  const addBond = () => {
    if (!bondForm.start_date) return;
    const period = Number(bondForm.period_months) || 12;
    const end = dayBefore(addMonths(bondForm.start_date, period));
    const bond: Bond = {
      type: bondForm.type,
      start_date: bondForm.start_date,
      end_date: end,
      period_months: period,
      amount: Number(bondForm.amount) || 0,
      status: bondForm.status,
      notes: bondForm.notes,
      proof_type: bondForm.proof_type,
      proof_status: 'Held',
      proof_returned_date: null,
      salary_deduction_percent:
        bondForm.proof_type === 'salary_deduction' ? Number(bondForm.salary_deduction_percent) || 15 : 15,
    };
    let nextSchedule = schedule;
    if (bondForm.generate_schedule) {
      nextSchedule = generateSalaryScheduleClient({
        start_date: bondForm.start_date,
        period_months: period,
        starting_salary: Number(bondForm.starting_salary) || baseSalary || 0,
        increment_every_months: Number(bondForm.increment_every_months) || 3,
        increment_amount: Number(bondForm.increment_amount) || 0,
      });
    }
    onChange({
      bonds: [...list, bond],
      salary_schedule: nextSchedule,
      base_salary: nextSchedule[0]?.monthly_salary ?? baseSalary,
    });
    setShowAddBond(false);
    setBondForm({
      type: 'Job',
      start_date: '',
      period_months: '12',
      amount: '',
      status: 'Active',
      notes: '',
      proof_type: 'marksheet_12th',
      salary_deduction_percent: '15',
      starting_salary: String(baseSalary || ''),
      increment_every_months: '3',
      increment_amount: '',
      generate_schedule: true,
    });
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Bond details</h3>
          <Button type="button" variant={showAddBond ? 'outline' : 'default'} onClick={() => setShowAddBond((v) => !v)}>
            {showAddBond ? 'Cancel' : '+ Add bond'}
          </Button>
        </div>

        {showAddBond && (
          <div className="bond-add-box">
            <p className="emp-action-help" style={{ marginBottom: 12 }}>
              Joining proof is held by the company and returned after the bond ends (12th marksheet, or 15% salary held monthly).
            </p>
            <div className="form-grid">
              <div>
                <label className="label">Bond type</label>
                <select className="select" value={bondForm.type} onChange={(e) => setBondForm({ ...bondForm, type: e.target.value })}>
                  <option value="Job">Job</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="label">Start date</label>
                <input className="input" type="date" value={bondForm.start_date} onChange={(e) => setBondForm({ ...bondForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Duration (months)</label>
                <input className="input" type="number" min={1} value={bondForm.period_months} onChange={(e) => setBondForm({ ...bondForm, period_months: e.target.value })} />
              </div>
              <div>
                <label className="label">Bond amount</label>
                <NumberInput className="input" min={0} value={bondForm.amount} onChange={(n) => setBondForm({ ...bondForm, amount: n ? String(n) : '' })} />
              </div>
              <div>
                <label className="label">Joining proof</label>
                <select className="select" value={bondForm.proof_type} onChange={(e) => setBondForm({ ...bondForm, proof_type: e.target.value })}>
                  {PROOF_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {bondForm.proof_type === 'salary_deduction' && (
                <div>
                  <label className="label">Deduction %</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={100}
                    value={bondForm.salary_deduction_percent}
                    onChange={(e) => setBondForm({ ...bondForm, salary_deduction_percent: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="label">Status</label>
                <select className="select" value={bondForm.status} onChange={(e) => setBondForm({ ...bondForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Waived">Waived</option>
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={bondForm.notes} onChange={(e) => setBondForm({ ...bondForm, notes: e.target.value })} />
              </div>
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
              <input
                type="checkbox"
                checked={bondForm.generate_schedule}
                onChange={(e) => setBondForm({ ...bondForm, generate_schedule: e.target.checked })}
              />
              Generate salary schedule for this bond
            </label>

            {bondForm.generate_schedule && (
              <div className="form-grid">
                <div>
                  <label className="label">Starting monthly salary</label>
                  <NumberInput className="input" min={0} value={bondForm.starting_salary} onChange={(n) => setBondForm({ ...bondForm, starting_salary: n ? String(n) : '' })} />
                </div>
                <div>
                  <label className="label">Increment every (months)</label>
                  <input className="input" type="number" min={1} value={bondForm.increment_every_months} onChange={(e) => setBondForm({ ...bondForm, increment_every_months: e.target.value })} />
                </div>
                <div>
                  <label className="label">Increment amount (₹)</label>
                  <NumberInput className="input" min={0} value={bondForm.increment_amount} placeholder="e.g. 2000" onChange={(n) => setBondForm({ ...bondForm, increment_amount: n ? String(n) : '' })} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button type="button" onClick={addBond} disabled={!bondForm.start_date}>
                Add bond
              </Button>
            </div>
          </div>
        )}

        {!list.length ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>No bonds yet. Use + Add bond to create one.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Joining proof</th>
                  <th>Proof status</th>
                  <th>Bond status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((b, i) => (
                  <tr key={b._id || i}>
                    <td>
                      <select
                        className="select"
                        value={b.type || 'Job'}
                        onChange={(e) => {
                          const next = [...list];
                          next[i] = { ...b, type: e.target.value };
                          setBonds(next);
                        }}
                      >
                        <option value="Job">Job</option>
                        <option value="Internship">Internship</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        type="date"
                        value={isoDay(b.start_date)}
                        onChange={(e) => {
                          const next = [...list];
                          next[i] = { ...b, start_date: e.target.value };
                          setBonds(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="date"
                        value={isoDay(b.end_date)}
                        onChange={(e) => {
                          const next = [...list];
                          next[i] = { ...b, end_date: e.target.value };
                          setBonds(next);
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="select"
                        value={b.proof_type || ''}
                        onChange={(e) => {
                          const next = [...list];
                          const proof_type = e.target.value;
                          next[i] = {
                            ...b,
                            proof_type,
                            proof_status: proof_type ? b.proof_status || 'Held' : '',
                            salary_deduction_percent:
                              proof_type === 'salary_deduction' ? b.salary_deduction_percent || 15 : b.salary_deduction_percent,
                          };
                          setBonds(next);
                        }}
                      >
                        <option value="">None</option>
                        {PROOF_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {b.proof_type === 'salary_deduction' && (
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={100}
                          style={{ marginTop: 6, width: 90 }}
                          value={b.salary_deduction_percent ?? 15}
                          title="Deduction %"
                          onChange={(e) => {
                            const next = [...list];
                            next[i] = { ...b, salary_deduction_percent: Number(e.target.value) };
                            setBonds(next);
                          }}
                        />
                      )}
                    </td>
                    <td>
                      <select
                        className="select"
                        value={b.proof_status || ''}
                        disabled={!b.proof_type}
                        onChange={(e) => {
                          const next = [...list];
                          const proof_status = e.target.value;
                          next[i] = {
                            ...b,
                            proof_status,
                            proof_returned_date:
                              proof_status === 'Returned'
                                ? new Date().toISOString().slice(0, 10)
                                : null,
                          };
                          setBonds(next);
                        }}
                      >
                        <option value="">—</option>
                        <option value="Held">Held by company</option>
                        <option value="Returned">Returned to employee</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="select"
                        value={b.status || 'Active'}
                        onChange={(e) => {
                          const next = [...list];
                          const status = e.target.value;
                          next[i] = {
                            ...b,
                            status,
                            ...(status === 'Completed' && b.proof_type
                              ? { proof_status: 'Returned', proof_returned_date: new Date().toISOString().slice(0, 10) }
                              : {}),
                          };
                          setBonds(next);
                        }}
                      >
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Waived">Waived</option>
                      </select>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBonds(list.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Salary schedule</h3>
            <p className="emp-action-help" style={{ margin: '4px 0 0' }}>
              Current band: {currentBand ? `${money(currentBand.monthly_salary)} (${currentBand.label || 'Active'})` : money(baseSalary)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSchedule([
                  ...schedule,
                  {
                    start_date: new Date().toISOString().slice(0, 10),
                    end_date: '',
                    monthly_salary: baseSalary || 0,
                    label: `Band ${schedule.length + 1}`,
                    step_index: schedule.length,
                  },
                ]);
                setSchedulePage(Math.ceil((schedule.length + 1) / PAGE_SIZE));
              }}
            >
              + Add salary band
            </Button>
          </div>
        </div>

        {!schedule.length ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            No salary bands. Add a bond with “Generate salary schedule”, or add a band manually.
          </p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Monthly salary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleSchedule.map((s, vi) => {
                  const i = scheduleStart + vi;
                  return (
                  <tr key={i}>
                    <td>
                      <input
                        className="input"
                        value={s.label || ''}
                        onChange={(e) => {
                          const next = [...schedule];
                          next[i] = { ...s, label: e.target.value };
                          setSchedule(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="date"
                        value={isoDay(s.start_date)}
                        onChange={(e) => {
                          const next = [...schedule];
                          next[i] = { ...s, start_date: e.target.value };
                          setSchedule(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="date"
                        value={isoDay(s.end_date)}
                        onChange={(e) => {
                          const next = [...schedule];
                          next[i] = { ...s, end_date: e.target.value };
                          setSchedule(next);
                        }}
                      />
                    </td>
                    <td>
                      <NumberInput
                        className="input"
                        min={0}
                        value={s.monthly_salary ?? 0}
                        onChange={(n) => {
                          const next = [...schedule];
                          next[i] = { ...s, monthly_salary: n };
                          setSchedule(next);
                        }}
                      />
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSchedule(schedule.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination
            total={schedule.length}
            page={schedulePageSafe}
            onPageChange={setSchedulePage}
          />
          </>
        )}
      </div>
    </>
  );
}
