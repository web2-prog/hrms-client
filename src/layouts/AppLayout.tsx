import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, type ListResult } from '../services/api';
import { fetchPendingRequestCount } from '../components/RequestCards';
import { Button } from '@/components/ui/button';
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
  Inbox,
} from 'lucide-react';

type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: 'leaves' | 'requests';
};
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
      { to: '/admin/requests', label: 'Requests', icon: Inbox, badgeKey: 'requests' },
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
    items: [
      { to: '/hr', end: true, label: 'Dashboard', icon: LayoutDashboard },
      { to: '/hr/profile', label: 'My Profile', icon: Users },
      { to: '/hr/my-attendance', label: 'My Attendance', icon: History },
    ],
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
      { to: '/hr/requests', label: 'Requests', icon: Inbox, badgeKey: 'requests' },
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
  { to: '/app/leaves', label: 'Leaves', icon: CalendarDays, badgeKey: 'leaves' },
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

function formatBadgeCount(n: number) {
  if (n > 99) return '99+';
  return String(n);
}

export function AppLayout({ variant }: { variant: 'admin' | 'hr' | 'employee' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const groups = variant === 'admin' ? adminGroups : variant === 'hr' ? hrGroups : null;
  // All links rendered flat together (no section-wise dropdowns)
  const links = groups ? groups.flatMap((g) => g.items) : empLinks;

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

  useEffect(() => {
    if (variant === 'employee') return;
    let alive = true;
    const loadPending = async () => {
      try {
        const [leavesRes, requestsTotal] = await Promise.all([
          api<ListResult<unknown>>('/leaves?limit=1&status=Pending'),
          fetchPendingRequestCount(),
        ]);
        if (!alive) return;
        setPendingLeaves(Number(leavesRes.total || 0));
        setPendingRequests(requestsTotal);
      } catch {
        if (alive) {
          setPendingLeaves(0);
          setPendingRequests(0);
        }
      }
    };
    loadPending();
    const id = window.setInterval(loadPending, 60_000);
    const onFocus = () => loadPending();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [location.pathname, variant]);

  const badgeFor = (key?: NavItem['badgeKey']) => {
    if (key === 'requests' && pendingRequests > 0) return pendingRequests;
    if (key === 'leaves' && pendingLeaves > 0) return pendingLeaves;
    return 0;
  };

  const renderLink = (l: NavItem) => {
    const count = badgeFor(l.badgeKey);
    return (
      <NavLink
        key={l.to}
        to={l.to}
        end={'end' in l ? l.end : false}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        <l.icon size={18} />
        <span className="sidebar-link-label">{l.label}</span>
        {count > 0 && (
          <span
            className="sidebar-alert-badge"
            title={`${count} pending request${count === 1 ? '' : 's'}`}
            aria-label={`${count} pending requests`}
          >
            {formatBadgeCount(count)}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
      {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} aria-hidden />}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <img className="brand-mark" src="/images/kriraai-logo.svg" alt="KriraAI" />
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
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
