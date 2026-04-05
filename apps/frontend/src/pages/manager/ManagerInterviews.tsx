import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ManagerInterview } from '../../types/manager';

interface InterviewsResponse {
  interviews: ManagerInterview[];
}

const STATUS_CONFIG: Record<string, { key: string; color: string }> = {
  proposed:  { key: 'selection.interviewStatus.proposed',  color: 'bg-amber-100 text-amber-700' },
  scheduled: { key: 'selection.interviewStatus.scheduled', color: 'bg-blue-100 text-blue-700' },
  completed: { key: 'selection.interviewStatus.completed', color: 'bg-green-100 text-green-700' },
  cancelled: { key: 'selection.interviewStatus.cancelled', color: 'bg-gray-100 text-gray-600' },
};

const STATUS_TABS = ['all', 'proposed', 'scheduled', 'completed', 'cancelled'] as const;
type StatusTab = typeof STATUS_TABS[number];

function formatDateShort(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === 'ja' ? 'ja-JP' : 'id-ID', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ManagerInterviews() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  // Finalize modal state
  const [finalizeId, setFinalizeId] = useState<string | null>(null);
  const [finalizeInterview, setFinalizeInterview] = useState<ManagerInterview | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  // Result modal state
  const [resultId, setResultId] = useState<string | null>(null);
  const [resultValue, setResultValue] = useState<'pass' | 'fail' | 'cancelled'>('pass');

  const queryParams = statusTab !== 'all' ? `?status=${statusTab}` : '';

  const { data, isLoading } = useQuery<InterviewsResponse>({
    queryKey: ['manager-interviews', statusTab],
    queryFn: () => api.get(`/manager/interviews${queryParams}`).then((r) => r.data),
  });

  const finalizeMutation = useMutation({
    mutationFn: ({ id, finalDate }: { id: string; finalDate: string }) =>
      api.patch(`/manager/interviews/${id}/finalize`, { finalDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-interviews'] });
      closeFinalizeModal();
    },
  });

  const resultMutation = useMutation({
    mutationFn: ({ id, result }: { id: string; result: string }) =>
      api.patch(`/manager/interviews/${id}/result`, { result }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-interviews'] });
      setResultId(null);
    },
  });

  function openFinalizeModal(interview: ManagerInterview) {
    setFinalizeId(interview.id);
    setFinalizeInterview(interview);
    setSelectedDate('');
    setCustomDate('');
    setUseCustom(false);
  }

  function closeFinalizeModal() {
    setFinalizeId(null);
    setFinalizeInterview(null);
  }

  function handleFinalize() {
    if (!finalizeId) return;
    const date = useCustom ? customDate : selectedDate;
    if (!date) return;
    finalizeMutation.mutate({ id: finalizeId, finalDate: date });
  }

  const interviews = data?.interviews ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-900">{t('manager.interviews.title')}</h1>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              statusTab === tab
                ? 'border-navy-700 text-navy-700'
                : 'border-transparent text-gray-500 hover:text-navy-600'
            }`}
          >
            {tab === 'all'
              ? t('filterAll')
              : t(STATUS_CONFIG[tab]?.key ?? tab)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="text-sm text-gray-400 p-6">{t('loading')}</div>
        ) : interviews.length === 0 ? (
          <div className="text-sm text-gray-400 p-6 text-center">{t('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('selection.colCandidate')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.batches.company')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.interviews.proposedDates')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.interviews.finalDate')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colStatus')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {interviews.map((iv) => {
                  const cfg = STATUS_CONFIG[iv.status];
                  const bc = iv.batchCandidate;
                  return (
                    <tr key={iv.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-4 py-3">
                        {bc ? (
                          <>
                            <p className="font-medium text-navy-900">{bc.candidate.fullName}</p>
                            <p className="text-xs text-gray-400">{bc.candidate.candidateCode}</p>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {bc?.batch.company
                          ? (lang === 'ja' && bc.batch.company.nameJa ? bc.batch.company.nameJa : bc.batch.company.name)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {iv.proposedDates && iv.proposedDates.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {iv.proposedDates.map((d, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                {formatDateShort(d, lang)}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {iv.finalDate ? formatDateShort(iv.finalDate, lang) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color ?? 'bg-gray-100 text-gray-600'}`}>
                          {cfg?.key ? t(cfg.key) : iv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {iv.status === 'proposed' && (
                            <button
                              onClick={() => openFinalizeModal(iv)}
                              className="text-xs bg-navy-50 text-navy-700 px-3 py-1 rounded-lg hover:bg-navy-100 transition"
                            >
                              {t('manager.interviews.finalize')}
                            </button>
                          )}
                          {iv.status === 'scheduled' && (
                            <button
                              onClick={() => { setResultId(iv.id); setResultValue('pass'); }}
                              className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-100 transition"
                            >
                              {t('manager.interviews.markResult')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Finalize Modal */}
      {finalizeId && finalizeInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-navy-900">{t('manager.interviews.finalize')}</h2>

            {/* Proposed dates as radio buttons */}
            {finalizeInterview.proposedDates && finalizeInterview.proposedDates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">{t('manager.interviews.selectDate')}</p>
                {finalizeInterview.proposedDates.map((d, i) => (
                  <label key={i} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="finalDate"
                      value={d}
                      checked={!useCustom && selectedDate === d}
                      onChange={() => { setSelectedDate(d); setUseCustom(false); }}
                      className="accent-navy-700"
                    />
                    <span className="text-sm text-gray-700">{formatDateShort(d, lang)}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Custom date */}
            <div className="space-y-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="finalDate"
                  checked={useCustom}
                  onChange={() => setUseCustom(true)}
                  className="accent-navy-700"
                />
                <span className="text-sm text-gray-700">{t('manager.interviews.customDate')}</span>
              </label>
              {useCustom && (
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300 ml-6"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeFinalizeModal}
                className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 transition"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizeMutation.isPending || (!useCustom ? !selectedDate : !customDate)}
                className="text-sm bg-navy-700 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition disabled:opacity-50"
              >
                {finalizeMutation.isPending ? t('loading') : t('btnSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-navy-900">{t('manager.interviews.markResult')}</h2>
            <div className="space-y-2">
              {(['pass', 'fail', 'cancelled'] as const).map((r) => (
                <label key={r} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="result"
                    value={r}
                    checked={resultValue === r}
                    onChange={() => setResultValue(r)}
                    className="accent-navy-700"
                  />
                  <span className="text-sm text-gray-700">
                    {r === 'pass'
                      ? t('manager.interviews.resultPass')
                      : r === 'fail'
                      ? t('manager.interviews.resultFail')
                      : t('manager.interviews.resultCancelled')}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setResultId(null)}
                className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 transition"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={() => resultMutation.mutate({ id: resultId, result: resultValue })}
                disabled={resultMutation.isPending}
                className="text-sm bg-navy-700 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition disabled:opacity-50"
              >
                {resultMutation.isPending ? t('loading') : t('btnSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
