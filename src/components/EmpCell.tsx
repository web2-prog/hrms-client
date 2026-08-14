function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

/** Table cell showing an employee as an initials tile + name/department. */
export function EmpCell({ name, dept }: { name?: string; dept?: string }) {
  return (
    <div className="emp-cell">
      <span className="emp-avatar-sm">{initials(name)}</span>
      <div className="emp-cell-text">
        <strong>{name || '—'}</strong>
        <span>{dept || 'Unassigned'}</span>
      </div>
    </div>
  );
}
