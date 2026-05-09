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
  | 'interview_date_confirmed'
  | 'interview_scheduled'
  | 'manager_confirmed'
  | 'interview_passed'
  | 'interview_failed'
  | 'recruiter_accepted';

interface TimelineEvent {
  id: string;
  event: TimelineEventType;
  occurredAt: string;
  actorRole: string | null;
  actor?: { name?: string; role?: string } | null;
  metadata?: Record<string, unknown> | null;
  durationHours?: number | null;
  currentAgeHours?: number | null;
}

interface TimelineResponse {
  timeline: TimelineEvent[];
}

const EVENT_COLORS: Record<TimelineEventType, string> = {
  registered:               'bg-gray-400',
  consent_given:            'bg-blue-400',
  profile_submitted:        'bg-blue-500',
  profile_under_review:     'bg-amber-400',
  profile_approved:         'bg-green-500',
  profile_rejected:         'bg-red-500',
  batch_allocated:          'bg-indigo-400',
  recruiter_selected:       'bg-indigo-500',
  interview_proposed:       'bg-purple-400',
  interview_date_confirmed: 'bg-purple-500',
  interview_scheduled:      'bg-purple-600',
  manager_confirmed:        'bg-teal-500',
  interview_passed:         'bg-green-600',
  interview_failed:         'bg-red-600',
  recruiter_accepted:       'bg-teal-600',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(hours: number): string {
  const days = Math.round(hours / 24);
  return days < 1 ? '< 1 hari' : `${days} hari`;
}

interface Props {
  endpoint: string;
  queryKey: string[];
  pendingInterviewConfirmProposalId?: string | null;
  pendingAcceptProposalId?: string | null;
}

export default function CandidateTimeline({
  endpoint,
  queryKey,
  pendingInterviewConfirmProposalId,
  pendingAcceptProposalId,
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

  const events = data?.timeline ?? [];
  const hasConfirmed = events.some((e) => e.event === 'interview_date_confirmed');
  const hasAccepted = events.some((e) => e.event === 'recruiter_accepted');

  const scheduledEvent = events.find((e) => e.event === 'interview_scheduled');
  const autoProposalId = scheduledEvent?.metadata?.proposalId as string | null | undefined;
  const effectiveConfirmProposalId = pendingInterviewConfirmProposalId ?? autoProposalId ?? null;

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4">{t('loading')}</div>;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-4">{t('timeline.title')}</p>

      {events.length === 0 ? (
        <p className="text-sm text-gray-400">{t('timeline.empty')}</p>
      ) : (
        <ol className="relative border-l border-gray-200 ml-3 space-y-5">
          {events.map((ev) => {
            const displayHours = ev.durationHours ?? ev.currentAgeHours ?? null;
            const isCurrent = ev.currentAgeHours != null;

            return (
              <li key={ev.id} className="ml-5">
                <span
                  className={`absolute -left-2.5 flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${EVENT_COLORS[ev.event] ?? 'bg-gray-300'}`}
                />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-gray-800">
                    {t(`timeline.events.${ev.event}` as const)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(ev.occurredAt)}</p>
                  {ev.actor?.name && (
                    <p className="text-xs text-gray-400">
                      {ev.actor.name}
                      {ev.actor.role && (
                        <span className="ml-1 capitalize text-gray-300">({ev.actor.role})</span>
                      )}
                    </p>
                  )}
                  {displayHours != null && (
                    <p className={`text-xs font-medium mt-0.5 ${isCurrent ? 'text-amber-500' : 'text-gray-400'}`}>
                      {isCurrent
                        ? `${t('timeline.ongoing')}: ${formatDuration(displayHours)}`
                        : `${t('timeline.duration')}: ${formatDuration(displayHours)}`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Candidate confirm-date action */}
      {effectiveConfirmProposalId && !hasConfirmed && (
        <button
          onClick={() => confirmDateMutation.mutate(effectiveConfirmProposalId!)}
          disabled={confirmDateMutation.isPending}
          className="mt-5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          {confirmDateMutation.isPending ? t('loading') : t('timeline.confirmDate')}
        </button>
      )}
      {confirmDateMutation.isSuccess && (
        <p className="mt-2 text-sm text-green-600">{t('timeline.confirmDateSuccess')}</p>
      )}

      {/* Recruiter accept action */}
      {pendingAcceptProposalId && !hasAccepted && (
        <button
          onClick={() => acceptMutation.mutate(pendingAcceptProposalId)}
          disabled={acceptMutation.isPending}
          className="mt-5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          {acceptMutation.isPending ? t('loading') : t('timeline.acceptCandidate')}
        </button>
      )}
      {acceptMutation.isSuccess && (
        <p className="mt-2 text-sm text-green-600">{t('timeline.acceptSuccess')}</p>
      )}
    </div>
  );
}
