import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { formatHours } from './StatusBadge';
import { AppSelect } from './AppSelect';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export type SurplusRequestKind = 'management_ot' | 'cover_time';

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type LiveProps = {
  mode: 'live';
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  date?: string;
  dailySurplusHours: number;
  managementOtHours: number;
  coverHours: number;
  coverMinHours: number;
  monthlyShortfallHours: number;
  claimedCoverHours?: number;
  canRequestOt: boolean;
  canRequestCover: boolean;
};

type DatedProps = {
  mode: 'dated';
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export type SurplusRequestModalProps = LiveProps | DatedProps;

export function SurplusRequestModal(props: SurplusRequestModalProps) {
  const { open, onClose, onSaved, mode } = props;

  const [kind, setKind] = useState<SurplusRequestKind>('management_ot');
  const [date, setDate] = useState(todayYmd());
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(false);
  const [datedOtHours, setDatedOtHours] = useState(0);
  const [datedCoverHours, setDatedCoverHours] = useState(0);
  const [datedOtEligible, setDatedOtEligible] = useState(false);
  const [datedCoverEligible, setDatedCoverEligible] = useState(false);
  const [datedHint, setDatedHint] = useState('');
  const [datedCoverMin, setDatedCoverMin] = useState(0.75);
  const [datedShortfall, setDatedShortfall] = useState(0);
  const [datedSurplus, setDatedSurplus] = useState(0);

  const live = mode === 'live' ? props : null;

  const canOt = mode === 'live' ? live!.canRequestOt : datedOtEligible;
  const canCover = mode === 'live' ? live!.canRequestCover : datedCoverEligible && date === todayYmd();

  const otHours = mode === 'live' ? live!.managementOtHours : datedOtHours;
  const coverHours = mode === 'live' ? live!.coverHours : datedCoverHours;
  const coverMinHours = mode === 'live' ? live!.coverMinHours : datedCoverMin;
  const shortfall = mode === 'live' ? live!.monthlyShortfallHours : datedShortfall;
  const surplus = mode === 'live' ? live!.dailySurplusHours : datedSurplus;
  const claimedCover = mode === 'live' ? Number(live!.claimedCoverHours || 0) : 0;

  const selectedHours = kind === 'management_ot' ? otHours : coverHours;
  const selectedEligible = kind === 'management_ot' ? canOt : canCover;

  // Prefer a selectable kind when modal opens / eligibility changes.
  useEffect(() => {
    if (!open) return;
    setErr('');
    setReason('');
    if (canOt) setKind('management_ot');
    else if (canCover) setKind('cover_time');
  }, [open, canOt, canCover]);

  useEffect(() => {
    if (!open || mode !== 'dated') return;
    let cancelled = false;
    const load = async () => {
      if (!date) return;
      setLoading(true);
      setDatedHint('Loading from attendance…');
      try {
        const ot = await api<{
          eligible: boolean;
          message?: string | null;
          management_ot_hours?: number;
          cover_hours?: number;
          cover_eligible?: boolean;
          work_hours?: number;
          full_hours?: number | null;
          daily_surplus?: number;
          monthly_shortfall?: number;
          min_cover_hours?: number;
          claimed_cover_hours?: number;
          checked_out?: boolean;
        }>(`/overtime/eligible-hours?date=${encodeURIComponent(date)}`);

        let coverEligible = false;
        let coverHrs = Number(ot.cover_hours) || 0;
        let coverMin = Number(ot.min_cover_hours) || 0.75;
        if (date === todayYmd()) {
          try {
            const cover = await api<{
              eligible: boolean;
              cover_hours?: number;
              hours?: number;
              min_hours?: number;
              pending_hours?: number;
              message?: string | null;
            }>('/attendance/me/cover-time-eligible');
            coverEligible = !!cover.eligible;
            coverHrs = Number(cover.cover_hours ?? cover.hours) || coverHrs;
            coverMin = Number(cover.min_hours) || coverMin;
          } catch {
            coverEligible = false;
          }
        }

        if (cancelled) return;
        setDatedOtHours(Number(ot.management_ot_hours) || 0);
        setDatedOtEligible(!!ot.eligible);
        setDatedCoverHours(coverHrs);
        setDatedCoverEligible(coverEligible);
        setDatedCoverMin(coverMin);
        setDatedShortfall(Number(ot.monthly_shortfall) || 0);
        setDatedSurplus(Number(ot.daily_surplus) || 0);
        const claimed = Number(ot.claimed_cover_hours) || 0;
        setDatedHint(
          ot.eligible
            ? `Worked ${formatHours(ot.work_hours)} − daily ${formatHours(ot.full_hours ?? 0)}` +
                (claimed > 0.01 ? ` − cover ${formatHours(claimed)}` : '') +
                (ot.checked_out ? ' · through checkout' : ' · live until checkout')
            : ot.message || 'No Management OT for this date yet'
        );
      } catch (e) {
        if (cancelled) return;
        setDatedOtHours(0);
        setDatedOtEligible(false);
        setDatedCoverEligible(false);
        setDatedHint(e instanceof Error ? e.message : 'Could not load hours');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, mode, date]);

  const kindHint = useMemo(() => {
    if (kind === 'management_ot') {
      if (mode === 'dated') return datedHint;
      return claimedCover > 0.01
        ? `Auto from daily hours through checkout (after claimed cover ${formatHours(claimedCover)})`
        : 'Auto from daily working hours through checkout';
    }
    if (!canCover) {
      return date !== todayYmd() && mode === 'dated'
        ? 'Cover Time can only be requested for today while still checked in'
        : `Need at least ${formatHours(coverMinHours)} surplus toward shortfall`;
    }
    return `Toward monthly shortfall · min ${formatHours(coverMinHours)} · shortfall ${formatHours(shortfall)}`;
  }, [kind, mode, datedHint, claimedCover, canCover, date, coverMinHours, shortfall]);

  const submit = async () => {
    if (!selectedEligible || selectedHours < 0.01) {
      setErr(
        kind === 'management_ot'
          ? 'No Management OT available for this selection'
          : 'Cover Time is not available for this selection'
      );
      return;
    }
    if (!reason.trim()) {
      setErr('Reason required');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      if (kind === 'management_ot') {
        const submitDate = mode === 'live' ? live!.date || todayYmd() : date;
        await api('/overtime', {
          method: 'POST',
          body: { date: submitDate, reason, ot_type: 'Management' },
        });
      } else {
        await api('/attendance/me/cover-time-request', {
          method: 'POST',
          body: { reason },
        });
      }
      setReason('');
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send request');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request OT or Cover Time</DialogTitle>
          <DialogDescription>
            Pick <strong>Management OT</strong> (company-paid overtime) or <strong>Cover Time</strong> (counts toward
            monthly shortfall). Duration is calculated automatically — add a reason only.
          </DialogDescription>
        </DialogHeader>

        <p className="emp-stat-hint" style={{ margin: 0 }}>
          Today surplus {formatHours(surplus)}
          {shortfall > 0.001 ? ` · shortfall ${formatHours(shortfall)}` : ''}
          {claimedCover > 0.01 ? ` · cover claimed ${formatHours(claimedCover)}` : ''}
        </p>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="label" htmlFor="surplus-kind">
              Request type
            </label>
            <AppSelect
              id="surplus-kind"
              fullWidth
              value={kind}
              onChange={(v) => {
                setKind(v as SurplusRequestKind);
                setErr('');
              }}
              options={[
                {
                  value: 'management_ot',
                  label:
                    `Management OT` +
                    (otHours > 0 ? ` · ${formatHours(otHours)}` : '') +
                    (!canOt ? ' — unavailable' : ''),
                  disabled: !canOt,
                },
                {
                  value: 'cover_time',
                  label:
                    `Cover Time` +
                    (coverHours > 0 ? ` · ${formatHours(coverHours)}` : '') +
                    (!canCover ? ' — unavailable' : ''),
                  disabled: !canCover,
                },
              ]}
            />
          </div>

          {mode === 'dated' && kind === 'management_ot' && (
            <div className="grid gap-1.5">
              <label className="label" htmlFor="surplus-date">
                Date
              </label>
              <input
                id="surplus-date"
                className="input"
                type="date"
                value={date}
                max={todayYmd()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <label className="label" htmlFor="surplus-duration">
              {kind === 'management_ot' ? 'Management OT' : 'Cover Time'} (auto)
            </label>
            <input
              id="surplus-duration"
              className="input"
              type="text"
              readOnly
              value={loading ? 'Calculating…' : formatHours(selectedHours)}
              aria-readonly="true"
            />
            <span className="emp-stat-hint">{kindHint}</span>
          </div>

          <div className="grid gap-1.5">
            <label className="label" htmlFor="surplus-reason">
              Reason <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <Textarea
              id="surplus-reason"
              rows={3}
              placeholder={
                kind === 'management_ot'
                  ? 'e.g. Urgent client delivery, production deadline…'
                  : 'e.g. Making up early checkout shortfall…'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {err && <p style={{ color: 'var(--error)', margin: 0 }}>{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !selectedEligible || selectedHours < 0.01} onClick={submit}>
            {busy
              ? 'Sending…'
              : kind === 'management_ot'
                ? 'Submit Management OT'
                : 'Submit Cover Time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
