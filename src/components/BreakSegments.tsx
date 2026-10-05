import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

function formatSegment(b: { start: string; end: string | null }) {
  return `${displayClock(b.start)} – ${b.end ? displayClock(b.end) : 'ongoing'}`;
}

/** Start and end clock for each break. More than two shows +N; hover lists the rest. */
export function BreakSegmentList({
  breaks,
  breakStartedAt,
}: {
  breaks?: BreakSegment[] | null;
  breakStartedAt?: string | null;
}) {
  const segments = normalizeBreakSegments({ breaks, break_started_at: breakStartedAt });
  if (!segments.length) return null;
  const visible = segments.slice(0, 2);
  const extra = segments.slice(2);
  return (
    <div className="break-segments">
      {visible.map((b, i) => (
        <div key={`${b.start}-${b.end || 'open'}-${i}`} className="break-segment">
          {formatSegment(b)}
        </div>
      ))}
      {extra.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger type="button" className="break-segment-more">
              +{extra.length}
            </TooltipTrigger>
            <TooltipContent side="top" className="break-segment-pop">
              {extra.map((b, i) => (
                <div key={`${b.start}-${b.end || 'open'}-${i}`}>{formatSegment(b)}</div>
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
