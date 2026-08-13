import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { RouteGuard, GuestGuard, RootRedirect } from './components/RouteGuard';
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <GuestGuard>
            <LoginPage />
          </GuestGuard>
        }
      />
      <Route
        path="/admin"
        element={
          <RouteGuard roles={['admin']}>
            <AppLayout variant="admin" />
          </RouteGuard>
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
          <RouteGuard roles={['hr']}>
            <AppLayout variant="hr" />
          </RouteGuard>
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
          <RouteGuard roles={['employee']}>
            <AppLayout variant="employee" />
          </RouteGuard>
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
      <Route path="*" element={<Navigate to="/" replace />} />
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
