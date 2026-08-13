import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeForRole, isRoleAllowed, type AppRole } from '../lib/authRoutes';

function LoadingState() {
  return <div className="state-box">Loading…</div>;
}

/** Requires authentication and one of the allowed roles. */
export function RouteGuard({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isRoleAllowed(user.role, roles)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

/** Login and other public pages — redirect authenticated users to their portal. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

/** Root path: send users to login or their role home. */
export function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />;
}
