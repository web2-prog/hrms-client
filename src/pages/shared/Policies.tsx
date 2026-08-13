import { useEffect, useState } from 'react';
import { Pencil, Trash2, Eye, FileText } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { displayDateTime } from '../../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
  const [saveErr, setSaveErr] = useState('');

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

  useEffect(() => {
    load();
  }, [list.page, list.limit, list.search, list.params]);

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
    if (!editing) return;
    setSaveErr('');
    try {
      const body = {
        title: editing.title,
        content: editing.content,
        category: editing.category,
        status: editing.status,
        effective_date: editing.effective_date || null,
      };
      if (editing._id) await api(`/policies/${editing._id}`, { method: 'PUT', body });
      else await api('/policies', { method: 'POST', body });
      setEditing(null);
      load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <>
      <ListingPage
        title="Company Policies"
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
        actions={
          manage ? (
            <Button onClick={() => openEdit()}>
              Add Policy
            </Button>
          ) : undefined
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                {manage && <th>Status</th>}
                <th>Effective</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                      <span>{p.title}</span>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  {manage && (
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  )}
                  <td>{p.effective_date || '—'}</td>
                  <td>{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="ghost" size="icon" title="View" onClick={() => setViewing(p)}>
                        <Eye size={16} />
                      </Button>
                      {manage && (
                        <>
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(p)}>
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={async () => {
                              if (!confirm(`Delete policy "${p.title}"?`)) return;
                              await api(`/policies/${p._id}`, { method: 'DELETE' });
                              load();
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editing?._id ? 'Edit' : 'Add'} Policy</DialogTitle>
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
                    <option key={c} value={c}>
                      {c}
                    </option>
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
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
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
            {saveErr && <p style={{ color: 'var(--error)' }}>{saveErr}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save}>
                Save
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
          </DialogHeader>
          {viewing && (
            <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>
                  {viewing.category}
                  {viewing.effective_date ? ` · Effective ${viewing.effective_date}` : ''}
                  {manage ? (
                    <>
                      {' · '}
                      <StatusBadge status={viewing.status} />
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                maxHeight: '55vh',
                overflow: 'auto',
                padding: '12px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              {viewing.content}
            </div>
            {(viewing.updated_by?.name || viewing.updatedAt) && (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
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
              <Button onClick={() => setViewing(null)}>
                Close
              </Button>
            </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
