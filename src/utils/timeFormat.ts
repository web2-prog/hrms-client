/** Shared attendance / duration formatters (second precision). */

export const APP_TIMEZONE = 'Asia/Kolkata';

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function zonedPart(d: Date, type: Intl.DateTimeFormatPartTypes, timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const value = parts.find((p) => p.type === type)?.value || '0';
  if (type === 'hour' && value === '24') return '00';
  return value;
}

/** Current business clock HH:MM:SS in Asia/Kolkata (not the browser timezone). */
export function nowHMS(d = new Date()) {
  const hour = zonedPart(d, 'hour');
  return `${pad2(Number(hour))}:${pad2(Number(zonedPart(d, 'minute')))}:${pad2(Number(zonedPart(d, 'second')))}`;
}

/** Current business date YYYY-MM-DD in Asia/Kolkata. */
export function todayISO(d = new Date()) {
  return `${zonedPart(d, 'year')}-${pad2(Number(zonedPart(d, 'month')))}-${pad2(Number(zonedPart(d, 'day')))}`;
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

/** Add seconds to HH:MM / HH:MM:SS → HH:MM:SS */
export function addSecondsToTime(t: string, seconds: number) {
  const sec = timeToSeconds(t);
  if (sec == null) return t;
  let total = Math.round(sec + Number(seconds || 0));
  if (total < 0) total = 0;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Add minutes to HH:MM / HH:MM:SS → HH:MM:SS */
export function addMinutesToTime(t: string, mins: number) {
  return addSecondsToTime(t, Number(mins || 0) * 60);
}

export const LATE_CHECKIN_PENALTY_MINUTES = 15;
/** Default grace after shift start (08:45 → late until 09:05 inclusive). */
export const DEFAULT_LATE_BUFFER_MINUTES = 20;
export const DEFAULT_LATE_BUFFER_UNTIL = '09:05';

export function normalizeLateBufferMinutes(value?: number | null) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return DEFAULT_LATE_BUFFER_MINUTES;
  return Math.max(0, Math.min(240, Math.floor(minutes)));
}

/** Clock time when the late buffer ends (shift start + buffer minutes), HH:MM. */
export function lateBufferUntil(
  shiftStart?: string | null,
  bufferMinutes = DEFAULT_LATE_BUFFER_MINUTES
) {
  if (!shiftStart) return DEFAULT_LATE_BUFFER_UNTIL;
  const until = addMinutesToTime(shiftStart, normalizeLateBufferMinutes(bufferMinutes));
  return until.slice(0, 5);
}

/** Minutes from shift start to a late-until clock (clamped 0–240). */
export function lateBufferMinutesFromUntil(
  shiftStart?: string | null,
  untilClock?: string | null
) {
  if (!shiftStart || !untilClock) return DEFAULT_LATE_BUFFER_MINUTES;
  const mins = Math.round(minutesBetween(shiftStart, untilClock));
  if (!Number.isFinite(mins) || mins < 0) return 0;
  return Math.max(0, Math.min(240, mins));
}

/** The buffer includes the full cutoff minute: 08:45 + 20m permits through 09:05:59. */
export function isLateCheckIn(
  checkIn?: string | null,
  shiftStart?: string | null,
  bufferMinutes = DEFAULT_LATE_BUFFER_MINUTES
) {
  if (!checkIn || !shiftStart) return false;
  const checkInSeconds = timeToSeconds(checkIn);
  const shiftSeconds = timeToSeconds(shiftStart);
  if (checkInSeconds == null || shiftSeconds == null) return false;
  return checkInSeconds >= shiftSeconds + (normalizeLateBufferMinutes(bufferMinutes) + 1) * 60;
}

/** If late (and not waived), work counts from check_in + 15 minutes */
export function effectiveWorkStart(
  checkIn?: string | null,
  shiftStart?: string | null,
  penaltyWaived = false,
  bufferMinutes = DEFAULT_LATE_BUFFER_MINUTES
) {
  if (!checkIn) return null;
  if (!penaltyWaived && isLateCheckIn(checkIn, shiftStart, bufferMinutes)) {
    return addMinutesToTime(checkIn, LATE_CHECKIN_PENALTY_MINUTES);
  }
  return checkIn;
}

/** Decimal hours → compact daily target e.g. 8.25 → "8h 15m", 4.125 → "4h 7.5m" */
export function formatDailyHours(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '';
  const totalSec = Math.round(Number(n) * 3600);
  const h = Math.floor(totalSec / 3600);
  const rem = totalSec % 3600;
  const mWhole = Math.floor(rem / 60);
  const s = rem % 60;
  if (s === 0) return `${h}h ${mWhole}m`;
  if (s === 30) return `${h}h ${mWhole}.5m`;
  return `${h}h ${mWhole}m ${s}s`;
}

/** Default half-day duration from a full-day target (8h 15m → 4h 7.5m). */
export function defaultHalfDayHours(fullDayHours: number) {
  return Math.round((Number(fullDayHours) / 2) * 10000) / 10000;
}

/** Parse "8h 15m", "4h 7.5m", "8:15", or "8.25" → decimal hours; null if invalid */
export function parseDailyHours(value?: string | number | null): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const str = String(value).trim();
  if (!str) return null;

  const hm = str.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/i);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (m >= 60 || h < 0) return null;
    return h + m / 60;
  }

  const hOnly = str.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/i);
  if (hOnly) return Number(hOnly[1]);

  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    if (parts.length >= 2 && !parts.some((n) => Number.isNaN(n))) {
      const [h, m, s = 0] = parts;
      if (m >= 60 || s >= 60 || h < 0) return null;
      return h + m / 60 + s / 3600;
    }
  }

  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = Number(str);
    return n > 0 ? n : null;
  }

  return null;
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
