import { useEffect, useState } from 'react';
import { Eye, Headphones } from 'lucide-react';
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

type Ticket = {
  _id: string;
  type: 'Complaint' | 'HR Request';
  subject: string;
  description: string;
  priority: string;
  status: string;
  admin_response?: string;
  createdAt?: string;
  handled_on?: string;
  employee_id?: { name: string; department_id?: { name: string } };
  handled_by?: { name?: string } | null;
};

const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'] as const;

export function HelpdeskPage() {
  const list = useListParams();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'hr';
  const [data, setData] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<Ticket | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({
        page: list.page,
        limit: list.limit,
        search: list.search,
        status: list.get('status'),
        type: list.get('type'),
        priority: list.get('priority'),
      });
      const res = await api<ListResult<Ticket>>(`/helpdesk${q}`);
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

  return (
    <>
      <ListingPage
        title="Employee Helpdesk"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        typeFilters={
          <>
            <select className="select" value={list.get('type')} onChange={(e) => list.setFilter('type', e.target.value)}>
              <option value="">All types</option>
              <option value="Complaint">Complaint</option>
              <option value="HR Request">HR Request</option>
            </select>
            <select className="select" value={list.get('status')} onChange={(e) => list.setFilter('status', e.target.value)}>
              <option value="">Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select className="select" value={list.get('priority')} onChange={(e) => list.setFilter('priority', e.target.value)}>
              <option value="">Priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </>
        }
        actions={<Button onClick={() => setShowCreate(true)}>New Ticket</Button>}
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {isStaff && <th>Employee</th>}
                <th>Type</th>
                <th>Subject</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t._id}>
                  {isStaff && (
                    <td>
                      <div>{t.employee_id?.name || '—'}</div>
                      {t.employee_id?.department_id?.name && (
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{t.employee_id.department_id.name}</div>
                      )}
                    </td>
                  )}
                  <td>{t.type}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Headphones size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                      <span>{t.subject}</span>
                    </div>
                  </td>
                  <td>{t.priority}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <Button variant="ghost" size="icon" title="View" onClick={() => setViewing(t)}>
                      <Eye size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {viewing && (
        <TicketDetailModal
          ticket={viewing}
          isStaff={!!isStaff}
          onClose={() => setViewing(null)}
          onUpdated={() => {
            setViewing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function CreateTicketModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'Complaint' | 'HR Request'>('Complaint');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [err, setErr] = useState('');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New helpdesk ticket</DialogTitle>
        </DialogHeader>
        <div className="form-grid">
          <div>
            <label className="label">Type</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as 'Complaint' | 'HR Request')}>
              <option value="Complaint">Complaint</option>
              <option value="HR Request">HR Request</option>
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Details</label>
            <textarea
              className="textarea"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your complaint or HR request…"
            />
          </div>
        </div>
        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              try {
                await api('/helpdesk', { method: 'POST', body: { type, subject, description, priority } });
                onSaved();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              }
            }}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailModal({
  ticket,
  isStaff,
  onClose,
  onUpdated,
}: {
  ticket: Ticket;
  isStaff: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState(ticket.status);
  const [response, setResponse] = useState(ticket.admin_response || '');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
        </DialogHeader>
        <p style={{ color: 'var(--muted)', margin: '0 0 12px', fontSize: 13 }}>
          {ticket.type} · {ticket.priority} priority · <StatusBadge status={ticket.status} />
          {isStaff && ticket.employee_id?.name ? ` · ${ticket.employee_id.name}` : ''}
          {ticket.createdAt ? ` · ${displayDateTime(ticket.createdAt)}` : ''}
        </p>

        <div
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            padding: '12px 0',
            borderTop: '1px solid var(--border)',
            maxHeight: '30vh',
            overflow: 'auto',
          }}
        >
          {ticket.description}
        </div>

        {!isStaff && ticket.admin_response && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--surface-2, var(--bg))', borderRadius: 8 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              Response from HR / Admin
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{ticket.admin_response}</div>
            {ticket.handled_by?.name && (
              <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
                By {ticket.handled_by.name}
                {ticket.handled_on ? ` on ${displayDateTime(ticket.handled_on)}` : ''}
              </p>
            )}
          </div>
        )}

        {isStaff && (
          <div className="form-grid" style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div>
              <label className="label">Update status</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label">Response to employee</label>
              <textarea className="textarea" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write a reply or resolution note…" />
            </div>
          </div>
        )}

        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {isStaff && (
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setErr('');
                try {
                  await api(`/helpdesk/${ticket._id}/respond`, {
                    method: 'PATCH',
                    body: { status, admin_response: response },
                  });
                  onUpdated();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'Failed');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save response
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
