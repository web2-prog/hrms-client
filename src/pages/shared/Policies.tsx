import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleSlash2, FileText, Pencil, Tags, Trash2 } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { displayDateTime } from '../../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CATEGORIES = ['General', 'Attendance', 'Leave', 'Code of Conduct', 'Salary', 'Other'] as const;

type Policy = {
  _id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  effective_date?: string | null;
  createdAt?: string;
  updatedAt?: string;
  created_by?: { name?: string } | null;
  updated_by?: { name?: string } | null;
};

type PolicyForm = {
  _id?: string;
  title: string;
  content: string;
  category: string;
  status: string;
  effective_date: string;
};

const emptyForm = (): PolicyForm => ({
  title: '',
  content: '',
  category: 'General',
  status: 'active',
  effective_date: '',
});

/** Deterministic tint for the policy tile (reuses dept tone palette). */
const TONES = ['dept-tone-0', 'dept-tone-1', 'dept-tone-2', 'dept-tone-3', 'dept-tone-4', 'dept-tone-5'] as const;

function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function PoliciesPage({ canManage = true }: { canManage?: boolean }) {
  const list = useListParams();
  const { user } = useAuth();
  const manage = canManage && user?.role === 'admin';
  const [data, setData] = useState<Policy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PolicyForm | null>(null);
  const [viewing, setViewing] = useState<Policy | null>(null);
  const [deleting, setDeleting] = useState<Policy | null>(null);
  const [saveErr, setSaveErr] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [snapshot, setSnapshot] = useState<Policy[] | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        status: list.get('status'),
        category: list.get('category'),
      });
      const res = await api<ListResult<Policy>>(`/policies${q}`);
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
      const res = await api<ListResult<Policy>>('/policies?limit=100');
      setSnapshot(res.data);
    } catch {
      setSnapshot(null);
    }
  };

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);

  useEffect(() => { loadSnapshot(); }, []);

  const counts = useMemo(() => {
    const c = { total: snapshot?.length ?? 0, active: 0, inactive: 0, categories: new Set<string>() };
    for (const p of snapshot || []) {
      if (p.status === 'active') c.active += 1;
      else c.inactive += 1;
      if (p.category) c.categories.add(p.category);
    }
    return c;
  }, [snapshot]);

  const openEdit = (p?: Policy) => {
    setSaveErr('');
    if (p) {
      setEditing({
        _id: p._id,
        title: p.title,
        content: p.content,
        category: p.category || 'General',
        status: p.status || 'active',
        effective_date: p.effective_date || '',
      });
    } else {
      setEditing(emptyForm());
    }
  };

  const save = async () => {
    if (!editing || !editing.title.trim()) return;
    setSaving(true);
    setSaveErr('');
    try {
      const body = {
        title: editing.title.trim(),
        content: editing.content,
        category: editing.category,
        status: editing.status,
        effective_date: editing.effective_date || null,
      };
      if (editing._id) await api(`/policies/${editing._id}`, { method: 'PUT', body });
      else await api('/policies', { method: 'POST', body });
      setEditing(null);
      load();
      loadSnapshot();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteErr('');
    try {
      await api(`/policies/${deleting._id}`, { method: 'DELETE' });
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
        title="Company Policies"
        subtitle="Company-wide policies, guidelines and code of conduct"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        typeFilters={
          <>
            {manage && (
              <select
                className="select"
                value={list.get('status')}
                onChange={(e) => list.setFilter('status', e.target.value)}
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            )}
            <select
              className="select"
              value={list.get('category')}
              onChange={(e) => list.setFilter('category', e.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        }
        actions={manage ? <Button onClick={() => openEdit()}>Add Policy</Button> : undefined}
        prepend={
          snapshot && (
            <div className="page-stats">
              <div className="card emp-stat card-accent">
                <div className="stat-card">
                  <span className="stat-icon blue"><FileText size={20} /></span>
                  <div>
                    <span className="label">Policies</span>
                    <div className="emp-stat-value">{counts.total}</div>
                    <span className="emp-stat-hint">On record</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent teal">
                <div className="stat-card">
                  <span className="stat-icon teal"><CheckCircle2 size={20} /></span>
                  <div>
                    <span className="label">In effect</span>
                    <div className="emp-stat-value">{counts.active}</div>
                    <span className="emp-stat-hint">Active policies</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent amber">
                <div className="stat-card">
                  <span className="stat-icon amber"><CircleSlash2 size={20} /></span>
                  <div>
                    <span className="label">Inactive</span>
                    <div className="emp-stat-value">{counts.inactive}</div>
                    <span className="emp-stat-hint">Archived or paused</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent violet">
                <div className="stat-card">
                  <span className="stat-icon violet"><Tags size={20} /></span>
                  <div>
                    <span className="label">Categories</span>
                    <div className="emp-stat-value">{counts.categories.size}</div>
                    <span className="emp-stat-hint">Policy areas</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      >
        <div className="pol-grid">
          {data.map((p) => (
            <div className="pol-card" key={p._id}>
              <div className="pol-card-head">
                <span className={`pol-tile ${toneFor(p.title)}`}><FileText size={18} /></span>
                <div className="pol-card-title">
                  <h3>{p.title}</h3>
                  {manage ? <StatusBadge status={p.status} /> : <span className="hol-chip is-neutral">{p.category}</span>}
                </div>
                {manage && (
                  <div className="pol-card-actions">
                    <Button variant="ghost" size="icon-sm" className="dept-card-action" title="Edit policy" onClick={() => openEdit(p)}>
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="dept-card-action danger"
                      title="Delete policy"
                      onClick={() => {
                        setDeleteErr('');
                        setDeleting(p);
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                )}
              </div>

              <p className="pol-excerpt">{p.content}</p>

              <div className="pol-meta">
                {manage && <span className="hol-chip is-neutral">{p.category}</span>}
                <span className="pol-meta-item">
                  <CalendarDays size={13} />
                  Effective {p.effective_date || '—'}
                </span>
                <span className="pol-meta-item">
                  Updated {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="pol-card-foot">
                <button type="button" onClick={() => setViewing(p)}>
                  Read policy
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ListingPage>

      <Dialog open={!!editing} onOpenChange={(o) => !o && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editing?._id ? 'Edit' : 'Add'} Policy</DialogTitle>
            <DialogDescription>
              Policies define the rules every employee is expected to follow.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <>
              <div className="form-grid">
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Title</label>
                  <input
                    className="input"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    placeholder="e.g. Leave Policy 2026"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    className="select"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="select"
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="label">Effective date</label>
                  <input
                    className="input"
                    type="date"
                    value={editing.effective_date}
                    onChange={(e) => setEditing({ ...editing, effective_date: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Policy details</label>
                  <textarea
                    className="textarea"
                    rows={10}
                    value={editing.content}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    placeholder="Write the full company policy details here…"
                  />
                </div>
              </div>
              {saveErr && <p className="form-error">{saveErr}</p>}
              <DialogFooter>
                <Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
                <Button disabled={saving || !editing.title.trim()} onClick={save}>
                  {saving ? 'Saving…' : editing._id ? 'Save changes' : 'Create policy'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              <span className="hol-chip is-neutral">{viewing?.category}</span>{' '}
              {manage && <StatusBadge status={viewing?.status} />}
              {viewing?.effective_date ? ` · Effective ${viewing.effective_date}` : ''}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <>
              <div className="pol-doc">{viewing.content}</div>
              {(viewing.updated_by?.name || viewing.updatedAt) && (
                <p className="pol-meta-item" style={{ margin: '0.6rem 0 0' }}>
                  Last updated
                  {viewing.updated_by?.name ? ` by ${viewing.updated_by.name}` : ''}
                  {viewing.updatedAt ? ` on ${displayDateTime(viewing.updatedAt)}` : ''}
                </p>
              )}
              <DialogFooter>
                {manage && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setViewing(null);
                      openEdit(viewing);
                    }}
                  >
                    Edit
                  </Button>
                )}
                <Button onClick={() => setViewing(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && !deleteBusy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete policy?</DialogTitle>
            <DialogDescription>
              <strong>{deleting?.title}</strong> will be removed permanently. Employees will no longer be able to view it.
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
