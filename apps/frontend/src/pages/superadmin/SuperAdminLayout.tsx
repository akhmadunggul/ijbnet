import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

interface NotificationsCountResponse {
  unreadCount: number;
}

const navItems = [
  { to: '/superadmin/dashboard',  icon: '📊', key: 'navDashboard' },
  { to: '/superadmin/users',      icon: '👤', key: 'superadmin.users.title' },
  { to: '/superadmin/companies',  icon: '🏢', key: 'superadmin.companies.title' },
  { to: '/superadmin/lpks',       icon: '🏫', key: 'superadmin.lpks.title' },
  { to: '/superadmin/candidates', icon: '👥', key: 'navCandidates' },
  { to: '/superadmin/audit-log',  icon: '📋', key: 'superadmin.auditLog.title' },
  { to: '/superadmin/settings',   icon: '⚙️', key: 'navSettings' },
];

export default function SuperAdminLayout() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('ijbnet-lang')) {
      i18n.changeLanguage('ja');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount: number =
    useQuery<NotificationsCountResponse>({
      queryKey: ['notifications-count'],
      queryFn: () => api.get('/notifications?limit=1&unread=true').then((r) => r.data),
      refetchInterval: 60_000,
    }).data?.unreadCount ?? 0;

  const lang = i18n.language;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — darker navy for super admin */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#0F1E2D' }}
      >
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl text-white">IJBNet</span>
            <span className="text-xs bg-red-500 text-white rounded px-1.5 py-0.5 font-bold mt-0.5">
              Super Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-red-500/10 text-red-400 border-l-2 border-red-400 pl-[10px]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>

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

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 flex items-center gap-3 px-4 h-14 shadow-sm">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1" />
          <button
            onClick={() => i18n.changeLanguage(lang === 'ja' ? 'id' : 'ja')}
            className="text-xs font-medium text-gray-700 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-50 transition"
          >
            {lang === 'ja' ? 'Indonesia' : '日本語'}
          </button>
          <NavLink to="/superadmin/notifications" className="relative text-gray-500 hover:text-gray-700">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </NavLink>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
