import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import CandidateTimeline from '../../components/CandidateTimeline';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
          {interviews.map((iv) => {
            const cand = iv.batchCandidate?.candidate;
            const cfg = STATUS_CONFIG[iv.status];
            const isExpanded = expandedId === iv.id;

            return (
              <div key={iv.id}>
                <div
                  className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : iv.id)}
                >
                  <div className="flex-1 min-w-0">
                    {cand ? (
                      <div>
                        <p className="font-medium text-gray-900">{cand.fullName}</p>
                        <p className="text-xs text-gray-400 font-mono">{cand.candidateCode}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>

                  <div className="hidden sm:block text-xs text-gray-500 shrink-0">
                    {iv.proposedDates && iv.proposedDates.length > 0 ? (
                      <ul className="space-y-0.5">
                        {iv.proposedDates.map((d, i) => (
                          <li key={i}>
                            {i + 1}. {new Date(d).toLocaleString(lang === 'ja' ? 'ja-JP' : 'id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </li>
                        ))}
                      </ul>
                    ) : '—'}
                  </div>

                  <div className="text-xs text-gray-600 shrink-0 w-28 text-right">
                    {iv.finalDate
                      ? new Date(iv.finalDate).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID')
                      : '—'}
                  </div>

                  <div className="shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color ?? ''}`}>
                      {cfg ? t(cfg.key) : iv.status}
                    </span>
                  </div>

                  <span className="text-gray-300 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded timeline panel */}
                {isExpanded && cand && (
                  <div className="px-6 pb-5 pt-2 bg-gray-50 border-t border-gray-100">
                    <CandidateTimeline
                      endpoint={`/recruiter/candidates/${cand.id}/timeline`}
                      queryKey={['recruiter-timeline', cand.id]}
                      pendingAcceptProposalId={iv.status === 'completed' ? iv.id : null}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
