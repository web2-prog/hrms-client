import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Eye, Headphones, Loader, Plus, XCircle } from 'lucide-react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { StatusBadge } from '../../components/StatusBadge';
import { EmpCell } from '../../components/EmpCell';
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

function priorityClass(p?: string) {
  if (!p) return 'is-low';
  return p === 'High' ? 'is-high' : p === 'Medium' ? 'is-medium' : 'is-low';
}

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

  const [summary, setSummary] = useState<{ pending: number; inProgress: number; resolved: number; rejected: number } | null>(null);

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

  const loadSummary = async () => {
    try {
      const [pending, inProgress, resolved, rejected] = await Promise.all([
        api<ListResult<Ticket>>(`/helpdesk${buildQuery({ limit: 1, status: 'Pending' })}`).catch(() => null),
        api<ListResult<Ticket>>(`/helpdesk${buildQuery({ limit: 1, status: 'In Progress' })}`).catch(() => null),
        api<ListResult<Ticket>>(`/helpdesk${buildQuery({ limit: 1, status: 'Resolved' })}`).catch(() => null),
        api<ListResult<Ticket>>(`/helpdesk${buildQuery({ limit: 1, status: 'Rejected' })}`).catch(() => null),
      ]);
      setSummary({
        pending: pending?.total ?? 0,
        inProgress: inProgress?.total ?? 0,
        resolved: resolved?.total ?? 0,
        rejected: rejected?.total ?? 0,
      });
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => { load(); }, [list.page, list.limit, list.search, list.params]);

  useEffect(() => { loadSummary(); }, []);

  return (
    <>
      <ListingPage
        title="Employee Helpdesk"
        subtitle="Track complaints and HR requests from submission to resolution"
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
              <option value="">All status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="select" value={list.get('priority')} onChange={(e) => list.setFilter('priority', e.target.value)}>
              <option value="">All priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </>
        }
        actions={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Ticket</Button>}
        prepend={
          summary && (
            <div className="page-stats">
              <div className="card emp-stat card-accent amber">
                <div className="stat-card">
                  <span className="stat-icon amber"><Clock3 size={20} /></span>
                  <div>
                    <span className="label">Pending</span>
                    <div className="emp-stat-value">{summary.pending}</div>
                    <span className="emp-stat-hint">Awaiting attention</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent violet">
                <div className="stat-card">
                  <span className="stat-icon violet"><Loader size={20} /></span>
                  <div>
                    <span className="label">In progress</span>
                    <div className="emp-stat-value">{summary.inProgress}</div>
                    <span className="emp-stat-hint">Being worked on</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent teal">
                <div className="stat-card">
                  <span className="stat-icon teal"><CheckCircle2 size={20} /></span>
                  <div>
                    <span className="label">Resolved</span>
                    <div className="emp-stat-value">{summary.resolved}</div>
                    <span className="emp-stat-hint">Closed tickets</span>
                  </div>
                </div>
              </div>
              <div className="card emp-stat card-accent coral">
                <div className="stat-card">
                  <span className="stat-icon coral"><XCircle size={20} /></span>
                  <div>
                    <span className="label">Rejected</span>
                    <div className="emp-stat-value">{summary.rejected}</div>
                    <span className="emp-stat-hint">Not actioned</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
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
                      <EmpCell name={t.employee_id?.name} dept={t.employee_id?.department_id?.name} />
                    </td>
                  )}
                  <td><span className="ticket-type-chip">{t.type}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Headphones size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                      <span>{t.subject}</span>
                    </div>
                  </td>
                  <td><span className={`priority-chip ${priorityClass(t.priority)}`}>{t.priority}</span></td>
                  <td><StatusBadge status={t.status} /></td>
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
            loadSummary();
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
            loadSummary();
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
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New helpdesk ticket</DialogTitle>
          <DialogDescription>
            Describe the issue or request — the relevant team will pick it up.
          </DialogDescription>
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
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
            />
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
        {err && <p className="form-error">{err}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || !subject.trim()}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await api('/helpdesk', { method: 'POST', body: { type, subject, description, priority } });
                onSaved();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
                setBusy(false);
              }
            }}
          >
            {busy ? 'Submitting…' : 'Submit'}
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
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
          <DialogDescription>
            <span className="ticket-type-chip">{ticket.type}</span>{' '}
            <span className={`priority-chip ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>{' '}
            <StatusBadge status={ticket.status} />
            {isStaff && ticket.employee_id?.name ? ` · ${ticket.employee_id.name}` : ''}
            {ticket.createdAt ? ` · ${displayDateTime(ticket.createdAt)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="pol-doc" style={{ maxHeight: '30vh' }}>{ticket.description}</div>

        {!isStaff && ticket.admin_response && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--surface-2, var(--bg))', borderRadius: 8 }}>
            <div className="label" style={{ marginBottom: 6 }}>Response from HR / Admin</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{ticket.admin_response}</div>
            {ticket.handled_by?.name && (
              <p className="pol-meta-item" style={{ margin: '8px 0 0' }}>
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
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label">Response to employee</label>
              <textarea className="textarea" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write a reply or resolution note…" />
            </div>
          </div>
        )}

        {err && <p className="form-error">{err}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>Close</Button>
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
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Saving…' : 'Save response'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
