import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { NotificationData } from '../../types/candidate';

interface NotificationsResponse {
  notifications: NotificationData[];
  unreadCount: number;
}

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminNotifications() {
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

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{t('navNotifications')}</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {lang === 'ja' ? `未読 ${unreadCount} 件` : `${unreadCount} belum dibaca`}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              showUnreadOnly ? 'bg-navy-700 text-white border-navy-700' : 'text-navy-700 border-navy-200 hover:bg-navy-50'
            }`}
          >
            {lang === 'ja' ? '未読のみ' : 'Belum dibaca'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="text-xs text-navy-600 hover:underline disabled:opacity-50"
            >
              {lang === 'ja' ? 'すべて既読' : 'Tandai semua dibaca'}
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">{t('noData')}</div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`bg-white border rounded-xl p-4 ${n.isRead ? 'border-gray-100' : 'border-navy-200 bg-navy-50/30'}`}
            >
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? 'bg-gray-200' : 'bg-navy-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-gray-300 mt-1">{formatDate(n.createdAt, lang)}</p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markOneMutation.mutate(n.id)}
                    disabled={markOneMutation.isPending}
                    className="text-xs text-navy-600 hover:underline shrink-0 disabled:opacity-50"
                  >
                    {lang === 'ja' ? '既読' : 'Baca'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
