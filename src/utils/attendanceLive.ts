import { effectiveWorkStart, minutesBetween } from './timeFormat';

export type LiveAttendanceInput = {
  checkIn?: string | null;
  checkOut?: string | null;
  breakTotal?: number | null;
  breakStartedAt?: string | null;
  status?: string | null;
  workStart?: string | null;
  shiftStart?: string | null;
  penaltyWaived?: boolean;
  lateBufferMinutes?: number;
  penaltyMinutesOverride?: number | null;
  now: string;
};

export function liveAttendanceClock(input: LiveAttendanceInput) {
  const checkedOut = !!input.checkOut;
  const onBreak = !checkedOut && (input.status === 'OnBreak' || !!input.breakStartedAt);
  let breakMins = Number(input.breakTotal || 0);
  let breakSessionMins = 0;
  if (onBreak && input.breakStartedAt && !checkedOut) {
    breakSessionMins = minutesBetween(input.breakStartedAt, input.now);
    breakMins = Number(input.breakTotal || 0) + breakSessionMins;
  }

  let workMins = 0;
  if (input.checkIn) {
    const end = checkedOut ? input.checkOut : input.now;
    const start =
      input.workStart ||
      effectiveWorkStart(
        input.checkIn,
        input.shiftStart,
        !!input.penaltyWaived,
        input.lateBufferMinutes,
        input.penaltyMinutesOverride ?? null
      ) ||
      input.checkIn;
    workMins = Math.max(0, minutesBetween(start, end) - breakMins);
  }

  return { onBreak, breakMins, breakSessionMins, workMins };
}

/** Wall-clock beat that keeps running in the background and on tab focus. */
export function startClockBeat(onTick: (at: Date) => void) {
  let timeoutId = 0;
  const beat = () => {
    onTick(new Date());
    timeoutId = window.setTimeout(beat, 1000);
  };
  timeoutId = window.setTimeout(beat, 1000);
  const onVis = () => {
    if (!document.hidden) onTick(new Date());
  };
  document.addEventListener('visibilitychange', onVis);
  onTick(new Date());
  return () => {
    window.clearTimeout(timeoutId);
    document.removeEventListener('visibilitychange', onVis);
  };
}
