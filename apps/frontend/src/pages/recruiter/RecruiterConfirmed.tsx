import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { RecruiterBatchCandidate, InterviewProposalData } from '../../types/recruiter';

interface ConfirmedResponse {
  candidates: RecruiterBatchCandidate[];
}

const STATUS_COLORS: Record<string, string> = {
  proposed: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

function ProposalModal({
  bc,
  onClose,
}: {
  bc: RecruiterBatchCandidate;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const [dates, setDates] = useState<string[]>(['', '', '']);

  const mutation = useMutation({
    mutationFn: (proposedDates: string[]) =>
      api.post(`/recruiter/interviews/${bc.id}/propose`, { proposedDates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-confirmed'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-interviews'] });
      onClose();
    },
  });

  function handleSubmit() {
    const valid = dates.filter((d) => d.trim() !== '');
    if (valid.length === 0) return;
    mutation.mutate(valid);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">{t('selection.proposeModalTitle')}</h2>
        <p className="text-sm text-gray-500">{bc.candidate.fullName} · {bc.candidate.candidateCode}</p>
        <p className="text-xs text-gray-400">{t('selection.proposeDateHint')}</p>
        <div className="space-y-2">
          {dates.map((d, i) => (
            <div key={i}>
              <label className="block text-xs text-gray-400 mb-1">
                {t('selection.proposeDateLabel', { num: i + 1 })}
              </label>
              <input
                type="datetime-local"
                value={d}
                onChange={(e) => {
                  const next = [...dates];
                  next[i] = e.target.value;
                  setDates(next);
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
              />
            </div>
          ))}
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-500">{t('toastError')}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">
            {t('btnCancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || dates.every((d) => !d)}
            className="px-4 py-2 rounded-lg text-sm bg-navy-700 text-white hover:bg-navy-900 transition disabled:opacity-50"
          >
            {mutation.isPending ? '…' : t('selection.proposeSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewProposalModal({ proposal, lang, onClose }: { proposal: InterviewProposalData; lang: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy-900">{t('selection.viewProposalTitle')}</h2>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[proposal.status] ?? ''}`}>
          {t(`selection.interviewStatus.${proposal.status}`, { defaultValue: proposal.status })}
        </span>
        {proposal.proposedDates && (
          <ul className="space-y-1">
            {proposal.proposedDates.map((d, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-gray-400">{i + 1}.</span>
                {new Date(d).toLocaleString(lang === 'ja' ? 'ja-JP' : 'id-ID')}
              </li>
            ))}
          </ul>
        )}
        {proposal.finalDate && (
          <div className="border-t pt-3">
            <p className="text-xs text-gray-400">{t('selection.finalDateLabel')}</p>
            <p className="text-sm font-semibold text-green-700">{proposal.finalDate}</p>
          </div>
        )}
        <button onClick={onClose} className="w-full py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          {t('selection.closeBtn')}
        </button>
      </div>
    </div>
  );
}

export default function RecruiterConfirmed() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [proposeBc, setProposeBc] = useState<RecruiterBatchCandidate | null>(null);
  const [viewProposal, setViewProposal] = useState<InterviewProposalData | null>(null);

  const { data, isLoading } = useQuery<ConfirmedResponse>({
    queryKey: ['recruiter-confirmed'],
    queryFn: () => api.get('/recruiter/confirmed').then((r) => r.data),
  });

  const candidates = data?.candidates ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-navy-900">{t('selection.confirmedTitle')}</h1>

      {isLoading ? (
        <div className="text-sm text-gray-400">{t('loading')}</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">{t('noData')}</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('colCode')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('colName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('colSSW')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('selection.colBodyCheck')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('selection.colInterview')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {candidates.map((bc) => {
                const c = bc.candidate;
                const bc_result = c.bodyCheck?.overallResult;
                return (
                  <tr key={bc.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.candidateCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.fullName}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {lang === 'ja' ? c.sswFieldJa : c.sswFieldId}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        bc_result === 'pass' ? 'text-green-600' :
                        bc_result === 'fail' ? 'text-red-500' :
                        bc_result === 'hold' ? 'text-amber-600' : 'text-gray-300'
                      }`}>
                        {bc_result ? t(`admin.bodyCheck.${bc_result}`) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {bc.proposal ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bc.proposal.status] ?? ''}`}>
                          {t(`selection.interviewStatus.${bc.proposal.status}`, { defaultValue: bc.proposal.status })}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!bc.proposal || bc.proposal.status === 'cancelled' ? (
                        <button
                          onClick={() => setProposeBc(bc)}
                          className="text-xs text-navy-600 hover:underline"
                        >
                          {t('selection.proposeInterviewBtn')}
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewProposal(bc.proposal!)}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          {t('selection.viewInterviewBtn')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {proposeBc && <ProposalModal bc={proposeBc} onClose={() => setProposeBc(null)} />}
      {viewProposal && <ViewProposalModal proposal={viewProposal} lang={lang} onClose={() => setViewProposal(null)} />}
    </div>
  );
}
