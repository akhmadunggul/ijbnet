import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { JrasReviewData } from '../../types/jras';

export default function ReviewerHistory() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data, isLoading, isError } = useQuery<JrasReviewData[]>({
    queryKey: ['jras-reviewer-history'],
    queryFn: () => api.get('/jras/reviewer/my-reviews').then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('jras.historyTitle')}</h1>

      {isLoading ? (
        <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
      ) : isError ? (
        <div className="p-6 text-sm text-red-600">{t('toastError')}</div>
      ) : (data ?? []).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-500">
          {t('jras.historyEmpty')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colTitle')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('jras.version')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('jras.verdictLabel')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('jras.sentAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/reviewer/instruments/${r.instrumentId}`}
                      className="font-medium text-navy-700 hover:underline"
                    >
                      {r.instrument ? (lang === 'ja' ? r.instrument.titleJa : r.instrument.titleId) : '—'}
                    </Link>
                    {r.instrument && (
                      <p className="text-xs text-gray-400">
                        {t(`jras.dim.${r.instrument.dimensionKey}`)} · {t(`jras.type.${r.instrument.type}`)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">v{r.instrumentVersion}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.verdict === 'approve' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {r.verdict === 'approve' ? t('jras.verdictApprove') : t('jras.verdictRequestChanges')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(r.submittedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
