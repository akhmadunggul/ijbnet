import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface ConsentModalProps {
  activeClauseId: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

interface ActiveClause {
  id: string;
  version: string;
  content: string;
  contentJa: string | null;
}

export default function ConsentModal({ activeClauseId, onAccept }: ConsentModalProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [declined, setDeclined] = useState(false);

  const { data, isLoading, isError } = useQuery<{ clause: ActiveClause | null }>({
    queryKey: ['consent-clause-active'],
    queryFn: () => axios.get('/api/superadmin/consent-clause/active').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const clause = data?.clause ?? null;

  async function handleAccept() {
    setSubmitting(true);
    setError('');
    try {
      const token = useAuthStore.getState().accessToken;
      const clauseId = activeClauseId ?? clause?.id ?? undefined;
      await axios.patch(
        '/api/candidates/me/consent',
        clauseId ? { clauseId } : {},
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true },
      );
      onAccept();
    } catch {
      setError(lang === 'ja' ? '保存に失敗しました。もう一度お試しください。' : 'Gagal menyimpan persetujuan. Silakan coba lagi.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-navy-900">
            {t('candidate.consent.title')}
            {clause && <span className="ml-2 text-xs font-normal text-gray-400">v{clause.version}</span>}
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-5 text-sm text-gray-600 leading-relaxed space-y-4">
          {isLoading && (
            <p className="text-gray-400">{t('candidate.consent.loading')}</p>
          )}
          {isError && (
            <p className="text-red-500">{t('candidate.consent.error')}</p>
          )}
          {clause && (
            <>
              <div className="whitespace-pre-wrap">{clause.content}</div>
              {clause.contentJa && (
                <div className="whitespace-pre-wrap text-xs text-gray-400 italic border-t border-gray-100 pt-4">
                  {clause.contentJa}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-4 border-t border-gray-100 space-y-3">
          {declined && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {lang === 'ja'
                ? 'IJBNetを利用するにはデータ使用に同意する必要があります。'
                : 'Anda harus menyetujui penggunaan data untuk menggunakan IJBNet.'}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeclined(true)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              {t('candidate.consent.decline')}
            </button>
            <button
              onClick={handleAccept}
              disabled={submitting || isLoading || isError || !clause}
              className="px-5 py-2 text-sm font-medium bg-navy-700 hover:bg-navy-900 text-white rounded-lg transition disabled:opacity-60"
            >
              {submitting ? '…' : t('candidate.consent.agree')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
