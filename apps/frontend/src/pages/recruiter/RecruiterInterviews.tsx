import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { InterviewProposalData } from '../../types/recruiter';

interface InterviewEntry extends InterviewProposalData {
  batchCandidate?: {
    id: string;
    candidate: {
      id: string;
      candidateCode: string;
      fullName: string;
      sswFieldId: string | null;
      sswFieldJa: string | null;
    };
  };
}

interface InterviewsResponse {
  proposals: InterviewEntry[];
}

const STATUS_CONFIG: Record<string, { key: string; color: string }> = {
  proposed:  { key: 'selection.interviewStatus.proposed',  color: 'bg-blue-100 text-blue-700' },
  scheduled: { key: 'selection.interviewStatus.scheduled', color: 'bg-green-100 text-green-700' },
  completed: { key: 'selection.interviewStatus.completed', color: 'bg-gray-100 text-gray-600' },
  cancelled: { key: 'selection.interviewStatus.cancelled', color: 'bg-red-100 text-red-600' },
};

const TABS = ['ALL', 'proposed', 'scheduled', 'completed', 'cancelled'] as const;
type Tab = typeof TABS[number];

export default function RecruiterInterviews() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [tab, setTab] = useState<Tab>('ALL');

  const { data, isLoading } = useQuery<InterviewsResponse>({
    queryKey: ['recruiter-interviews', tab],
    queryFn: () =>
      api.get(`/recruiter/interviews${tab !== 'ALL' ? `?status=${tab}` : ''}`).then((r) => r.data),
  });

  const interviews = data?.proposals ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-navy-900">{t('selection.interviewTitle')}</h1>

      {/* Tab filter */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((s) => {
          const cfg = s !== 'ALL' ? STATUS_CONFIG[s] : null;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                tab === s ? 'bg-navy-700 text-white border-navy-700' : 'text-gray-600 border-gray-200 hover:border-navy-300'
              }`}
            >
              {s === 'ALL' ? t('selection.tabAll') : t(cfg!.key)}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400">{t('loading')}</div>
      ) : interviews.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">{t('noData')}</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('selection.colCandidate')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('selection.colProposedDates')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('selection.colFinalDate')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">{t('filterStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {interviews.map((iv) => {
                const cand = iv.batchCandidate?.candidate;
                const cfg = STATUS_CONFIG[iv.status];
                return (
                  <tr key={iv.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      {cand ? (
                        <>
                          <p className="font-medium text-gray-900">{cand.fullName}</p>
                          <p className="text-xs text-gray-400 font-mono">{cand.candidateCode}</p>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {iv.proposedDates && iv.proposedDates.length > 0 ? (
                        <ul className="space-y-0.5">
                          {iv.proposedDates.map((d, i) => (
                            <li key={i} className="text-xs text-gray-600">
                              {i + 1}. {new Date(d).toLocaleString(lang === 'ja' ? 'ja-JP' : 'id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                            </li>
                          ))}
                        </ul>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {iv.finalDate
                        ? new Date(iv.finalDate).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color ?? ''}`}>
                        {cfg ? t(cfg.key) : iv.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
