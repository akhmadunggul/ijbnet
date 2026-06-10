import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from './store/authStore';
import LoginPage, { OAuthCallbackPage } from './pages/LoginPage';
import CandidateLayout from './pages/candidate/CandidateLayout';
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateNotifications from './pages/candidate/CandidateNotifications';
import CandidateCVPage from './pages/candidate/CandidateCVPage';
import ShokumuResumePage from './pages/candidate/ShokumuResumePage';
import JpLearningPage from './pages/candidate/JpLearningPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCandidates from './pages/admin/AdminCandidates';
import AdminCandidateDetail from './pages/admin/AdminCandidateDetail';
import AdminCandidateCVPage from './pages/admin/AdminCandidateCVPage';
import AdminBodyCheck from './pages/admin/AdminBodyCheck';
import AdminVideos from './pages/admin/AdminVideos';
import AdminNotifications from './pages/admin/AdminNotifications';
import RecruiterLayout from './pages/recruiter/RecruiterLayout';
import RecruiterSelection from './pages/recruiter/RecruiterSelection';
import RecruiterCandidateCVPage from './pages/recruiter/RecruiterCandidateCVPage';
import RecruiterShokumuPage from './pages/recruiter/RecruiterShokumuPage';
import RecruiterConfirmed from './pages/recruiter/RecruiterConfirmed';
import RecruiterInterviews from './pages/recruiter/RecruiterInterviews';
import RecruiterNotifications from './pages/recruiter/RecruiterNotifications';
import RecruiterRequests from './pages/recruiter/RecruiterRequests';
import ManagerLayout from './pages/manager/ManagerLayout';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ManagerCandidates from './pages/manager/ManagerCandidates';
import ManagerCandidateDetail from './pages/manager/ManagerCandidateDetail';
import ManagerCandidateCVPage from './pages/manager/ManagerCandidateCVPage';
import ManagerBatches from './pages/manager/ManagerBatches';
import ManagerBatchDetail from './pages/manager/ManagerBatchDetail';
import ManagerInterviews from './pages/manager/ManagerInterviews';
import ManagerNotifications from './pages/manager/ManagerNotifications';
import ManagerRequests from './pages/manager/ManagerRequests';
import ManagerNotifyPage from './pages/manager/ManagerNotifyPage';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminUsers from './pages/superadmin/SuperAdminUsers';
import SuperAdminCompanies from './pages/superadmin/SuperAdminCompanies';
import SuperAdminLpks from './pages/superadmin/SuperAdminLpks';
import SuperAdminCandidates from './pages/superadmin/SuperAdminCandidates';
import SuperAdminAuditLog from './pages/superadmin/SuperAdminAuditLog';
import SuperAdminSettings from './pages/superadmin/SuperAdminSettings';
import SuperAdminConsent from './pages/superadmin/SuperAdminConsent';
import SuperAdminDataEntrySettings from './pages/superadmin/SuperAdminDataEntrySettings';
import SuperAdminRecruiterSettings from './pages/superadmin/SuperAdminRecruiterSettings';
import SuperAdminMonitor from './pages/superadmin/SuperAdminMonitor';
import SuperAdminSurveys from './pages/superadmin/SuperAdminSurveys';
import SurveyPublicPage from './pages/SurveyPublicPage';
import HiringLetterPage from './pages/HiringLetterPage';
import type { UserRole } from '@ijbnet/shared';

const queryClient = new QueryClient();

const ROLE_HOMES: Record<UserRole, string> = {
  candidate: '/portal/dashboard',
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  recruiter: '/recruiter/requests',
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

// Eagerly restores the access token from the refresh cookie on page load.
// accessToken is in-memory only — without this, the first authenticated API call
// after a page refresh would fire with no token and receive a 401.
function AuthInitializer() {
  const { login, logout } = useAuthStore();

  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    axios
      .post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
      .then(res => { login(res.data.accessToken, user); })
      .catch(() => { logout(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
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
      <AuthInitializer />
      <Routes>
        {/* Root */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/angket" element={<SurveyPublicPage />} />

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
          <Route path="cv" element={<CandidateCVPage />} />
          <Route path="shokumu" element={<ShokumuResumePage />} />
          <Route path="letter/:proposalId" element={<HiringLetterPage />} />
          <Route path="jp-learning" element={<JpLearningPage />} />
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
          <Route path="candidates/:id/cv" element={<AdminCandidateCVPage />} />
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
          <Route path="candidates/:id/cv" element={<ManagerCandidateCVPage />} />
          <Route path="letter/:proposalId" element={<HiringLetterPage />} />
          <Route path="batches" element={<ManagerBatches />} />
          <Route path="batches/:id" element={<ManagerBatchDetail />} />
          <Route path="requests" element={<ManagerRequests />} />
          <Route path="interviews" element={<ManagerInterviews />} />
          <Route path="notifications" element={<ManagerNotifications />} />
          <Route path="notify" element={<ManagerNotifyPage />} />
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
          <Route index element={<Navigate to="requests" replace />} />
          <Route path="requests" element={<RecruiterRequests />} />
          <Route path="selection" element={<RecruiterSelection />} />
          <Route path="candidates/:id/cv" element={<RecruiterCandidateCVPage />} />
          <Route path="candidates/:id/shokumu" element={<RecruiterShokumuPage />} />
          <Route path="letter/:proposalId" element={<HiringLetterPage />} />
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
          <Route path="data-entry-settings" element={<SuperAdminDataEntrySettings />} />
          <Route path="recruiter-settings" element={<SuperAdminRecruiterSettings />} />
          <Route path="settings" element={<SuperAdminSettings />} />
          <Route path="monitor" element={<SuperAdminMonitor />} />
          <Route path="surveys" element={<SuperAdminSurveys />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
