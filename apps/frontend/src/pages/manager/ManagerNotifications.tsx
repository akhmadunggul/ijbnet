import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { NotificationData } from '../../types/candidate';

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
  if (!type) return '🔔';
  return TYPE_ICONS[type] ?? '🔔';
}

function formatRelative(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  if (minutes < 60) {
    return lang === 'ja' ? `${minutes}分前` : `${minutes} menit lalu`;
  }
  if (hours < 24) {
    return lang === 'ja' ? `${hours}時間前` : `${hours} jam lalu`;
  }
  return new Date(iso).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getDateGroup(iso: string): 'today' | 'yesterday' | 'earlier' {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDay.getTime() === today.getTime()) return 'today';
  if (itemDay.getTime() === yesterday.getTime()) return 'yesterday';
  return 'earlier';
}

export default function ManagerNotifications() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications-all', showUnreadOnly],
    queryFn: () =>
      api.get(`/notifications?limit=50${showUnreadOnly ? '&unread=true' : ''}`).then((r) => r.data),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Group by date
  const groups: { key: 'today' | 'yesterday' | 'earlier'; items: NotificationData[] }[] = [];
  const grouped: Record<string, NotificationData[]> = { today: [], yesterday: [], earlier: [] };

  for (const n of notifications) {
    grouped[getDateGroup(n.createdAt)].push(n);
  }

  for (const key of ['today', 'yesterday', 'earlier'] as const) {
    if (grouped[key].length > 0) {
      groups.push({ key, items: grouped[key] });
    }
  }

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{t('notifications.title')}</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {t('notifications.unread', { count: unreadCount })}
            </p>
          )}
        </div>
        <div className="flex gap-3">
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

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          {t('notifications.noNotifications')}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ key, items }) => (
            <div key={key}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {t(`notifications.${key}`)}
              </p>
              <ul className="space-y-2">
                {items.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) markOneMutation.mutate(n.id);
                    }}
                    className={`bg-white rounded-xl p-4 flex items-start gap-3 cursor-pointer transition border-l-4 ${
                      n.isRead
                        ? 'border-transparent border border-gray-100 hover:bg-gray-50'
                        : 'border-navy-400 border border-navy-100 bg-navy-50/20 hover:bg-navy-50/40'
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{getIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{n.title}</p>
                      {n.body && (
                        <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                      )}
                      <p className="text-xs text-gray-300 mt-1">{formatRelative(n.createdAt, lang)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
