import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge } from '../../components/StatusBadge';
import { RequireRole } from '../../components/StatusBadge';

type Dept = {
  _id: string;
  name: string;
  working_hours_per_day: number;
  shift_start: string;
  shift_end: string;
  status: string;
};

export default function DepartmentsPage() {
  return (
    <RequireRole roles={['admin']}>
      <DepartmentsInner />
    </RequireRole>
  );
}

function DepartmentsInner() {
  const list = useListParams();
  const [data, setData] = useState<Dept[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Dept> | null>(null);

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

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);

  return (
    <>
      <ListingPage
        title="Departments"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <select className="select" style={{ width: 140 }} value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        }
        actions={<button className="btn" onClick={() => setEditing({ name: '', working_hours_per_day: 8.25, shift_start: '09:15', shift_end: '17:30', status: 'active' })}>Add Department</button>}
      >
        <div className="dept-grid">
          {data.map((d) => (
            <div className="dept-card" key={d._id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>{d.name}</h3>
                <div className="row-actions">
                  <button className="btn btn-ghost btn-icon" onClick={() => setEditing(d)}><Pencil size={16} /></button>
                  <button className="btn btn-ghost btn-icon" onClick={async () => { await api(`/departments/${d._id}`, { method: 'DELETE' }); load(); }}><Trash2 size={16} /></button>
                </div>
              </div>
              <p style={{ color: 'var(--muted)', margin: '0.35rem 0' }}>{d.working_hours_per_day}h/day · {d.shift_start} – {d.shift_end}</p>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      </ListingPage>
      {editing && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{editing._id ? 'Edit' : 'Add'} Department</h2>
            <div className="form-grid">
              <div><label className="label">Name</label><input className="input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label className="label">Hours/day</label><input className="input" type="number" step="0.25" value={editing.working_hours_per_day ?? 8} onChange={(e) => setEditing({ ...editing, working_hours_per_day: Number(e.target.value) })} /></div>
              <div><label className="label">Shift start</label><input className="input" value={editing.shift_start || ''} onChange={(e) => setEditing({ ...editing, shift_start: e.target.value })} /></div>
              <div><label className="label">Shift end</label><input className="input" value={editing.shift_end || ''} onChange={(e) => setEditing({ ...editing, shift_end: e.target.value })} /></div>
              <div><label className="label">Status</label>
                <select className="select" value={editing.status || 'active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button
                className="btn"
                onClick={async () => {
                  if (editing._id) await api(`/departments/${editing._id}`, { method: 'PUT', body: editing });
                  else await api('/departments', { method: 'POST', body: editing });
                  setEditing(null);
                  load();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
