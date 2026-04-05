import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import ConsentModal from '../../components/ConsentModal';
import type { CandidateMe } from '../../types/candidate';

export default function CandidateLayout() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  const { data, isLoading } = useQuery<CandidateMe>({
    queryKey: ['my-candidate'],
    queryFn: () => api.get('/candidates/me').then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (!data || consentChecked) return;
    setConsentChecked(true);
    if (!data.candidate?.consentGiven) {
      setShowConsent(true);
    }
  }, [data, consentChecked]);

  const unreadCount: number = useQuery<{ unreadCount: number }>({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications?limit=1&unread=true').then((r) => r.data),
    refetchInterval: 60_000,
  }).data?.unreadCount ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        {t('loading')}
      </div>
    );
  }

  const navItems = [
    { to: '/portal/dashboard', icon: '🏠', label: t('navDashboard') },
    { to: '/portal/profile', icon: '👤', label: t('navProfile') },
    { to: '/portal/notifications', icon: '🔔', label: t('navNotifications') },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Consent modal — blocks portal until accepted */}
      {showConsent && (
        <ConsentModal
          onAccept={() => setShowConsent(false)}
          onDecline={async () => { await logout(); }}
        />
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#1A2E44' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <span className="font-serif text-xl text-white">IJBNet</span>
          <span className="text-xs text-white/40 mt-0.5">Portal</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-gold-400/10 text-gold-400 border-l-2 border-gold-400 pl-[10px]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.to === '/portal/notifications' && unreadCount > 0 && (
                <span className="ml-auto bg-gold-400 text-navy-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <span>🚪</span>
            <span>{t('navLogout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 flex items-center gap-3 px-4 h-14 shadow-sm">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1" />
          {/* Language toggle */}
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'id' ? 'ja' : 'id')}
            className="text-xs font-medium text-navy-700 border border-navy-100 rounded-full px-3 py-1 hover:bg-navy-50 transition"
          >
            {i18n.language === 'id' ? '日本語' : 'Indonesia'}
          </button>
          {/* Bell */}
          <NavLink to="/portal/notifications" className="relative text-gray-500 hover:text-navy-700">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-gold-400 text-navy-900 text-[10px] font-bold px-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </NavLink>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
