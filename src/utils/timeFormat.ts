/** Shared attendance / duration formatters (second precision). */

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

type ClockParts = { h: number; m: number; s: number; hasSeconds: boolean };

/** Parse 24h (HH:MM[:SS]) or 12h (h:mm[:ss] AM/PM) clock times */
export function parseClockParts(t?: string | null): ClockParts | null {
  if (!t) return null;
  const str = String(t).trim();
  if (!str) return null;

  const ampm = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const s = ampm[3] != null ? Number(ampm[3]) : 0;
    const period = ampm[4].toUpperCase();
    if (h < 1 || h > 12 || m > 59 || s > 59) return null;
    if (period === 'AM') {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return { h, m, s, hasSeconds: ampm[3] != null };
  }

  const parts = str.split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [h, m, s = 0] = parts;
  if (h > 23 || m > 59 || s > 59) return null;
  return { h, m, s, hasSeconds: parts.length >= 3 };
}

/** Parse HH:MM, HH:MM:SS, or 12h AM/PM → total seconds from midnight */
export function timeToSeconds(t?: string | null): number | null {
  const p = parseClockParts(t);
  if (!p) return null;
  return p.h * 3600 + p.m * 60 + p.s;
}

export function secondsBetween(start?: string | null, end?: string | null) {
  const a = timeToSeconds(start);
  const b = timeToSeconds(end);
  if (a == null || b == null) return 0;
  return Math.max(0, b - a);
}

/** Fractional minutes between two clock times */
export function minutesBetween(start?: string | null, end?: string | null) {
  return secondsBetween(start, end) / 60;
}

/** Add minutes to HH:MM / HH:MM:SS → HH:MM:SS */
export function addMinutesToTime(t: string, mins: number) {
  const sec = timeToSeconds(t);
  if (sec == null) return t;
  let total = Math.round(sec + Number(mins || 0) * 60);
  if (total < 0) total = 0;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export const LATE_CHECKIN_PENALTY_MINUTES = 15;

export function isLateCheckIn(checkIn?: string | null, shiftStart?: string | null) {
  if (!checkIn || !shiftStart) return false;
  return minutesBetween(shiftStart, checkIn) > 1 / 60;
}

/** If late (and not waived), work counts from check_in + 15 minutes */
export function effectiveWorkStart(
  checkIn?: string | null,
  shiftStart?: string | null,
  penaltyWaived = false
) {
  if (!checkIn) return null;
  if (!penaltyWaived && isLateCheckIn(checkIn, shiftStart)) {
    return addMinutesToTime(checkIn, LATE_CHECKIN_PENALTY_MINUTES);
  }
  return checkIn;
}

/** Decimal hours → H:MM:SS */
export function formatHours(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const totalSec = Math.round(Math.abs(n) * 3600);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${sign}${h}:${pad2(m)}:${pad2(s)}`;
}

/** Duration in (fractional) minutes → H:MM:SS */
export function formatDurationMinutes(totalMinutes: number) {
  const totalSec = Math.max(0, Math.round(Number(totalMinutes || 0) * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${pad2(m)}:${pad2(s)}`;
}

/**
 * Break minutes (fractional) → whole minutes display.
 * e.g. 24.9 (24:54) → "24m"
 */
export function formatBreakMinutes(mins?: number) {
  const m = Math.max(0, Math.floor(Number(mins || 0)));
  return `${m}m`;
}

/** Parse break input: number, "24m", "M:SS", or "H:MM:SS" → fractional minutes */
export function parseBreakMinutes(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Math.max(0, value);
  const str = String(value).trim();
  if (!str) return 0;
  const withUnit = str.match(/^(\d+(?:\.\d+)?)\s*m$/i);
  if (withUnit) return Math.max(0, Number(withUnit[1]));
  if (/^\d+(\.\d+)?$/.test(str)) return Math.max(0, Number(str));
  const parts = str.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) {
    const [m, s] = parts;
    return Math.max(0, m + s / 60);
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return Math.max(0, h * 60 + m + s / 60);
  }
  return 0;
}

/** Clock time for display: 12-hour with AM/PM (e.g. 9:15 AM, 5:30:12 PM) */
export function displayClock(t?: string | null) {
  if (!t) return '—';
  const p = parseClockParts(t);
  if (!p) return String(t);
  const period = p.h >= 12 ? 'PM' : 'AM';
  const h12 = p.h % 12 || 12;
  const body = p.hasSeconds ? `${h12}:${pad2(p.m)}:${pad2(p.s)}` : `${h12}:${pad2(p.m)}`;
  return `${body} ${period}`;
}

/** 12-hour value for time inputs; empty string when unset */
export function formatClockInput(t?: string | null) {
  if (!t || !String(t).trim()) return '';
  const shown = displayClock(t);
  return shown === '—' ? '' : shown;
}

/** Date+time for display with 12-hour clock */
export function displayDateTime(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** Normalize a typed clock (12h or 24h) to HH:MM:SS for the API */
export function to24HourClock(t?: string | null): string | null {
  if (t == null || !String(t).trim()) return null;
  const p = parseClockParts(t);
  if (!p) return String(t).trim();
  return `${pad2(p.h)}:${pad2(p.m)}:${pad2(p.s)}`;
}
