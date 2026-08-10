import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (start: string, end: string) => Promise<void>;
};

export function ConfirmClearData({ open, onClose, onConfirm }: Props) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Clear employee data</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
          This permanently deletes attendance, leaves, salary slips, and monthly summaries in the selected date range.
          Profile, bank, and bond details are kept.
        </p>
        <div className="form-grid" style={{ marginTop: '1rem' }}>
          <div>
            <label className="label">Start date</label>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label">End date</label>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {err && <p style={{ color: 'var(--error)' }}>{err}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={!start || !end || busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await onConfirm(start, end);
                onClose();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm clear
          </button>
        </div>
      </div>
    </div>
  );
}
