import type { User } from '../context/AuthContext';

export type AppRole = User['role'];

export const ROLE_HOME: Record<AppRole, string> = {
  admin: '/admin',
  hr: '/hr',
  employee: '/app',
};

export function homeForRole(role: AppRole): string {
  return ROLE_HOME[role] ?? '/login';
}

export function isRoleAllowed(role: AppRole, allowed: AppRole[]): boolean {
  return allowed.includes(role);
}
