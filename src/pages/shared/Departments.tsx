import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge, RequireRole } from '../../components/StatusBadge';
import { displayClock, formatClockInput, to24HourClock } from '../../utils/timeFormat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
  status: string;
};

export default function DepartmentsPage() {
  return (
    <RequireRole roles={['admin', 'hr']}>
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
        typeFilters={
          <select className="select" value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        }
        actions={<Button onClick={() => setEditing({ name: '', working_hours_per_day: 8.25, shift_start: '9:15 AM', shift_end: '5:30 PM', status: 'active' })}>Add Department</Button>}
      >
        <div className="dept-grid">
          {data.map((d) => (
            <div className="dept-card" key={d._id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>{d.name}</h3>
                <div className="row-actions">
                  <Button variant="outline" size="icon" onClick={() => setEditing({
                    ...d,
                    shift_start: formatClockInput(d.shift_start),
                    shift_end: formatClockInput(d.shift_end),
                  })}><Pencil size={16} /></Button>
                  <Button variant="outline" size="icon" onClick={async () => { await api(`/departments/${d._id}`, { method: 'DELETE' }); load(); }}><Trash2 size={16} /></Button>
                </div>
              </div>
              <p style={{ color: 'var(--muted)', margin: '0.35rem 0' }}>{d.working_hours_per_day}h/day · {displayClock(d.shift_start)} – {displayClock(d.shift_end)}</p>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      </ListingPage>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?._id ? 'Edit' : 'Add'} Department</DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <div className="form-grid">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Hours/day</Label>
                  <Input type="number" step="0.25" value={editing.working_hours_per_day ?? 8} onChange={(e) => setEditing({ ...editing, working_hours_per_day: Number(e.target.value) })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Shift start (e.g. 9:15 AM)</Label>
                  <Input value={editing.shift_start || ''} onChange={(e) => setEditing({ ...editing, shift_start: e.target.value })} placeholder="9:15 AM" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Shift end (e.g. 5:30 PM)</Label>
                  <Input value={editing.shift_end || ''} onChange={(e) => setEditing({ ...editing, shift_end: e.target.value })} placeholder="5:30 PM" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <select className="select" value={editing.status || 'active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button
                  onClick={async () => {
                    const body = {
                      ...editing,
                      shift_start: to24HourClock(editing.shift_start) || editing.shift_start,
                      shift_end: to24HourClock(editing.shift_end) || editing.shift_end,
                    };
                    if (editing._id) await api(`/departments/${editing._id}`, { method: 'PUT', body });
                    else await api('/departments', { method: 'POST', body });
                    setEditing(null);
                    load();
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
