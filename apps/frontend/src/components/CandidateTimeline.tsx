import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

type TimelineEventType =
  | 'registered'
  | 'consent_given'
  | 'profile_submitted'
  | 'profile_under_review'
  | 'profile_approved'
  | 'profile_rejected'
  | 'batch_allocated'
  | 'recruiter_selected'
  | 'interview_proposed'
  | 'interview_scheduled'
  | 'interview_date_confirmed'
  | 'interview_passed'
  | 'interview_failed'
  | 'recruiter_accepted'
  | 'manager_confirmed'
  | 'provisional_acceptance';

interface TimelineEvent {
  id: string;
  event: TimelineEventType;
  occurredAt: string;
  actor?: { name?: string; role?: string } | null;
  metadata?: Record<string, unknown> | null;
  durationHours?: number | null;
  currentAgeHours?: number | null;
}

interface TimelineResponse {
  timeline: TimelineEvent[];
}

// Canonical process order — every candidate goes through these steps
const PROCESS_STEPS: TimelineEventType[] = [
  'registered',
  'consent_given',
  'profile_submitted',
  'profile_under_review',
  'profile_approved',
  'batch_allocated',
  'recruiter_selected',
  'interview_proposed',
  'interview_scheduled',
  'interview_date_confirmed',
  'interview_passed',
  'recruiter_accepted',
  'manager_confirmed',
  'provisional_acceptance',
];

