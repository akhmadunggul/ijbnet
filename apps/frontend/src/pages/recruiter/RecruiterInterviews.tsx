import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      nameKatakana: string | null;
      sswFieldId: string | null;
      sswFieldJa: string | null;
    };
  };
}

interface InterviewsResponse {
  proposals: InterviewEntry[];
}

interface DecisionConfig {
  deadlineDays: number;
}

const STATUS_CONFIG: Record<string, { key: string; color: string }> = {
  proposed:  { key: 'selection.interviewStatus.proposed',  color: 'bg-blue-100 text-blue-700' },
  scheduled: { key: 'selection.interviewStatus.scheduled', color: 'bg-green-100 text-green-700' },
  completed: { key: 'selection.interviewStatus.completed', color: 'bg-gray-100 text-gray-600' },
  cancelled: { key: 'selection.interviewStatus.cancelled', color: 'bg-red-100 text-red-600' },
};

const TABS = ['ALL', 'proposed', 'scheduled', 'completed', 'cancelled'] as const;
type Tab = typeof TABS[number];

function DeadlineBadge({ deadline, t }: { deadline: string | null; t: (k: string) => string }) {
  if (!deadline) return null;
  const dl = new Date(deadline);
  const now = new Date();
  const diffMs = dl.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{t('interviews.deadlinePassed')}</span>;
  }
  if (diffDays <= 3) {
    return <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">{t('interviews.deadlineSoon').replace('{days}', String(diffDays))}</span>;
  }
  return <span className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full font-medium">{t('interviews.deadlineIn').replace('{days}', String(diffDays))}</span>;
}

interface DecisionModalProps {
  proposal: InterviewEntry;
  onClose: () => void;
  onSuccess: () => void;
}

function DecisionModal({ proposal, onClose, onSuccess }: DecisionModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cand = proposal.batchCandidate?.candidate;

  const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (body: { decision: string; confirmedBySignature: boolean }) =>
      api.post(`/recruiter/interviews/${proposal.id}/decision`, body).then((r) => r.data as {
        ok: boolean;
        decision: string;
        letterPdfBase64: string | null;
        letterFilename: string | null;
      }),
    onSuccess: (data) => {
      // Auto-download the letter PDF if generated
      if (data.letterPdfBase64 && data.letterFilename) {
        const bytes = Uint8Array.from(atob(data.letterPdfBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.letterFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
      void qc.invalidateQueries({ queryKey: ['recruiter-interviews'] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('toastError'));
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-navy-900 px-6 py-4">
          <h2 className="text-white font-semibold text-base">{t('interviews.finalDecision')}</h2>
          {cand && (
            <p className="text-navy-300 text-sm mt-0.5">{cand.fullName}
              {cand.nameKatakana && <span className="ml-2 text-navy-400 text-xs">({cand.nameKatakana})</span>}
            </p>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Decision choice */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{t('interviews.decisionLabel')}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision('accepted')}
                className={`flex flex-col items-center justify-center gap-1.5 border-2 rounded-xl py-4 transition ${
                  decision === 'accepted'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <span className="text-2xl">✓</span>
                <span className="text-sm font-medium text-green-700">{t('interviews.decisionAccept')}</span>
                <span className="text-xs text-gray-500">{t('interviews.decisionAcceptJa')}</span>
              </button>
              <button
                onClick={() => setDecision('rejected')}
                className={`flex flex-col items-center justify-center gap-1.5 border-2 rounded-xl py-4 transition ${
                  decision === 'rejected'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <span className="text-2xl">✗</span>
                <span className="text-sm font-medium text-red-700">{t('interviews.decisionReject')}</span>
                <span className="text-xs text-gray-500">{t('interviews.decisionRejectJa')}</span>
              </button>
            </div>
          </div>

          {/* Letter preview note */}
          {decision && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600">
              {decision === 'accepted'
                ? t('interviews.letterNoteAccept')
                : t('interviews.letterNoteReject')}
            </div>
          )}

          {/* Digital signature checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-navy-700 w-4 h-4 shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900 transition">
              {t('interviews.signatureConfirm')}
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => {
                if (!decision || !confirmed) return;
                setError('');
                mutation.mutate({ decision, confirmedBySignature: true });
              }}
              disabled={!decision || !confirmed || mutation.isPending}
              className="flex-1 bg-navy-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {mutation.isPending ? t('submitting') : t('interviews.submitDecision')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecruiterInterviews() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [tab, setTab] = useState<Tab>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisionModalProposal, setDecisionModalProposal] = useState<InterviewEntry | null>(null);

  const { data, isLoading } = useQuery<InterviewsResponse>({
    queryKey: ['recruiter-interviews', tab],
    queryFn: () =>
      api.get(`/recruiter/interviews${tab !== 'ALL' ? `?status=${tab}` : ''}`).then((r) => r.data),
  });

  // Fetch decision config for deadline display
  useQuery<DecisionConfig>({
    queryKey: ['interview-decision-config'],
    queryFn: () => api.get('/superadmin/interview-decision-config').then((r) => r.data),
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
            const needsDecision = iv.status === 'completed' && iv.recruiterDecision === null;
            const decisionMade = iv.recruiterDecision !== null;

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
                        {cand.nameKatakana && (
                          <p className="text-xs text-gray-500">{cand.nameKatakana}</p>
                        )}
                        <p className="text-xs text-gray-400 font-mono">{cand.candidateCode}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 shrink-0">
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

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color ?? ''}`}>
                      {cfg ? t(cfg.key) : iv.status}
                    </span>
                    {/* Decision status badges */}
                    {decisionMade && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        iv.recruiterDecision === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {iv.recruiterDecision === 'accepted'
                          ? t('interviews.decisionAccept')
                          : t('interviews.decisionReject')}
                      </span>
                    )}
                    {needsDecision && (
                      <DeadlineBadge deadline={iv.decisionDeadline} t={t} />
                    )}
                  </div>

                  <span className="text-gray-300 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded panel */}
                {isExpanded && cand && (
                  <div className="px-6 pb-5 pt-2 bg-gray-50 border-t border-gray-100">
                    {/* Final Decision button for completed interviews awaiting decision */}
                    {needsDecision && (
                      <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-amber-800">{t('interviews.awaitingDecision')}</p>
                          {iv.decisionDeadline && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              {t('interviews.deadlineLabel')}: {new Date(iv.decisionDeadline).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDecisionModalProposal(iv);
                          }}
                          className="bg-navy-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 transition shrink-0 ml-4"
                        >
                          {t('interviews.finalDecision')}
                        </button>
                      </div>
                    )}

                    {/* Meeting link — shown for scheduled interviews */}
                    {iv.status === 'scheduled' && (
                      <div className="mb-4 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                        <span className="text-teal-600 text-lg shrink-0">🔗</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-teal-700 mb-1">{t('interviews.meetingLink')}</p>
                          {iv.meetingLink ? (
                            <a
                              href={iv.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
                            >
                              {t('interviews.joinMeeting')}
                            </a>
                          ) : (
                            <p className="text-xs text-teal-500 italic">{t('interviews.meetingLinkPending')}</p>
                          )}
                        </div>
                      </div>
                    )}

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

      {decisionModalProposal && (
        <DecisionModal
          proposal={decisionModalProposal}
          onClose={() => setDecisionModalProposal(null)}
          onSuccess={() => setDecisionModalProposal(null)}
        />
      )}
    </div>
  );
}
