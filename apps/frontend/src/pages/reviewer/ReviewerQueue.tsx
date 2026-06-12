import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { JrasInstrumentSummary } from '../../types/jras';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  retired: 'bg-gray-100 text-gray-400',
};

export default function ReviewerQueue() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data, isLoading, isError, error } = useQuery<JrasInstrumentSummary[]>({
    queryKey: ['jras-reviewer-queue'],
    queryFn: () => api.get('/jras/reviewer/queue').then((r) => r.data),
    retry: false,
  });

  const notRegistered =
    (error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error ===
    'REVIEWER_NOT_REGISTERED';

  if (notRegistered) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
        {t('jras.notRegistered')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('jras.queueTitle')}</h1>

      {isLoading ? (
        <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
      ) : isError ? (
        <div className="p-6 text-sm text-red-600">{t('toastError')}</div>
      ) : (data ?? []).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-500">
          {t('jras.queueEmpty')}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).map((inst) => (
            <div key={inst.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {lang === 'ja' ? inst.titleJa : inst.titleId}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {lang === 'ja' ? inst.titleId : inst.titleJa}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[inst.status]}`}>
                  {t(`jras.status.${inst.status}`)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full">
                  {t(`jras.dim.${inst.dimensionKey}`)}
                </span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {t(`jras.type.${inst.type}`)}
                </span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {t('jras.version')} {inst.version}
                </span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {t('jras.itemCount', { count: inst.itemCount })}
                </span>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-gray-400">
                  {t('jras.sentAt')}:{' '}
                  {inst.sentToReviewAt ? new Date(inst.sentToReviewAt).toLocaleDateString() : '—'}
                </span>
                {inst.alreadyReviewed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                    ✓ {t('jras.alreadyReviewed')}
                  </span>
                ) : (
                  <Link
                    to={`/reviewer/instruments/${inst.id}`}
                    className="bg-navy-700 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-navy-800 transition"
                  >
                    {t('jras.startReview')}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
