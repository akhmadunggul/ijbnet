import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import type { RecruiterBatchResponse } from '../../types/recruiter';

const IconClipboard = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
  </svg>
);
const IconUsers = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconCheckCircle = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconBell = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconLogOut = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function RecruiterLayout() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Default to Japanese for recruiter role
  useEffect(() => {
    if (!localStorage.getItem('ijbnet-lang')) {
      i18n.changeLanguage('ja');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: batchData } = useQuery<RecruiterBatchResponse>({
    queryKey: ['recruiter-batch'],
    queryFn: () => api.get('/recruiter/batch').then((r) => r.data),
    staleTime: 60_000,
  });

  const unreadCount: number =
    useQuery<{ unreadCount: number }>({
      queryKey: ['notifications-count'],
      queryFn: () => api.get('/notifications?limit=1&unread=true').then((r) => r.data),
      refetchInterval: 60_000,
    }).data?.unreadCount ?? 0;

  const lang = i18n.language;
  const company = batchData?.batch?.company;

  const navItems = [
    { to: '/recruiter/requests',      icon: <IconClipboard />,   ja: '候補者依頼', id: 'Permintaan Kandidat' },
    { to: '/recruiter/selection',     icon: <IconUsers />,       ja: '選考中',     id: 'Dalam Seleksi' },
    { to: '/recruiter/confirmed',     icon: <IconCheckCircle />, ja: '選択済み',   id: 'Dipilih' },
    { to: '/recruiter/interviews',    icon: <IconCalendar />,    ja: '面接',       id: 'Wawancara' },
    { to: '/recruiter/notifications', icon: <IconBell />,        ja: '通知',       id: 'Notifikasi' },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
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
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl text-white">IJBNet</span>
            <span className="text-xs text-white/40 mt-0.5">{lang === 'ja' ? '採用' : 'Rekruter'}</span>
          </div>
          {company && (
            <p className="text-xs text-white/50 mt-1 truncate">
              {lang === 'ja' && company.nameJa ? company.nameJa : company.name}
            </p>
          )}
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
                    ? 'bg-gold-400/10 text-gold-400 border-l-2 border-gold-400 pl-[10px]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{lang === 'ja' ? item.ja : item.id}</span>
              {item.to === '/recruiter/notifications' && unreadCount > 0 && (
                <span className="ml-auto bg-gold-400 text-navy-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-5">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <IconLogOut />
            <span>{lang === 'ja' ? 'ログアウト' : 'Keluar'}</span>
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
          {company && (
            <div className="hidden sm:block text-center flex-1">
              <p className="text-sm font-semibold text-navy-900 leading-none">
                {lang === 'ja' && company.nameJa ? company.nameJa : company.name}
              </p>
              {company.nameJa && lang !== 'ja' && (
                <p className="text-xs text-gray-400">{company.nameJa}</p>
              )}
            </div>
          )}
          {!company && <div className="flex-1" />}
          <button
            onClick={() => i18n.changeLanguage(lang === 'ja' ? 'id' : 'ja')}
            className="text-xs font-medium text-navy-700 border border-navy-100 rounded-full px-3 py-1 hover:bg-navy-50 transition"
          >
            {lang === 'ja' ? 'インドネシア語' : '日本語'}
          </button>
          <NavLink to="/recruiter/notifications" className="relative text-gray-500 hover:text-navy-700 p-1">
            <IconBell />
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
