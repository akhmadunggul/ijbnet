import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import LoginPage, { OAuthCallbackPage } from './pages/LoginPage';
import CandidateLayout from './pages/candidate/CandidateLayout';
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateNotifications from './pages/candidate/CandidateNotifications';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCandidates from './pages/admin/AdminCandidates';
import AdminCandidateDetail from './pages/admin/AdminCandidateDetail';
import AdminBodyCheck from './pages/admin/AdminBodyCheck';
import AdminVideos from './pages/admin/AdminVideos';
import AdminNotifications from './pages/admin/AdminNotifications';
import RecruiterLayout from './pages/recruiter/RecruiterLayout';
import RecruiterSelection from './pages/recruiter/RecruiterSelection';
import RecruiterConfirmed from './pages/recruiter/RecruiterConfirmed';
import RecruiterInterviews from './pages/recruiter/RecruiterInterviews';
import RecruiterNotifications from './pages/recruiter/RecruiterNotifications';
import ManagerLayout from './pages/manager/ManagerLayout';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ManagerCandidates from './pages/manager/ManagerCandidates';
import ManagerCandidateDetail from './pages/manager/ManagerCandidateDetail';
import ManagerBatches from './pages/manager/ManagerBatches';
import ManagerBatchDetail from './pages/manager/ManagerBatchDetail';
import ManagerInterviews from './pages/manager/ManagerInterviews';
import ManagerNotifications from './pages/manager/ManagerNotifications';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminUsers from './pages/superadmin/SuperAdminUsers';
import SuperAdminCompanies from './pages/superadmin/SuperAdminCompanies';
import SuperAdminLpks from './pages/superadmin/SuperAdminLpks';
import SuperAdminCandidates from './pages/superadmin/SuperAdminCandidates';
import SuperAdminAuditLog from './pages/superadmin/SuperAdminAuditLog';
import SuperAdminSettings from './pages/superadmin/SuperAdminSettings';
import SuperAdminConsent from './pages/superadmin/SuperAdminConsent';
import type { UserRole } from '@ijbnet/shared';

const queryClient = new QueryClient();

const ROLE_HOMES: Record<UserRole, string> = {
  candidate: '/portal/dashboard',
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  recruiter: '/recruiter/selection',
  super_admin: '/superadmin/dashboard',
};

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
      {label} — Coming soon
    </div>
  );
}

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: UserRole[];
}) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user } = useAuthStore();
  if (user) return <Navigate to={ROLE_HOMES[user.role]} replace />;
  return <Navigate to="/auth/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        {/* Root */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Candidate portal */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute roles={['candidate']}>
              <CandidateLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CandidateDashboard />} />
          <Route path="profile" element={<CandidateProfile />} />
          <Route path="notifications" element={<CandidateNotifications />} />
        </Route>

        {/* Admin portal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="candidates" element={<AdminCandidates />} />
          <Route path="candidates/:id" element={<AdminCandidateDetail />} />
          <Route path="body-check/:id" element={<AdminBodyCheck />} />
          <Route path="videos/:id" element={<AdminVideos />} />
          <Route path="notifications" element={<AdminNotifications />} />
        </Route>

        {/* Manager portal */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute roles={['manager']}>
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="candidates" element={<ManagerCandidates />} />
          <Route path="candidates/:id" element={<ManagerCandidateDetail />} />
          <Route path="batches" element={<ManagerBatches />} />
          <Route path="batches/:id" element={<ManagerBatchDetail />} />
          <Route path="interviews" element={<ManagerInterviews />} />
          <Route path="notifications" element={<ManagerNotifications />} />
        </Route>

        {/* Recruiter portal */}
        <Route
          path="/recruiter"
          element={
            <ProtectedRoute roles={['recruiter']}>
              <RecruiterLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="selection" replace />} />
          <Route path="selection" element={<RecruiterSelection />} />
          <Route path="confirmed" element={<RecruiterConfirmed />} />
          <Route path="interviews" element={<RecruiterInterviews />} />
          <Route path="notifications" element={<RecruiterNotifications />} />
        </Route>

        {/* Super Admin */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute roles={['super_admin']}>
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="users" element={<SuperAdminUsers />} />
          <Route path="companies" element={<SuperAdminCompanies />} />
          <Route path="lpks" element={<SuperAdminLpks />} />
          <Route path="candidates" element={<SuperAdminCandidates />} />
          <Route path="audit-log" element={<SuperAdminAuditLog />} />
          <Route path="consent" element={<SuperAdminConsent />} />
          <Route path="settings" element={<SuperAdminSettings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
