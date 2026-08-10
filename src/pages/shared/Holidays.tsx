import { useEffect, useState } from 'react';
import { api, buildQuery, type ListResult } from '../../services/api';
import { ListingPage, useListParams } from '../../components/ListingPage';
import { useAuth } from '../../context/AuthContext';

type HolidayType = 'Saturday' | 'Festival' | 'Vacation' | 'Manual';

type Holiday = {
  _id: string;
  type: string;
  name?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  year?: number;
};

export function HolidaysPage({ canManage = true }: { canManage?: boolean }) {
  const list = useListParams();
  const { user } = useAuth();
  const manage = canManage && (user?.role === 'admin' || user?.role === 'hr');
  const [data, setData] = useState<Holiday[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addType, setAddType] = useState<HolidayType | null>(null);

  const year = list.get('year') || '2026';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery({ page: list.page, limit: list.limit, search: list.search, year, type: list.get('type') });
      const res = await api<ListResult<Holiday>>(`/holidays${q}`);
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
        title="Holidays"
        loading={loading}
        error={error}
        empty={!data.length}
        total={total}
        onRefresh={load}
        filters={
          <>
            <select className="select" style={{ width: 100 }} value={year} onChange={(e) => list.setFilter('year', e.target.value)}>
              {[2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="select" style={{ width: 140 }} value={list.get('type')} onChange={(e) => list.setFilter('type', e.target.value)}>
              <option value="">All types</option>
              <option value="Saturday">Saturday</option>
              <option value="Festival">Festival</option>
              <option value="Vacation">Vacation</option>
              <option value="Manual">Manual</option>
            </select>
          </>
        }
        actions={
          manage ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setAddType('Saturday')}>+ Sat off</button>
              <button className="btn" onClick={() => setAddType('Festival')}>+ Festival</button>
              <button className="btn" onClick={() => setAddType('Vacation')}>+ Vacation</button>
              <button className="btn" onClick={() => setAddType('Manual')}>+ Manual</button>
            </div>
          ) : undefined
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Date(s)</th>
                <th>Year</th>
                {manage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.map((h) => (
                <tr key={h._id}>
                  <td>{h.type}</td>
                  <td>{h.name || 'Alternate Saturday'}</td>
                  <td>{h.type === 'Vacation' ? `${h.start_date} → ${h.end_date}` : h.date}</td>
                  <td>{h.year}</td>
                  {manage && (
                    <td>
                      <button
                        className="btn btn-ghost"
                        onClick={async () => {
                          await api(`/holidays/${h._id}`, { method: 'DELETE' });
                          load();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListingPage>
      {addType && (
        <AddHolidayModal
          type={addType}
          onClose={() => setAddType(null)}
          onSaved={() => { setAddType(null); load(); }}
        />
      )}
    </>
  );
}

function AddHolidayModal({ type, onClose, onSaved }: { type: HolidayType; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', date: '', start_date: '', end_date: '' });
  const [err, setErr] = useState('');

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Add {type}</h2>
        <div className="form-grid">
          {type !== 'Saturday' && (
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={type === 'Manual' ? 'e.g. Office maintenance' : ''} /></div>
          )}
          {type !== 'Vacation' && (
            <div><label className="label">Date</label><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          )}
          {type === 'Vacation' && (
            <>
              <div><label className="label">Start</label><input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="label">End</label><input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </>
          )}
        </div>
        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            onClick={async () => {
              try {
                const body =
                  type === 'Saturday'
                    ? { type, date: form.date }
                    : type === 'Vacation'
                      ? { type, name: form.name, start_date: form.start_date, end_date: form.end_date }
                      : { type, name: form.name, date: form.date };
                await api('/holidays', { method: 'POST', body });
                onSaved();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              }
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
