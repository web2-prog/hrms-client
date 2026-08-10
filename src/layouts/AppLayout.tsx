import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';

const adminLinks = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/summary', label: 'Emp. Summary', icon: ClipboardList },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/attendance', label: 'Attendance', icon: Clock },
  { to: '/admin/performance', label: 'Performance', icon: TrendingUp },
  { to: '/admin/overtime', label: 'Overtime', icon: Timer },
  { to: '/admin/leaves', label: 'Leaves', icon: CalendarDays },
  { to: '/admin/holidays', label: 'Holidays', icon: Palmtree },
  { to: '/admin/policies', label: 'Policies', icon: BookOpen },
  { to: '/admin/helpdesk', label: 'Helpdesk', icon: Headphones },
  { to: '/admin/salary', label: 'Salary', icon: Wallet },
  { to: '/admin/global', label: 'Global / Bulk', icon: Settings },
  { to: '/admin/audit', label: 'Audit', icon: ScrollText },
];

const hrLinks = [
  { to: '/hr', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/hr/employees', label: 'Employees', icon: Users },
  { to: '/hr/summary', label: 'Emp. Summary', icon: ClipboardList },
  { to: '/hr/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/hr/attendance', label: 'Attendance', icon: Clock },
  { to: '/hr/performance', label: 'Performance', icon: TrendingUp },
  { to: '/hr/overtime', label: 'Overtime', icon: Timer },
  { to: '/hr/leaves', label: 'Leaves', icon: CalendarDays },
  { to: '/hr/holidays', label: 'Holidays', icon: Palmtree },
  { to: '/hr/policies', label: 'Policies', icon: BookOpen },
  { to: '/hr/helpdesk', label: 'Helpdesk', icon: Headphones },
  { to: '/hr/salary', label: 'Salary', icon: Wallet },
];

const empLinks = [
  { to: '/app', end: true, label: 'Dashboard', icon: LayoutDashboard },
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
  const links = variant === 'admin' ? adminLinks : variant === 'hr' ? hrLinks : empLinks;

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
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={'end' in l ? l.end : false}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <l.icon size={18} />
              {l.label}
            </NavLink>
          ))}
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
          <button
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
