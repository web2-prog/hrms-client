import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  CalendarDays,
  Palmtree,
  Wallet,
  ScrollText,
  Settings,
  LogOut,
  TrendingUp,
  Timer,
  Menu,
  X,
  ClipboardList,
  BarChart3,
  BookOpen,
  Headphones,
  Sun,
  History,
  KeyRound,
} from 'lucide-react';

type NavItem = { to: string; end?: boolean; label: string; icon: typeof LayoutDashboard };
type NavGroup = { title: string; items: NavItem[] };

const adminGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'People',
    items: [
      { to: '/admin/departments', label: 'Departments', icon: Building2 },
      { to: '/admin/employees', label: 'Employees', icon: Users },
      { to: '/admin/summary', label: 'Emp. Summary', icon: ClipboardList },
    ],
  },
  {
    title: 'Time & Work',
    items: [
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/today', label: 'Today', icon: Sun },
      { to: '/admin/attendance', label: 'Attendance', icon: Clock },
      { to: '/admin/performance', label: 'Performance', icon: TrendingUp },
      { to: '/admin/overtime', label: 'Overtime', icon: Timer },
    ],
  },
  {
    title: 'Calendar',
    items: [
      { to: '/admin/leaves', label: 'Leaves', icon: CalendarDays },
      { to: '/admin/holidays', label: 'Holidays', icon: Palmtree },
    ],
  },
  {
    title: 'Documents',
    items: [
      { to: '/admin/policies', label: 'Policies', icon: BookOpen },
      { to: '/admin/helpdesk', label: 'Helpdesk', icon: Headphones },
      { to: '/admin/salary', label: 'Salary', icon: Wallet },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/global', label: 'Global / Bulk', icon: Settings },
      { to: '/admin/audit', label: 'Audit', icon: ScrollText },
    ],
  },
];

const hrGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ to: '/hr', end: true, label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'People',
    items: [
      { to: '/hr/departments', label: 'Departments', icon: Building2 },
      { to: '/hr/employees', label: 'Employees', icon: Users },
      { to: '/hr/summary', label: 'Emp. Summary', icon: ClipboardList },
    ],
  },
  {
    title: 'Time & Work',
    items: [
      { to: '/hr/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/hr/today', label: 'Today', icon: Sun },
      { to: '/hr/attendance', label: 'Attendance', icon: Clock },
      { to: '/hr/performance', label: 'Performance', icon: TrendingUp },
      { to: '/hr/overtime', label: 'Overtime', icon: Timer },
    ],
  },
  {
    title: 'Calendar',
    items: [
      { to: '/hr/leaves', label: 'Leaves', icon: CalendarDays },
      { to: '/hr/holidays', label: 'Holidays', icon: Palmtree },
    ],
  },
  {
    title: 'Documents',
    items: [
      { to: '/hr/policies', label: 'Policies', icon: BookOpen },
      { to: '/hr/helpdesk', label: 'Helpdesk', icon: Headphones },
      { to: '/hr/salary', label: 'Salary', icon: Wallet },
    ],
  },
];

const empLinks: NavItem[] = [
  { to: '/app', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/attendance', label: 'Attendance History', icon: History },
  { to: '/app/profile', label: 'Profile', icon: Users },
  { to: '/app/salary', label: 'Salary Slip', icon: Wallet },
  { to: '/app/overtime', label: 'Overtime', icon: Timer },
  { to: '/app/leaves', label: 'Leaves', icon: CalendarDays },
  { to: '/app/holidays', label: 'Holidays', icon: Palmtree },
  { to: '/app/policies', label: 'Policies', icon: BookOpen },
  { to: '/app/helpdesk', label: 'Helpdesk', icon: Headphones },
];

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function AppLayout({ variant }: { variant: 'admin' | 'hr' | 'employee' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwOk, setPwOk] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const groups = variant === 'admin' ? adminGroups : variant === 'hr' ? hrGroups : null;
  // All links rendered flat together (no section-wise dropdowns)
  const links = groups ? groups.flatMap((g) => g.items) : empLinks;

  const openPasswordDialog = () => {
    setPw({ current: '', next: '', confirm: '' });
    setPwErr('');
    setPwOk('');
    setPwOpen(true);
  };

  const submitPassword = async () => {
    setPwErr('');
    setPwOk('');
    if (!pw.current || !pw.next) {
      setPwErr('Enter both the current and new password.');
      return;
    }
    if (pw.next.length < 6) {
      setPwErr('New password must be at least 6 characters.');
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwErr('New password and confirmation do not match.');
      return;
    }
    setPwBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: pw.current, new_password: pw.next },
      });
      setPwOk('Password updated successfully.');
      window.setTimeout(() => setPwOpen(false), 1200);
    } catch (e) {
      setPwErr(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setPwBusy(false);
    }
  };

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const renderLink = (l: NavItem) => (
    <NavLink
      key={l.to}
      to={l.to}
      end={'end' in l ? l.end : false}
      className={({ isActive }) => (isActive ? 'active' : '')}
    >
      <l.icon size={18} />
      {l.label}
    </NavLink>
  );

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
      {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} aria-hidden />}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark">H</span>
          <span className="brand-text">
            HRMS
            <small>{variant} portal</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Portal pages">
          {links.map(renderLink)}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="topbar-user">
              <div className="topbar-avatar" aria-hidden>
                {initials(user?.name)}
              </div>
              <div className="topbar-meta">
                <span className="topbar-name">{user?.name || 'User'}</span>
                <span className="topbar-role">{user?.role}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={openPasswordDialog} title="Change your password">
            <KeyRound size={16} />
            Change Password
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={16} />
            Logout
          </Button>
        </header>
        <Dialog open={pwOpen} onOpenChange={(o) => !o && setPwOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Update the password you use to sign in to the {variant} portal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <label className="label" htmlFor="pw-current">
                Current password
              </label>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              />
              <label className="label" htmlFor="pw-new">
                New password
              </label>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
              <label className="label" htmlFor="pw-confirm">
                Confirm new password
              </label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
              {pwErr && <p style={{ color: 'var(--error)', margin: 0 }}>{pwErr}</p>}
              {pwOk && <p style={{ color: 'var(--success)', margin: 0 }}>{pwOk}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={pwBusy} onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
              <Button disabled={pwBusy || !pw.current || !pw.next || !pw.confirm} onClick={submitPassword}>
                {pwBusy ? 'Updating…' : 'Update password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
