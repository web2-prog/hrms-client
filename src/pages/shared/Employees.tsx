import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmClearData } from '../../components/ConfirmClearData';
import { BondSalaryManager } from '../../components/BondSalaryManager';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Dept = { _id: string; name: string };
type Emp = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  employee_id?: string;
  department_id?: Dept;
  has_custom_shift?: boolean;
  custom_shift_start?: string | null;
};

export function EmployeesPage({ basePath }: { basePath: string }) {
  const list = useListParams();
  const { user } = useAuth();
  const [data, setData] = useState<Emp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        department_id: list.get('department_id'),
        role: list.get('role'),
        status: list.get('status'),
      });
      const res = await api<ListResult<Emp>>(`/employees${q}`);
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
    api<ListResult<Dept>>('/departments?limit=50').then((r) => setDepts(r.data)).catch(() => {});
  }, []);

  return (
    <>
      <ListingPage
        title="Employees"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <>
            <select className="select" style={{ width: 150 }} value={list.get('department_id')} onChange={(e) => list.setFilter('department_id', e.target.value)}>
              <option value="">All depts</option>
              {depts.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
            <select className="select" style={{ width: 120 }} value={list.get('role')} onChange={(e) => list.setFilter('role', e.target.value)}>
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="hr">HR</option>
              <option value="employee">Employee</option>
            </select>
            <select className="select" style={{ width: 120 }} value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </>
        }
        actions={
          <Button onClick={() => setShowAdd(true)}>Add Employee</Button>
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e._id}>
                  <td>{e.employee_id}</td>
                  <td>{e.name}</td>
                  <td>{e.email}</td>
                  <td>{e.department_id?.name || '—'}</td>
                  <td>{e.role}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td><Button asChild variant="outline"><Link to={`${basePath}/employees/${e._id}`}>Manage</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>
      {showAdd && (
        <AddEmployeeModal
          depts={depts}
          canSetRole={user?.role === 'admin'}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </>
  );
}

function AddEmployeeModal({ depts, canSetRole, onClose, onSaved }: { depts: Dept[]; canSetRole: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', department_id: '', role: 'employee', joining_date: '', base_salary: '40000', password: 'Welcome@123' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>
        <div className="form-grid">
          {(['name', 'email', 'phone'] as const).map((k) => (
            <div key={k}>
              <label className="label">{k}</label>
              <input className="input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <div>
            <label className="label">Department</label>
            <select className="select" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Select</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          {canSetRole && (
            <div>
              <label className="label">Role</label>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
          <div>
            <label className="label">Joining date</label>
            <input className="input" type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Base salary</label>
            <input className="input" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
          </div>
        </div>
        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await api('/employees', {
                  method: 'POST',
                  body: { ...form, base_salary: Number(form.base_salary) },
                });
                onSaved();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeManagePage({ basePath }: { basePath: string }) {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [emp, setEmp] = useState<any>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [useDefault, setUseDefault] = useState(true);
  const [offerMsg, setOfferMsg] = useState('');
  const [offerErr, setOfferErr] = useState('');
  const [uploadingOffer, setUploadingOffer] = useState(false);

  const load = () => api(`/employees/${id}`).then((e: any) => {
    const bonds = Array.isArray(e.bonds) && e.bonds.length
      ? e.bonds
      : (e.bond_details?.bond_start_date || e.bond_details?.bond_status)
        ? [{
            type: 'Job',
            start_date: e.bond_details.bond_start_date,
            end_date: e.bond_details.bond_end_date,
            period_months: 12,
            amount: e.bond_details.bond_amount || 0,
            status: e.bond_details.bond_status || 'Active',
            notes: '',
          }]
        : [];
    setEmp({
      ...e,
      bonds,
      salary_schedule: Array.isArray(e.salary_schedule) ? e.salary_schedule : [],
    });
    setUseDefault(!(e.custom_shift_start || e.custom_shift_end || e.custom_working_hours_per_day != null));
  });

  useEffect(() => { load(); }, [id]);

  if (!emp) return <div className="state-box">Loading…</div>;

  const set = (path: string, value: unknown) => {
    setEmp((prev: any) => {
      const next = { ...prev };
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...(cur[parts[i]] || {}) };
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <Link to={`${basePath}/employees`}>← Back</Link>
          <h1>{emp.name}</h1>
          <div style={{ color: 'var(--muted)' }}>{emp.employee_id} · {emp.email}</div>
        </div>
        {user?.role === 'admin' && (
          <Button variant="destructive" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setClearOpen(true)}>Clear Data</Button>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Basic</h3>
        <div className="form-grid">
          <div><label className="label">Name</label><input className="input" value={emp.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" value={emp.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label">Status</label>
            <select className="select" value={emp.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div>
            <label className="label">Base salary (current)</label>
            <input className="input" type="number" value={emp.base_salary || 0} onChange={(e) => set('base_salary', Number(e.target.value))} />
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0.35rem 0 0' }}>
              Auto-updated from the active salary schedule band when you save.
            </p>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Shift Timing</h3>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input type="checkbox" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} />
          Use department default
        </label>
        {!useDefault && (
          <div className="form-grid">
            <div><label className="label">Custom start</label><input className="input" value={emp.custom_shift_start || ''} onChange={(e) => set('custom_shift_start', e.target.value)} placeholder="09:00" /></div>
            <div><label className="label">Custom end</label><input className="input" value={emp.custom_shift_end || ''} onChange={(e) => set('custom_shift_end', e.target.value)} placeholder="18:00" /></div>
            <div><label className="label">Hours/day</label><input className="input" type="number" step="0.25" value={emp.custom_working_hours_per_day ?? ''} onChange={(e) => set('custom_working_hours_per_day', e.target.value === '' ? null : Number(e.target.value))} /></div>
          </div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Profile Details</h3>
        <div className="form-grid">
          <div>
            <label className="label">Address</label>
            <input className="input" value={emp.profile_details?.address || ''} onChange={(e) => set('profile_details.address', e.target.value)} />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input className="input" type="date" value={(emp.profile_details?.dob || '').toString().slice(0, 10)} onChange={(e) => set('profile_details.dob', e.target.value || null)} />
          </div>
          <div>
            <label className="label">Marital status</label>
            <select className="select" value={emp.profile_details?.marital_status || ''} onChange={(e) => set('profile_details.marital_status', e.target.value)}>
              <option value="">Select</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Personal email</label>
            <input className="input" type="email" value={emp.profile_details?.personal_email || ''} onChange={(e) => set('profile_details.personal_email', e.target.value)} />
          </div>
          <div>
            <label className="label">Emergency contact</label>
            <input className="input" value={emp.profile_details?.emergency_contact || ''} onChange={(e) => set('profile_details.emergency_contact', e.target.value)} placeholder="Name (phone)" />
          </div>
          <div>
            <label className="label">Aadhaar number</label>
            <input className="input" value={emp.profile_details?.aadhaar_number || ''} onChange={(e) => set('profile_details.aadhaar_number', e.target.value)} />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Bank Details</h3>
        <div className="form-grid">
          {(
            [
              ['bank_name', 'Bank name'],
              ['account_holder_name', 'Account holder'],
              ['account_number', 'Account number'],
              ['ifsc_code', 'IFSC code'],
              ['tax_id', 'Tax ID / PAN'],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input className="input" value={emp.bank_details?.[k] || ''} onChange={(e) => set(`bank_details.${k}`, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Offer Letter</h3>
        {emp.offer_letter_url ? (
          <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>
            Current file: <strong style={{ color: 'var(--text)' }}>{emp.offer_letter_name || 'Offer letter'}</strong>
          </p>
        ) : (
          <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>No offer letter uploaded yet.</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {emp.offer_letter_url && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  setOfferErr('');
                  const blob = await api<Blob>(`/employees/${id}/offer-letter`);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = emp.offer_letter_name || `Offer-Letter-${emp.employee_id || id}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  setOfferErr(e instanceof Error ? e.message : 'Download failed');
                }
              }}
            >
              Download
            </Button>
          )}
          {user?.role === 'admin' && (
            <>
              <label className="btn" style={{ cursor: uploadingOffer ? 'wait' : 'pointer', margin: 0 }}>
                {uploadingOffer ? 'Uploading…' : emp.offer_letter_url ? 'Replace file' : 'Upload offer letter'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf"
                  hidden
                  disabled={uploadingOffer}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingOffer(true);
                    setOfferErr('');
                    setOfferMsg('');
                    try {
                      const fd = new FormData();
                      fd.append('offer_letter', file);
                      const updated = await api<any>(`/employees/${id}/offer-letter`, { method: 'POST', formData: fd });
                      setEmp((prev: any) => ({
                        ...prev,
                        offer_letter_url: updated.offer_letter_url,
                        offer_letter_name: updated.offer_letter_name,
                      }));
                      setOfferMsg('Offer letter uploaded');
                    } catch (err) {
                      setOfferErr(err instanceof Error ? err.message : 'Upload failed');
                    } finally {
                      setUploadingOffer(false);
                    }
                  }}
                />
              </label>
              {emp.offer_letter_url && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm('Remove offer letter for this employee?')) return;
                    try {
                      setOfferErr('');
                      await api(`/employees/${id}/offer-letter`, { method: 'DELETE' });
                      setEmp((prev: any) => ({ ...prev, offer_letter_url: '', offer_letter_name: '' }));
                      setOfferMsg('Offer letter removed');
                    } catch (err) {
                      setOfferErr(err instanceof Error ? err.message : 'Remove failed');
                    }
                  }}
                >
                  Remove
                </Button>
              )}
            </>
          )}
        </div>
        {offerMsg && <p style={{ color: 'var(--success)', marginTop: 8 }}>{offerMsg}</p>}
        {offerErr && <p style={{ color: 'var(--error)', marginTop: 8 }}>{offerErr}</p>}
        {user?.role === 'admin' && (
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '8px 0 0' }}>
            Allowed: PDF, Word, JPG, PNG (max 10 MB). Employees can download from their profile.
          </p>
        )}
      </div>
      <BondSalaryManager
        bonds={emp.bonds || []}
        salarySchedule={emp.salary_schedule || []}
        baseSalary={emp.base_salary || 0}
        onChange={({ bonds, salary_schedule, base_salary }) => {
          setEmp((prev: any) => ({
            ...prev,
            bonds,
            salary_schedule,
            ...(base_salary != null ? { base_salary } : {}),
          }));
        }}
      />
      {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      <Button
        onClick={async () => {
          const body: any = {
            name: emp.name,
            phone: emp.phone,
            status: emp.status,
            base_salary: emp.base_salary,
            profile_details: emp.profile_details,
            bank_details: emp.bank_details,
            bonds: emp.bonds || [],
            salary_schedule: emp.salary_schedule || [],
            use_department_default: useDefault,
          };
          if (!useDefault) {
            body.custom_shift_start = emp.custom_shift_start;
            body.custom_shift_end = emp.custom_shift_end;
            body.custom_working_hours_per_day = emp.custom_working_hours_per_day;
          }
          await api(`/employees/${id}`, { method: 'PUT', body });
          setMsg('Saved');
          load();
        }}
      >
        Save changes
      </Button>
      <ConfirmClearData
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={async (start, end) => {
          await api(`/employees/${id}/clear-data`, { method: 'POST', body: { start_date: start, end_date: end } });
          setMsg('Data cleared for range');
        }}
      />
    </div>
  );
}
