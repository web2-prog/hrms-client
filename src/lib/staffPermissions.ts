/** Shared HR/Admin permission helpers for attendance edits and request decisions. */

export type StaffUser = {
  _id: string;
  role: 'admin' | 'hr' | 'employee';
};

export type TargetRef = {
  _id?: string;
  role?: 'admin' | 'hr' | 'employee' | string;
} | string | null | undefined;

function idOf(target: TargetRef): string | null {
  if (!target) return null;
  if (typeof target === 'string') return target;
  return target._id ? String(target._id) : null;
}

function roleOf(target: TargetRef): string | null {
  if (!target || typeof target === 'string') return null;
  return target.role ? String(target.role) : null;
}

export function isElevatedRole(role?: string | null) {
  return role === 'admin' || role === 'hr';
}

/** HR cannot edit own / Admin·HR time; only Admin may. */
export function canManageAttendanceTime(actor: StaffUser | null | undefined, target: TargetRef) {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  const targetId = idOf(target);
  if (targetId && String(actor._id) === targetId) return false;
  const targetRole = roleOf(target);
  if (isElevatedRole(targetRole)) return false;
  return actor.role === 'hr';
}

/** Nobody decides own request; only Admin decides Admin/HR requests. */
export function canDecideRequest(actor: StaffUser | null | undefined, target: TargetRef) {
  if (!actor) return false;
  if (actor.role !== 'admin' && actor.role !== 'hr') return false;
  const targetId = idOf(target);
  if (targetId && String(actor._id) === targetId) return false;
  const targetRole = roleOf(target);
  if (isElevatedRole(targetRole) && actor.role !== 'admin') return false;
  return true;
}
