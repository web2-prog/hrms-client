import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear employee data</DialogTitle>
          <DialogDescription>
            This permanently deletes attendance, leaves, salary slips, and monthly summaries in the
            selected date range. Profile, bank, and bond details are kept.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="clear-start">Start date</Label>
              <Input id="clear-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="clear-end">End date</Label>
              <Input id="clear-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
