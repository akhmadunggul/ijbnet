import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { NotificationData } from '../types/candidate';

interface NotificationsResponse {
  notifications: NotificationData[];
  unreadCount: number;
}

const TYPE_ICONS: Record<string, string> = {
  PROFILE_SUBMITTED:    '📋',
  STATUS_CHANGED:       '🔄',
  PROFILE_CONFIRMED:    '✅',
  BATCH_SELECTED:       '👥',
  BATCH_ACTIVATED:      '📦',
  CANDIDATE_CONFIRMED:  '✅',
  INTERVIEW_PROPOSED:   '📅',
  INTERVIEW_SCHEDULED:  '📅',
  INTERVIEW_RESULT:     '🏆',
};

function getIcon(type: string | null): string {
  return TYPE_ICONS[type ?? ''] ?? '🔔';
}

function formatRelative(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60)  return lang === 'ja' ? `${mins}分前`  : `${mins} menit lalu`;
  if (hrs < 24)   return lang === 'ja' ? `${hrs}時間前` : `${hrs} jam lalu`;
  if (days < 7)   return lang === 'ja' ? `${days}日前`  : `${days} hari lalu`;
  return new Date(iso).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function letterViewPath(role: string | undefined, referenceId: string): string {
  if (role === 'manager')   return `/manager/letter/${referenceId}`;
  if (role === 'recruiter') return `/recruiter/letter/${referenceId}`;
  return `/portal/letter/${referenceId}`;
}

function NotifItem({
  n,
  onMarkRead,
  isPending,
  userRole,
}: {
  n: NotificationData;
  onMarkRead: (id: string) => void;
  isPending: boolean;
  userRole: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;
  const isLetter = n.referenceType === 'hiring_letter' && n.referenceId;

  return (
    <li
      onClick={() => { if (!n.isRead && !isPending) onMarkRead(n.id); }}
      className={`bg-white rounded-xl p-4 flex items-start gap-3 transition border ${
        n.isRead
          ? 'border-gray-100 hover:bg-gray-50'
          : 'border-navy-100 bg-navy-50/20 hover:bg-navy-50/40 cursor-pointer'
      }`}
    >
      <span className="text-xl shrink-0 mt-0.5">{getIcon(n.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{n.title}</p>
        {n.body && <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>}
        {isLetter && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(letterViewPath(userRole, n.referenceId!)); }}
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-navy-700 bg-navy-50 border border-navy-100 px-3 py-1 rounded-lg hover:bg-navy-100 transition"
          >
            📄 {t('notifications.downloadLetter')}
          </button>
        )}
        <p className="text-xs text-gray-300 mt-1">{formatRelative(n.createdAt, lang)}</p>
      </div>
      {!n.isRead && (
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
      )}
    </li>
  );
}

interface Props {
  /** Additional query keys to invalidate when a notification is marked read (e.g. notifications-preview). */
  extraInvalidations?: string[][];
}

export default function NotificationsPage({ extraInvalidations = [] }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [showOlder, setShowOlder] = useState(false);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications-all', showUnreadOnly],
    queryFn: () =>
      api.get(`/notifications?limit=100${showUnreadOnly ? '&unread=true' : ''}`).then((r) => r.data),
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    for (const k of extraInvalidations) {
      void queryClient.invalidateQueries({ queryKey: k });
    }
  }

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidateAll,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: invalidateAll,
  });

  const { user } = useAuthStore();
  const userRole = user?.role;

  const all = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Client-side search
  const q = search.toLowerCase().trim();
  const filtered = q
    ? all.filter(
        (n) =>
          (n.title ?? '').toLowerCase().includes(q) ||
          (n.body ?? '').toLowerCase().includes(q),
      )
    : all;

  const now = Date.now();
  const recent = filtered.filter((n) => now - new Date(n.createdAt).getTime() <= ONE_WEEK_MS);
  const older  = filtered.filter((n) => now - new Date(n.createdAt).getTime() >  ONE_WEEK_MS);

  // Expand older automatically when searching
  const olderVisible = q || showOlder;

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{t('notifications.title')}</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {t('notifications.unread', { count: unreadCount })}
            </p>
          )}
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              showUnreadOnly
                ? 'bg-navy-700 text-white border-navy-700'
                : 'text-navy-700 border-navy-200 hover:bg-navy-50'
            }`}
          >
            {t('notifications.unreadOnly')}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="text-xs text-navy-600 hover:underline disabled:opacity-50"
            >
              {t('notifications.markAll')}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('notifications.searchPlaceholder')}
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-200 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          {q ? t('notifications.noResults') : t('notifications.noNotifications')}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Recent ≤7 days */}
          {recent.length > 0 && (
            <ul className="space-y-2">
              {recent.map((n) => (
                <NotifItem
                  key={n.id}
                  n={n}
                  onMarkRead={(id) => markOneMutation.mutate(id)}
                  isPending={markOneMutation.isPending}
                  userRole={userRole}
                />
              ))}
            </ul>
          )}

          {/* Older >7 days — collapsible */}
          {older.length > 0 && (
            <div className="space-y-2">
              {!q && (
                <button
                  onClick={() => setShowOlder((v) => !v)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-gray-500 hover:text-navy-700 hover:bg-gray-50 transition border border-dashed border-gray-200"
                >
                  <span className="flex-1 text-left">
                    {showOlder
                      ? t('notifications.hideOlder')
                      : t('notifications.showOlder', { count: older.length })}
                  </span>
                  <span className="text-gray-400">{showOlder ? '▲' : '▼'}</span>
                </button>
              )}
              {olderVisible && (
                <ul className="space-y-2">
                  {older.map((n) => (
                    <NotifItem
                      key={n.id}
                      n={n}
                      onMarkRead={(id) => markOneMutation.mutate(id)}
                      isPending={markOneMutation.isPending}
                      userRole={userRole}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
