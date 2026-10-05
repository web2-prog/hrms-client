import { displayClock } from '../utils/timeFormat';

export type BreakSegment = { start?: string | null; end?: string | null };

export function normalizeBreakSegments(att?: {
  breaks?: BreakSegment[] | null;
  break_started_at?: string | null;
} | null) {
  const list = Array.isArray(att?.breaks)
    ? att.breaks
        .filter((b) => b?.start)
        .map((b) => ({ start: String(b.start), end: b.end ? String(b.end) : null }))
    : [];
  if (att?.break_started_at && !list.some((b) => !b.end)) {
    list.push({ start: att.break_started_at, end: null });
  }
  return list;
}

/** Start and end clock for each break. An open break shows "ongoing". */
export function BreakSegmentList({
  breaks,
  breakStartedAt,
}: {
  breaks?: BreakSegment[] | null;
  breakStartedAt?: string | null;
}) {
  const segments = normalizeBreakSegments({ breaks, break_started_at: breakStartedAt });
  if (!segments.length) return null;
  return (
    <div className="break-segments">
      {segments.map((b, i) => (
        <div key={`${b.start}-${b.end || 'open'}-${i}`} className="break-segment">
          {displayClock(b.start)} – {b.end ? displayClock(b.end) : 'ongoing'}
        </div>
      ))}
    </div>
  );
}
