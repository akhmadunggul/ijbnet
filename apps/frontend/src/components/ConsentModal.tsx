import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface ActiveClauseResponse {
  clause: {
    id: string;
    version: string;
    content: string;
    contentJa: string | null;
    publishedAt: string | null;
  } | null;
}

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  const { t, i18n } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery<ActiveClauseResponse>({
    queryKey: ['consent-clause-active'],
    queryFn: () => api.get('/superadmin/consent-clause/active').then((r) => r.data),
    retry: 1,
  });

  const clause = data?.clause ?? null;
  const isJa = i18n.language === 'ja';
  const displayContent = clause
    ? (isJa && clause.contentJa ? clause.contentJa : clause.content)
    : null;

  // Fallback hardcoded text shown when clause is null or fetch failed
  const fallbackContent = isJa
    ? 'IJBNetはSSW就労目的のみでお客様の個人情報を収集・処理します（インドネシアUU PDP 2022・日本APPI準拠）。お客様のデータは、同意済みの採用プロセス以外の第三者に提供されることはありません。'
    : 'IJBNet mengumpulkan dan memproses data pribadi Anda semata-mata untuk keperluan penempatan SSW ke Jepang, sesuai UU PDP 2022 (Indonesia) dan APPI (Jepang). Data Anda tidak akan dibagikan kepada pihak ketiga di luar proses rekrutmen yang telah Anda setujui.';

  async function handleAccept() {
    setSubmitting(true);
    setError('');
    try {
      await api.patch('/candidates/me/consent', clause ? { clauseId: clause.id } : {});
      onAccept();
    } catch (err) {
      console.error('[ConsentModal] consent patch failed:', err);
      setError(isJa ? '同意の記録に失敗しました。再度お試しください。' : 'Gagal merekam persetujuan. Silakan coba lagi.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-semibold text-navy-900 mb-2">{t('candidate.consent.title')}</h2>

        {isLoading ? (
          <div className="text-sm text-gray-400 py-6 text-center">{t('candidate.consent.loading')}</div>
        ) : isError && !clause ? (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            {t('candidate.consent.error')}
          </div>
        ) : null}

        <div className="text-sm text-gray-600 leading-relaxed space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
          {displayContent ? (
            <p className="whitespace-pre-wrap">{displayContent}</p>
          ) : !isLoading ? (
            <p>{fallbackContent}</p>
          ) : null}

          {clause && isJa && clause.contentJa && (
            <p className="text-xs text-gray-400 italic mt-2">{clause.content}</p>
          )}
          {clause && !isJa && clause.contentJa && (
            <p className="text-xs text-gray-400 italic mt-2">{clause.contentJa}</p>
          )}
        </div>

        {clause && (
          <p className="text-xs text-gray-400 mb-4">
            v{clause.version}{clause.publishedAt ? ` · ${new Date(clause.publishedAt).toLocaleDateString()}` : ''}
          </p>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onDecline}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-60"
          >
            {t('candidate.consent.decline')}
          </button>
          <button
            onClick={handleAccept}
            disabled={submitting || isLoading}
            className="px-5 py-2 text-sm font-medium bg-navy-700 hover:bg-navy-900 text-white rounded-lg transition disabled:opacity-60"
          >
            {submitting ? '…' : t('candidate.consent.agree')}
          </button>
        </div>
      </div>
    </div>
  );
}
