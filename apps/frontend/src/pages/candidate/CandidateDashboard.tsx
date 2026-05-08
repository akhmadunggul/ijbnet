import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import CandidateTimeline from '../../components/CandidateTimeline';
import type { CandidateMe, NotificationData } from '../../types/candidate';

const STATUS_CONFIG: Record<string, { label: string; labelJa: string; color: string; bg: string }> = {
  incomplete:   { label: 'Profil belum lengkap', labelJa: 'プロフィール未完成', color: 'text-gray-600',  bg: 'bg-gray-50 border-gray-200' },
  submitted:    { label: 'Menunggu review',       labelJa: 'レビュー待ち',       color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
  under_review: { label: 'Sedang direview',        labelJa: '審査中',             color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  approved:     { label: 'Disetujui',              labelJa: '承認済み',           color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  confirmed:    { label: 'Dikonfirmasi ✓',         labelJa: '確定済み ✓',         color: 'text-yellow-700',bg: 'bg-yellow-50 border-yellow-300' },
  rejected:     { label: 'Ditolak',                labelJa: '不採用',             color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
};

export default function CandidateDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CandidateMe>({
    queryKey: ['my-candidate'],
    queryFn: () => api.get('/candidates/me').then((r) => r.data),
  });

  const { data: notifData } = useQuery<{ notifications: NotificationData[] }>({
    queryKey: ['notifications-preview'],
    queryFn: () => api.get('/notifications?limit=3&unread=true').then((r) => r.data),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400">{t('loading')}</div>;
  }

  const candidate = data?.candidate;

  if (!candidate || data?.isNewUser) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-6">
        <div className="text-5xl">👋</div>
        <h1 className="text-2xl font-bold text-navy-900">
          {lang === 'ja' ? 'ようこそ！' : 'Selamat datang!'}
        </h1>
        <p className="text-gray-500 text-sm">
          {lang === 'ja'
            ? 'プロフィールを入力してください。'
            : 'Silakan lengkapi profil Anda.'}
        </p>
        <button
          onClick={() => navigate('/portal/profile')}
          className="inline-flex items-center gap-2 bg-navy-700 hover:bg-navy-900 text-white font-medium rounded-xl px-6 py-3 text-sm transition"
        >
          {lang === 'ja' ? 'プロフィールを始める' : 'Mulai Lengkapi Profil'}
        </button>
      </div>
    );
  }

  const { completeness, profileStatus, interviewStatus } = candidate;
  const statusCfg = STATUS_CONFIG[profileStatus] ?? STATUS_CONFIG['incomplete']!;

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await api.get('/candidates/me/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate?.candidateCode ?? 'export'}-data.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setExportError(lang === 'ja' ? 'ダウンロードに失敗しました。' : 'Gagal mengunduh data. Coba lagi.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-navy-900">{t('candidate.dashboard.title')}</h1>

      {/* Status card */}
      <div className={`border rounded-xl p-6 ${statusCfg.bg}`}>
        <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
          {t('candidate.dashboard.statusLabel')}
        </p>
        <p className={`text-2xl font-bold ${statusCfg.color}`}>
          {lang === 'ja' ? statusCfg.labelJa : statusCfg.label}
        </p>
        <p className="text-xs text-gray-400 mt-1">{candidate.candidateCode}</p>
      </div>

      {/* Completeness */}
      <div
        className="bg-white border border-gray-100 rounded-xl p-6 cursor-pointer hover:shadow-sm transition"
        onClick={() => navigate('/portal/profile')}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">{t('candidate.dashboard.completeness')}</p>
          <p className="text-lg font-bold text-navy-700">{completeness.pct}%</p>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-navy-700 rounded-full transition-all duration-500"
            style={{ width: `${completeness.pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {completeness.score} / {completeness.total} {lang === 'ja' ? '項目完了' : 'bidang terisi'}
        </p>
        {!candidate.consentGiven && (
          <p className="text-xs text-red-500 mt-2 font-medium">
            ⚠ {t('consentRequired')}
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {completeness.pct < 100 && (
          <button
            onClick={() => navigate('/portal/profile')}
            className="flex flex-col items-center gap-2 bg-navy-700 text-white rounded-xl p-5 hover:bg-navy-900 transition text-center"
          >
            <span className="text-2xl">✏️</span>
            <span className="text-sm font-medium">{t('candidate.dashboard.completeAction')}</span>
          </button>
        )}
        {interviewStatus && (
          <div className="flex flex-col items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <span className="text-2xl">📅</span>
            <span className="text-sm font-medium text-amber-700">
              {lang === 'ja' ? '面接: ' : 'Wawancara: '}{interviewStatus}
            </span>
          </div>
        )}
        <button
          onClick={() => navigate('/portal/cv')}
          className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-xl p-5 hover:bg-gray-50 transition text-center"
        >
          <span className="text-2xl">📄</span>
          <span className="text-sm font-medium text-gray-700">
            {lang === 'ja' ? 'CVを見る' : 'Lihat CV / CVを見る'}
          </span>
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-xl p-5 hover:bg-gray-50 transition text-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="text-2xl">{exporting ? '⏳' : '📥'}</span>
          <span className="text-sm font-medium text-gray-700">
            {exporting
              ? (lang === 'ja' ? '生成中…' : 'Membuat PDF…')
              : t('candidate.dashboard.downloadData')}
          </span>
          {exportError && <span className="text-xs text-red-500 mt-1">{exportError}</span>}
        </button>
      </div>

      {/* Status timeline */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <CandidateTimeline
          endpoint="/candidates/me/timeline"
          queryKey={['my-timeline']}
        />
      </div>

      {/* Notification preview */}
      {(notifData?.notifications ?? []).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">{t('navNotifications')}</p>
          <ul className="space-y-2">
            {notifData!.notifications.map((n) => (
              <li key={n.id} className="flex gap-3 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-navy-500 mt-2 shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/portal/notifications')}
            className="mt-3 text-xs text-navy-600 hover:underline"
          >
            {lang === 'ja' ? 'すべて見る →' : 'Lihat semua →'}
          </button>
        </div>
      )}
    </div>
  );
}