// Negative terminal events that end the process early
const NEGATIVE_TERMINALS: Partial<Record<TimelineEventType, TimelineEventType>> = {
  profile_approved: 'profile_rejected',
  interview_passed: 'interview_failed',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDays(hours: number): string {
  const days = Math.round(hours / 24);
  return days < 1 ? '< 1 hari' : `${days} hari`;
}

interface Props {
  endpoint: string;
  queryKey: string[];
  pendingInterviewConfirmProposalId?: string | null;
  pendingAcceptProposalId?: string | null;
  provisionalAcceptanceCandidateId?: string | null;
}

export default function CandidateTimeline({
  endpoint,
  queryKey,
  pendingInterviewConfirmProposalId,
  pendingAcceptProposalId,
  provisionalAcceptanceCandidateId,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<TimelineResponse>({
    queryKey,
    queryFn: () => api.get(endpoint).then((r) => r.data),
  });

  const confirmDateMutation = useMutation({
    mutationFn: (proposalId: string) =>
      api.patch(`/candidates/me/interviews/${proposalId}/confirm-date`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const acceptMutation = useMutation({
    mutationFn: (proposalId: string) =>
      api.post(`/recruiter/interviews/${proposalId}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const provisionalMutation = useMutation({
    mutationFn: (candidateId: string) =>
      api.post(`/manager/candidates/${candidateId}/provisional-acceptance`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const events = data?.timeline ?? [];

  // Build a lookup map: event type → event data
  const eventMap = new Map<TimelineEventType, TimelineEvent>();
  for (const ev of events) eventMap.set(ev.event, ev);

  // Detect negative terminal state
  let negativeTerminal: TimelineEvent | null = null;
  let negativeAfterStep = -1;
  for (const [positiveStep, negativeStep] of Object.entries(NEGATIVE_TERMINALS)) {
    if (eventMap.has(negativeStep as TimelineEventType)) {
      negativeTerminal = eventMap.get(negativeStep as TimelineEventType)!;
      negativeAfterStep = PROCESS_STEPS.indexOf(positiveStep as TimelineEventType);
    }
  }

  // Determine the index of the last completed step
  let lastCompletedIndex = -1;
  for (let i = 0; i < PROCESS_STEPS.length; i++) {
    if (eventMap.has(PROCESS_STEPS[i]!)) lastCompletedIndex = i;
  }

  const hasConfirmed = eventMap.has('interview_date_confirmed');
  const hasAccepted = eventMap.has('recruiter_accepted');
  const hasProvisionalAcceptance = eventMap.has('provisional_acceptance');

  const scheduledEvent = eventMap.get('interview_scheduled');
  const autoProposalId = scheduledEvent?.metadata?.proposalId as string | null | undefined;
  const effectiveConfirmProposalId = pendingInterviewConfirmProposalId ?? autoProposalId ?? null;

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4">{t('loading')}</div>;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-5">{t('timeline.title')}</p>

      <ol className="relative ml-3">
        {PROCESS_STEPS.map((step, index) => {
          const ev = eventMap.get(step);
          const isDone = !!ev;
          const isCurrent = index === lastCompletedIndex && !negativeTerminal;
          const isBlocked = negativeTerminal !== null && index > negativeAfterStep;
          const isUpcoming = !isDone && !isBlocked;
          const isLast = index === PROCESS_STEPS.length - 1;

          // Show negative terminal after its corresponding positive step
          const showNegativeHere =
            negativeTerminal &&
            index === negativeAfterStep;

          return (
            <li key={step} className={`relative pb-7 ${isLast ? '' : ''}`}>
              {/* Vertical connector line */}
              {!isLast && (
                <span
                  className={`absolute left-[9px] top-5 bottom-0 w-0.5 ${
                    isDone && !showNegativeHere ? 'bg-green-300' :
                    showNegativeHere ? 'bg-red-200' :
                    'bg-gray-200'
                  }`}
                />
              )}

              <div className="flex items-start gap-3">
                {/* Step indicator */}
                <div className="relative flex-shrink-0 mt-0.5">
                  {isDone && !isCurrent ? (
                    // Completed
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 ring-4 ring-white">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : isCurrent ? (
                    // Current — pulsing amber
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 ring-4 ring-white ring-offset-0">
                      <span className="absolute w-5 h-5 rounded-full bg-amber-400 animate-ping opacity-60" />
                      <span className="relative w-2.5 h-2.5 rounded-full bg-white" />
                    </span>
                  ) : isBlocked ? (
                    // Blocked by failure
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 ring-4 ring-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    </span>
                  ) : (
                    // Upcoming
                    <span className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-gray-300 bg-white ring-4 ring-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    </span>
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-sm font-medium ${
                    isDone ? (isCurrent ? 'text-amber-700' : 'text-gray-800') :
                    isBlocked ? 'text-gray-300' :
                    'text-gray-400'
                  }`}>
                    {t(`timeline.events.${step}` as const)}
                  </p>

                  {ev && (
                    <div className="mt-0.5 space-y-0.5">
                      <p className="text-xs text-gray-400">{formatDate(ev.occurredAt)}</p>

                      {ev.actor?.name && (
                        <p className="text-xs text-gray-400">{ev.actor.name}</p>
                      )}

                      {/* Duration or ongoing age */}
                      {ev.durationHours != null && (
                        <p className="text-xs text-gray-400">
                          {t('timeline.duration')}: {formatDays(ev.durationHours)}
                        </p>
                      )}
                      {ev.currentAgeHours != null && (
                        <p className="text-xs font-medium text-amber-500">
                          {t('timeline.ongoing')}: {formatDays(ev.currentAgeHours)}
                        </p>
                      )}

                      {/* Confirm date action inline */}
                      {step === 'interview_scheduled' && effectiveConfirmProposalId && !hasConfirmed && (
                        <button
                          onClick={() => confirmDateMutation.mutate(effectiveConfirmProposalId!)}
                          disabled={confirmDateMutation.isPending}
                          className="mt-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          {confirmDateMutation.isPending ? '…' : t('timeline.confirmDate')}
                        </button>
                      )}

                      {/* Accept action inline */}
                      {step === 'interview_passed' && pendingAcceptProposalId && !hasAccepted && (
                        <button
                          onClick={() => acceptMutation.mutate(pendingAcceptProposalId)}
                          disabled={acceptMutation.isPending}
                          className="mt-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          {acceptMutation.isPending ? '…' : t('timeline.acceptCandidate')}
                        </button>
                      )}

                      {/* Provisional acceptance action inline (manager only) */}
                      {step === 'manager_confirmed' && provisionalAcceptanceCandidateId && !hasProvisionalAcceptance && (
                        <button
                          onClick={() => provisionalMutation.mutate(provisionalAcceptanceCandidateId)}
                          disabled={provisionalMutation.isPending}
                          className="mt-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          {provisionalMutation.isPending ? '…' : t('timeline.issueProvisional')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Upcoming hint */}
                  {isUpcoming && (
                    <p className="text-xs text-gray-300 mt-0.5">{t('timeline.pending')}</p>
                  )}
                </div>
              </div>

              {/* Negative terminal node — inserted right after its sibling step */}
              {showNegativeHere && negativeTerminal && (
                <div className="flex items-start gap-3 mt-4 ml-0">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 ring-4 ring-white">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-red-600">
                      {t(`timeline.events.${negativeTerminal.event}` as const)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(negativeTerminal.occurredAt)}</p>
                    {negativeTerminal.durationHours != null && (
                      <p className="text-xs text-gray-400">
                        {t('timeline.duration')}: {formatDays(negativeTerminal.durationHours)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {confirmDateMutation.isSuccess && (
        <p className="mt-2 text-sm text-green-600">{t('timeline.confirmDateSuccess')}</p>
      )}
      {acceptMutation.isSuccess && (
        <p className="mt-2 text-sm text-green-600">{t('timeline.acceptSuccess')}</p>
      )}
      {provisionalMutation.isSuccess && (
        <p className="mt-2 text-sm text-green-600">{t('timeline.provisionalSuccess')}</p>
      )}
    </div>
  );
}
