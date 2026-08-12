import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatHours as formatHoursHMS } from '../utils/timeFormat';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Maps a status string to a DESIGN.md status variant used by the Badge. */
export function statusVariant(status?: string): string {
  if (!status) return 'secondary';
  if (
    status === 'Extra' ||
    status === 'General OT' ||
    status === 'OnOvertime' ||
    status === 'Success' ||
    status === 'Approved' ||
    status === 'Paid' ||
    status === 'active' ||
    status === 'Finalized' ||
    status === 'Returned' ||
    status === 'Completed' ||
    status === 'Deduct' ||
    status === 'Resolved'
  )
    return 'success';
  if (status === 'Low' || status === 'Rejected' || status === 'inactive' || status === 'Error') return 'destructive';
  if (
    status === 'Pending' ||
    status === 'Draft' ||
    status === 'OnBreak' ||
    status === 'Held' ||
    status === 'Pending Decision' ||
    status === 'Carry Forward'
  )
    return 'warning';
  if (
    status === 'Working' ||
    status === 'OnTime' ||
    status === 'Active' ||
    status === 'Management OT' ||
    status === 'In Progress'
  )
    return 'info';
  return 'secondary';
}

/** Human-readable label for attendance / workflow statuses. */
export function statusLabel(status?: string) {
  if (!status) return '';
  if (status === 'OnBreak') return 'On break';
  if (status === 'OnOvertime') return 'On overtime';
  if (status === 'OnTime') return 'On time';
  if (status === 'Working') return 'Working';
  if (status === 'Absent') return 'Absent';
  return status;
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <Badge variant={statusVariant(status) as 'secondary'}>{statusLabel(status)}</Badge>
  );
}

export function formatHours(n?: number) {
  return formatHoursHMS(n);
}

export function hoursBadge(surplus?: number, status?: string) {
  // Live day states take priority over OT/shortfall badges
  if (status === 'OnBreak') {
    return <Badge variant="warning">{statusLabel(status)}</Badge>;
  }
  if (status === 'Working') {
    return <Badge variant="info">{statusLabel(status)}</Badge>;
  }
  if (status === 'Extra' || status === 'General OT' || (surplus != null && surplus > 0)) {
    return (
      <Badge variant="success">
        General OT +{formatHours(Math.abs(surplus || 0))}
      </Badge>
    );
  }
  if (status === 'Low' || (surplus != null && surplus < 0)) {
    return (
      <Badge variant="destructive">
        Low −{formatHours(Math.abs(surplus || 0))}
      </Badge>
    );
  }
  if (status === 'OnTime') return <Badge variant="secondary">On time</Badge>;
  return status ? <StatusBadge status={status} /> : null;
}

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <div className={cn('state-box')}>Access denied</div>;
  return <>{children}</>;
}
