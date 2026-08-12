import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import LoginPage from './pages/auth/Login';
import DepartmentsPage from './pages/shared/Departments';
import { EmployeesPage, EmployeeManagePage } from './pages/shared/Employees';
import EmployeeSummaryPage from './pages/shared/EmployeeSummary';
import AnalyticsPage from './pages/shared/Analytics';
import { AttendancePage } from './pages/shared/Attendance';
import { TodayAttendancePage } from './pages/shared/Today';
import { LeavesPage } from './pages/shared/Leaves';
import { HolidaysPage } from './pages/shared/Holidays';
import { PoliciesPage } from './pages/shared/Policies';
import { HelpdeskPage } from './pages/shared/Helpdesk';
import { SalaryPage } from './pages/shared/Salary';
import { PerformancePage } from './pages/shared/Performance';
import { OvertimePage } from './pages/shared/Overtime';
import {
  AdminDashboard,
  EmployeeDashboard,
  HrDashboard,
  ProfilePage,
  GlobalDataPage,
  AuditPage,
} from './pages/shared/Dashboards';

function Guard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="state-box">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'hr') return <Navigate to="/hr" replace />;
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <Guard roles={['admin']}>
            <AppLayout variant="admin" />
          </Guard>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="employees" element={<EmployeesPage basePath="/admin" />} />
        <Route path="employees/:id" element={<EmployeeManagePage basePath="/admin" />} />
        <Route path="summary" element={<EmployeeSummaryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="attendance" element={<AttendancePage allowBulk />} />
        <Route path="today" element={<TodayAttendancePage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="overtime" element={<OvertimePage />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="helpdesk" element={<HelpdeskPage />} />
        <Route path="salary" element={<SalaryPage allowBulk />} />
        <Route path="global" element={<GlobalDataPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route
        path="/hr"
        element={
          <Guard roles={['hr']}>
            <AppLayout variant="hr" />
          </Guard>
        }
      >
        <Route index element={<HrDashboard />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="employees" element={<EmployeesPage basePath="/hr" />} />
        <Route path="employees/:id" element={<EmployeeManagePage basePath="/hr" />} />
        <Route path="summary" element={<EmployeeSummaryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="today" element={<TodayAttendancePage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="overtime" element={<OvertimePage />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="policies" element={<PoliciesPage canManage={false} />} />
        <Route path="helpdesk" element={<HelpdeskPage />} />
        <Route path="salary" element={<SalaryPage />} />
      </Route>
      <Route
        path="/app"
        element={
          <Guard roles={['employee', 'admin', 'hr']}>
            <AppLayout variant="employee" />
          </Guard>
        }
      >
        <Route index element={<EmployeeDashboard />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="salary" element={<SalaryPage />} />
        <Route path="overtime" element={<OvertimePage />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="holidays" element={<HolidaysPage canManage={false} />} />
        <Route path="policies" element={<PoliciesPage canManage={false} />} />
        <Route path="helpdesk" element={<HelpdeskPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
