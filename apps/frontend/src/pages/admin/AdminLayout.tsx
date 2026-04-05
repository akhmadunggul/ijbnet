import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import type { AdminDashboardData } from '../../types/admin';

export default function AdminLayout() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: dashData } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data),
    staleTime: 60_000,
  });

  const unreadCount: number = useQuery<{ unreadCount: number }>({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications?limit=1&unread=true').then((r) => r.data),
    refetchInterval: 60_000,
  }).data?.unreadCount ?? 0;

  const navItems = [
    { to: '/admin/dashboard', icon: '🏠', label: t('navDashboard') },
    { to: '/admin/candidates', icon: '👥', label: t('navCandidates') },
    { to: '/admin/notifications', icon: '🔔', label: t('navNotifications') },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
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
        {/* Logo + LPK name */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl text-white">IJBNet</span>
            <span className="text-xs text-white/40 mt-0.5">Admin</span>
          </div>
          {dashData?.lpk?.name && (
            <p className="text-xs text-white/50 mt-1 truncate">{dashData.lpk.name}</p>
          )}
        </div>

        {/* Nav */}
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
              {item.to === '/admin/notifications' && unreadCount > 0 && (
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
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'id' ? 'ja' : 'id')}
            className="text-xs font-medium text-navy-700 border border-navy-100 rounded-full px-3 py-1 hover:bg-navy-50 transition"
          >
            {i18n.language === 'id' ? '日本語' : 'Indonesia'}
          </button>
          <NavLink to="/admin/notifications" className="relative text-gray-500 hover:text-navy-700">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-gold-400 text-navy-900 text-[10px] font-bold px-1 rounded-full">
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
