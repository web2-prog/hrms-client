/** Shared attendance / duration formatters (second precision). */

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse HH:MM or HH:MM:SS → total seconds from midnight */
export function timeToSeconds(t?: string | null): number | null {
  if (!t) return null;
  const parts = t.trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [h, m, s = 0] = parts;
  return h * 3600 + m * 60 + s;
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

/** Ensure clock time shows seconds when present; leave as-is otherwise */
export function displayClock(t?: string | null) {
  if (!t) return '—';
  const parts = t.split(':');
  if (parts.length === 2) return `${t}:00`;
  return t;
}
