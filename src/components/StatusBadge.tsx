import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatHours as formatHoursHMS } from '../utils/timeFormat';

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  let cls = 'badge-neutral';
  if (status === 'Extra' || status === 'General OT' || status === 'Success' || status === 'Approved' || status === 'Paid' || status === 'active' || status === 'Finalized' || status === 'Returned' || status === 'Completed' || status === 'Deduct' || status === 'Resolved')
    cls = 'badge-success';
  else if (status === 'Low' || status === 'Rejected' || status === 'inactive' || status === 'Error') cls = 'badge-error';
  else if (status === 'Pending' || status === 'Draft' || status === 'OnBreak' || status === 'Held' || status === 'Pending Decision' || status === 'Carry Forward') cls = 'badge-warn';
  else if (status === 'Working' || status === 'OnTime' || status === 'Active' || status === 'Management OT' || status === 'In Progress') cls = 'badge-info';

  if (status === 'Management OT') cls = 'badge-info';

  return <span className={`badge ${cls}`}>{status}</span>;
}

export function formatHours(n?: number) {
  return formatHoursHMS(n);
}

export function hoursBadge(surplus?: number, status?: string) {
  if (status === 'Extra' || status === 'General OT' || (surplus != null && surplus > 0)) {
    return <span className="badge badge-success">General OT +{formatHours(Math.abs(surplus || 0))}</span>;
  }
  if (status === 'Low' || (surplus != null && surplus < 0)) {
    return <span className="badge badge-error">Low −{formatHours(Math.abs(surplus || 0))}</span>;
  }
  if (status === 'OnTime') return <span className="badge badge-neutral">On time</span>;
  return status ? <StatusBadge status={status} /> : null;
}

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <div className="state-box">Access denied</div>;
  return <>{children}</>;
}
