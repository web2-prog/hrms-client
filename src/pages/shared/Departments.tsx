import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Building2, Clock3, Pencil, Plus, Timer, Trash2, Users } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, RequireRole } from '../../components/StatusBadge';
import { displayClock, formatClockInput, to24HourClock } from '../../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Dept = {
  _id: string;
  name: string;
  working_hours_per_day: number;
  shift_start: string;
  shift_end: string;
  late_buffer_minutes: number;
  status: string;
  members?: number;
  active_members?: number;
};

type DeptAnalytics = {
  department_id: string;
  employee_count: number;
  attendance_days: number;
  total_working_hours: number;
  late_checkin_count: number;
  early_checkout_count: number;
  penalty_minutes: number;
};

/** Soft-tinted monogram palette — deterministic per department name. */
const DEPT_TONES = [
  'dept-tone-0',
  'dept-tone-1',
  'dept-tone-2',
  'dept-tone-3',
  'dept-tone-4',
  'dept-tone-5',
] as const;

function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DEPT_TONES[h % DEPT_TONES.length];
}

function initials(name: string) {
  const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

function fmtHours(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n} hrs/day`;
}

function memberLabel(n?: number) {
  if (n == null) return null;
  return `${n} ${n === 1 ? 'member' : 'members'}`;
}

/** Decimal hours → compact "8h 24m" */
function fmtAvgHours(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  const totalMin = Math.round(Number(n) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function onTimePct(an: DeptAnalytics) {
  if (!an.attendance_days) return 100;
  return Math.round((100 * (an.attendance_days - an.late_checkin_count)) / an.attendance_days);
}

function punctualityTone(an: DeptAnalytics): 'good' | 'mid' | 'low' {
  const p = onTimePct(an);
  if (p >= 95) return 'good';
  if (p >= 85) return 'mid';
  return 'low';
}

export default function DepartmentsPage() {
  return (
    <RequireRole roles={['admin', 'hr']}>
      <DepartmentsInner />
    </RequireRole>
  );
}

function DepartmentsInner() {
  const list = useListParams();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/hr') ? '/hr' : '/admin';

  const [data, setData] = useState<Dept[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Dept> | null>(null);
  const [deleting, setDeleting] = useState<Dept | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [deleteErr, setDeleteErr] = useState('');

  // Overall snapshot for the summary strip (independent of search/pagination).
  const [snapshot, setSnapshot] = useState<Dept[] | null>(null);

  // Per-department attendance analytics for the current year.
  const year = new Date().getFullYear();
  const [analytics, setAnalytics] = useState<Map<string, DeptAnalytics> | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({ page: list.page, limit: list.limit, search: list.search, status: list.get('status') });
      const res = await api<ListResult<Dept>>(`/departments${q}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshot = async () => {
    try {
      const res = await api<ListResult<Dept>>('/departments?limit=100');
      setSnapshot(res.data);
    } catch {
      setSnapshot(null);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await api<{ year: number; departments: DeptAnalytics[] }>(`/departments/analytics?year=${year}`);
      setAnalytics(new Map(res.departments.map((d) => [d.department_id, d])));
    } catch {
      setAnalytics(null);
    }
  };

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);

  useEffect(() => { loadSnapshot(); }, []);

  useEffect(() => { loadAnalytics(); }, [year]);

  const active = snapshot ? snapshot.filter((d) => d.status === 'active').length : 0;
  const totalMembers = snapshot ? snapshot.reduce((sum, d) => sum + (d.members || 0), 0) : 0;

  const save = async () => {
    if (!editing || !editing.name?.trim()) return;
    setSaving(true);
    setFormErr('');
    try {
      const body = {
        ...editing,
        name: editing.name.trim(),
        shift_start: to24HourClock(editing.shift_start) || editing.shift_start,
        shift_end: to24HourClock(editing.shift_end) || editing.shift_end,
      };
      if (editing._id) await api(`/departments/${editing._id}`, { method: 'PUT', body });
      else await api('/departments', { method: 'POST', body });
      setEditing(null);
      load();
      loadSnapshot();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteErr('');
    try {
      await api(`/departments/${deleting._id}`, { method: 'DELETE' });
      setDeleting(null);
      load();
      loadSnapshot();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <ListingPage
        title="Departments"
        subtitle="Manage teams, working hours and shift schedules"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        prepend={
          snapshot && (
            <div className="page-stats">
              <div className="card emp-stat card-accent">
                <div className="stat-card">
                  <span className="stat-icon blue"><Building2 size={20} /></span>
                  <div>
                    <span className="label">Departments</span>
                    <div className="emp-stat-value">{snapshot.length}</div>
                    <span className="emp-stat-hint">Across the organisation</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent teal">
                <div className="stat-card">
                  <span className="stat-icon teal"><Users size={20} /></span>
                  <div>
                    <span className="label">Active teams</span>
                    <div className="emp-stat-value">{active}</div>
                    <span className="emp-stat-hint">Running on schedule</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent amber">
                <div className="stat-card">
                  <span className="stat-icon amber"><Timer size={20} /></span>
                  <div>
                    <span className="label">Inactive</span>
                    <div className="emp-stat-value">{snapshot.length - active}</div>
                    <span className="emp-stat-hint">Paused teams</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent violet">
                <div className="stat-card">
                  <span className="stat-icon violet"><Clock3 size={20} /></span>
                  <div>
                    <span className="label">Total members</span>
                    <div className="emp-stat-value">{totalMembers}</div>
                    <span className="emp-stat-hint">Assigned to teams</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        typeFilters={
          <select className="select" value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        }
        actions={
          <Button onClick={() => {
            setFormErr('');
            setEditing({
              name: '',
              working_hours_per_day: 8.25,
              shift_start: '9:15 AM',
              shift_end: '5:30 PM',
              late_buffer_minutes: 5,
              status: 'active',
            });
          }}>
            <Plus size={16} />
            Add Department
          </Button>
        }
      >
        <div className="dept-grid">
          {data.map((d) => {
            const tone = toneFor(d.name);
            const members = memberLabel(d.members);
            const an = analytics?.get(d._id);
            return (
              <div className="dept-card" key={d._id}>
                <div className="dept-card-head">
                  <span className={`dept-tile ${tone}`}>{initials(d.name)}</span>
                  <div className="dept-card-title">
                    <h3>{d.name}</h3>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="dept-card-actions">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="dept-card-action"
                      title="Edit department"
                      onClick={() => {
                        setFormErr('');
                        setEditing({
                          ...d,
                          shift_start: formatClockInput(d.shift_start),
                          shift_end: formatClockInput(d.shift_end),
                        });
                      }}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="dept-card-action danger"
                      title="Delete department"
                      onClick={() => {
                        setDeleteErr('');
                        setDeleting(d);
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                <div className="dept-meta">
                  <div className={`dept-meta-row${members == null || d.members === 0 ? ' is-muted' : ''}`}>
                    <Users size={15} />
                    <span>{members == null || d.members === 0 ? 'No members yet' : members}</span>
                  </div>
                  <div className="dept-meta-row">
                    <Clock3 size={15} />
                    <span>{displayClock(d.shift_start)} – {displayClock(d.shift_end)}</span>
                  </div>
                  <div className="dept-meta-row">
                    <Timer size={15} />
                    <span>{fmtHours(d.working_hours_per_day)}</span>
                  </div>
                  <div className="dept-meta-row">
                    <Clock3 size={15} />
                    <span>{d.late_buffer_minutes ?? 5}m late buffer</span>
                  </div>
                </div>

                {analytics && (
                  <div className="dept-analytics">
                    {an && an.attendance_days > 0 ? (
                      <>
                        <div className="dept-an-item">
                          <span className="label">Avg / day</span>
                          <strong className="dept-an-value">{fmtAvgHours(an.total_working_hours / an.attendance_days)}</strong>
                          <span className="dept-an-hint">{an.attendance_days} tracked days</span>
                        </div>
                        <div className="dept-an-item">
                          <span className="label">On time</span>
                          <strong className={`dept-an-value is-${punctualityTone(an)}`}>{onTimePct(an)}%</strong>
                          <span className="dept-an-hint">{an.late_checkin_count} late check-ins</span>
                        </div>
                      </>
                    ) : (
                      <span className="dept-an-empty">No tracked attendance for {year}</span>
                    )}
                  </div>
                )}

                <div className="dept-card-foot">
                  <Link to={`${basePath}/employees?department_id=${d._id}`}>
                    View team
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </ListingPage>

      <Dialog open={!!editing} onOpenChange={(o) => !o && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing?._id ? 'Edit' : 'Add'} Department</DialogTitle>
            <DialogDescription>
              Departments set the default working hours and shift window for everyone assigned to them.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="dept-name">Name</Label>
                <Input
                  id="dept-name"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Engineering"
                  autoFocus
                />
              </div>
              <div className="form-grid">
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-hours">Hours / day</Label>
                  <Input
                    id="dept-hours"
                    type="number"
                    step="0.25"
                    min="0.5"
                    value={editing.working_hours_per_day ?? 8}
                    onChange={(e) => setEditing({ ...editing, working_hours_per_day: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-status">Status</Label>
                  <select
                    className="select"
                    value={editing.status || 'active'}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-start">Shift start</Label>
                  <Input
                    id="dept-start"
                    value={editing.shift_start || ''}
                    onChange={(e) => setEditing({ ...editing, shift_start: e.target.value })}
                    placeholder="9:15 AM"
                  />
                  <p className="field-hint">12-hour format, e.g. 9:15 AM</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-end">Shift end</Label>
                  <Input
                    id="dept-end"
                    value={editing.shift_end || ''}
                    onChange={(e) => setEditing({ ...editing, shift_end: e.target.value })}
                    placeholder="5:30 PM"
                  />
                  <p className="field-hint">12-hour format, e.g. 5:30 PM</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-late-buffer">Late buffer (minutes)</Label>
                  <Input
                    id="dept-late-buffer"
                    type="number"
                    min="0"
                    max="240"
                    step="1"
                    value={editing.late_buffer_minutes ?? 5}
                    onChange={(e) => setEditing({
                      ...editing,
                      late_buffer_minutes: Math.max(0, Math.min(240, Math.floor(Number(e.target.value) || 0))),
                    })}
                  />
                  <p className="field-hint">Inclusive: a 5m buffer permits check-in through 5 minutes after shift start.</p>
                </div>
              </div>
              {formErr && <p className="form-error">{formErr}</p>}
              <DialogFooter>
                <Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
                <Button disabled={saving || !editing.name?.trim()} onClick={save}>
                  {saving ? 'Saving…' : editing._id ? 'Save changes' : 'Create department'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && !deleteBusy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete department?</DialogTitle>
            <DialogDescription>
              <strong>{deleting?.name}</strong> will be removed from the department list. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteErr && <p className="form-error">{deleteErr}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={confirmDelete}>
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
