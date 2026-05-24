import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type StepKey =
  | 'registered' | 'consent_given' | 'profile_submitted' | 'profile_under_review'
  | 'profile_approved' | 'profile_rejected' | 'batch_allocated' | 'recruiter_selected'
  | 'interview_proposed' | 'interview_date_confirmed' | 'interview_scheduled'
  | 'interview_passed' | 'interview_failed' | 'recruiter_accepted' | 'manager_confirmed'
  | 'provisional_acceptance';

interface TimelineEvent {
  id: string;
  event: StepKey;
  occurredAt: string;
  actor?: { name?: string; role?: string } | null;
  durationHours?: number | null;
  currentAgeHours?: number | null;
}

// ── Static config ─────────────────────────────────────────────────────────────
const PROCESS_STEPS: StepKey[] = [
  'registered', 'consent_given', 'profile_submitted', 'profile_under_review',
  'profile_approved', 'batch_allocated', 'recruiter_selected', 'interview_proposed',
  'interview_date_confirmed', 'interview_scheduled', 'interview_passed',
  'recruiter_accepted', 'manager_confirmed', 'provisional_acceptance',
];

const NEGATIVE_TERMINALS: Partial<Record<StepKey, StepKey>> = {
  profile_approved: 'profile_rejected',
  interview_passed: 'interview_failed',
};

const STEP_ICON: Record<StepKey, string> = {
  registered:               '🎉',
  consent_given:            '🤝',
  profile_submitted:        '📝',
  profile_under_review:     '🔍',
  profile_approved:         '✅',
  profile_rejected:         '❌',
  batch_allocated:          '📋',
  recruiter_selected:       '⭐',
  interview_proposed:       '📅',
  interview_date_confirmed: '📌',
  interview_scheduled:      '🗓️',
  interview_passed:         '🎯',
  interview_failed:         '💔',
  recruiter_accepted:       '🏅',
  manager_confirmed:        '🏆',
  provisional_acceptance:   '🎌',
};

type StepColors = { card: string; iconBg: string; text: string; subtext: string; badge: string };

const STEP_COLORS: Record<StepKey, StepColors> = {
  registered:               { card: 'bg-purple-50 border-purple-200',  iconBg: 'bg-purple-100',  text: 'text-purple-800',  subtext: 'text-purple-500',  badge: 'bg-purple-500' },
  consent_given:            { card: 'bg-blue-50 border-blue-200',      iconBg: 'bg-blue-100',    text: 'text-blue-800',    subtext: 'text-blue-400',    badge: 'bg-blue-500' },
  profile_submitted:        { card: 'bg-indigo-50 border-indigo-200',  iconBg: 'bg-indigo-100',  text: 'text-indigo-800',  subtext: 'text-indigo-400',  badge: 'bg-indigo-500' },
  profile_under_review:     { card: 'bg-amber-50 border-amber-200',    iconBg: 'bg-amber-100',   text: 'text-amber-800',   subtext: 'text-amber-500',   badge: 'bg-amber-500' },
  profile_approved:         { card: 'bg-green-50 border-green-200',    iconBg: 'bg-green-100',   text: 'text-green-800',   subtext: 'text-green-500',   badge: 'bg-green-500' },
  profile_rejected:         { card: 'bg-red-50 border-red-200',        iconBg: 'bg-red-100',     text: 'text-red-800',     subtext: 'text-red-400',     badge: 'bg-red-500' },
  batch_allocated:          { card: 'bg-cyan-50 border-cyan-200',      iconBg: 'bg-cyan-100',    text: 'text-cyan-800',    subtext: 'text-cyan-500',    badge: 'bg-cyan-500' },
  recruiter_selected:       { card: 'bg-yellow-50 border-yellow-200',  iconBg: 'bg-yellow-100',  text: 'text-yellow-800',  subtext: 'text-yellow-500',  badge: 'bg-yellow-500' },
  interview_proposed:       { card: 'bg-orange-50 border-orange-200',  iconBg: 'bg-orange-100',  text: 'text-orange-800',  subtext: 'text-orange-500',  badge: 'bg-orange-500' },
  interview_date_confirmed: { card: 'bg-pink-50 border-pink-200',      iconBg: 'bg-pink-100',    text: 'text-pink-800',    subtext: 'text-pink-400',    badge: 'bg-pink-500' },
  interview_scheduled:      { card: 'bg-violet-50 border-violet-200',  iconBg: 'bg-violet-100',  text: 'text-violet-800',  subtext: 'text-violet-400',  badge: 'bg-violet-500' },
  interview_passed:         { card: 'bg-teal-50 border-teal-200',      iconBg: 'bg-teal-100',    text: 'text-teal-800',    subtext: 'text-teal-500',    badge: 'bg-teal-500' },
  interview_failed:         { card: 'bg-red-50 border-red-200',        iconBg: 'bg-red-100',     text: 'text-red-800',     subtext: 'text-red-400',     badge: 'bg-red-500' },
  recruiter_accepted:       { card: 'bg-amber-50 border-amber-300',    iconBg: 'bg-amber-100',   text: 'text-amber-800',   subtext: 'text-amber-500',   badge: 'bg-amber-600' },
  manager_confirmed:        { card: 'bg-yellow-50 border-yellow-300',  iconBg: 'bg-yellow-100',  text: 'text-yellow-800',  subtext: 'text-yellow-600',  badge: 'bg-yellow-600' },
  provisional_acceptance:   { card: 'bg-red-50 border-red-300',        iconBg: 'bg-red-100',     text: 'text-red-800',     subtext: 'text-red-500',     badge: 'bg-red-600' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDays(hours: number, unit: string) {
  const d = Math.round(hours / 24);
  return d < 1 ? `< 1 ${unit}` : `${d} ${unit}`;
}

// ── Japan celebration banner ──────────────────────────────────────────────────
function JapanWelcomeBanner({ lang }: { lang: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-red-700 p-6 shadow-xl">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white/15" />
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-white/10" />

      {/* Floating cherry blossoms */}
      {[
        { pos: 'top-2 left-4',   size: 'text-2xl', delay: '0s'    },
        { pos: 'top-4 right-20', size: 'text-xl',  delay: '0.35s' },
        { pos: 'bottom-3 left-14', size: 'text-lg', delay: '0.7s' },
        { pos: 'bottom-2 right-6', size: 'text-2xl', delay: '0.2s' },
      ].map((b, i) => (
        <span
          key={i}
          className={`pointer-events-none absolute ${b.pos} ${b.size} animate-bounce opacity-70`}
          style={{ animationDelay: b.delay }}
        >
          🌸
        </span>
      ))}

      <div className="relative text-center text-white">
        {/* Main icons */}
        <div className="mb-3 flex items-center justify-center gap-3">
          {['🗾', '🎌', '🗻'].map((emoji, i) => (
            <span
              key={i}
              className="animate-bounce text-4xl"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {emoji}
            </span>
          ))}
        </div>

        {/* Big heading */}
        <h2
          className="mb-1 text-3xl font-bold tracking-widest"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          日本へようこそ！
        </h2>

        {/* Sub-heading */}
        <p className="text-base font-semibold text-red-100">
          {lang === 'ja' ? 'おめでとうございます！' : 'Selamat Datang di Jepang!'}
        </p>

        {/* Body */}
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-red-200">
          {lang === 'ja'
            ? '仮内定が正式に発行されました。新しい旅の始まりです！'
            : 'Surat Penerimaan Sementara (仮内定) Anda telah diterbitkan. Selamat atas pencapaian luar biasa ini!'}
        </p>

        {/* Footer ribbon */}
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-red-500/40 pt-3">
          <span className="text-sm">🌸</span>
          <span className="text-xs font-medium uppercase tracking-widest text-red-200">
            Nihon e Yōkoso
          </span>
          <span className="text-sm">🌸</span>
        </div>
      </div>
    </div>
  );
}

// ── Checkmark icon ────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 12 12">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 12 12">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CandidateJourney() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data, isLoading } = useQuery<{ timeline: TimelineEvent[] }>({
    queryKey: ['my-timeline'],
    queryFn: () => api.get('/candidates/me/timeline').then((r) => r.data),
  });

  if (isLoading) {
    return <div className="py-4 text-sm text-gray-400">{t('loading')}</div>;
  }

  const events = data?.timeline ?? [];
  const eventMap = new Map<StepKey, TimelineEvent>();
  for (const ev of events) eventMap.set(ev.event, ev);

  // Detect negative terminal
  let negativeTerminalEvent: TimelineEvent | null = null;
  let negativeAfterIndex = -1;
  for (const [pos, neg] of Object.entries(NEGATIVE_TERMINALS)) {
    if (eventMap.has(neg as StepKey)) {
      negativeTerminalEvent = eventMap.get(neg as StepKey)!;
      negativeAfterIndex = PROCESS_STEPS.indexOf(pos as StepKey);
      break;
    }
  }

  // Last completed index (among positive steps)
  let lastCompletedIndex = -1;
  for (let i = 0; i < PROCESS_STEPS.length; i++) {
    if (eventMap.has(PROCESS_STEPS[i]!)) lastCompletedIndex = i;
  }

  const hasProvisional = eventMap.has('provisional_acceptance');
  const completedCount = PROCESS_STEPS.filter((s) => eventMap.has(s)).length;
  const totalSteps = PROCESS_STEPS.length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="space-y-4">
      {/* Header + step counter */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {lang === 'ja' ? '私の歩み' : 'Perjalanan Saya'}
        </p>
        <span className="text-xs text-gray-400">
          {completedCount}/{totalSteps}&nbsp;
          {lang === 'ja' ? 'ステップ完了' : 'tahap selesai'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            hasProvisional
              ? 'bg-gradient-to-r from-red-500 to-rose-500'
              : 'bg-gradient-to-r from-navy-700 to-indigo-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Japan welcome banner — shown only when final step achieved */}
      {hasProvisional && <JapanWelcomeBanner lang={lang} />}

      {/* Step cards */}
      <div className="space-y-2">
        {PROCESS_STEPS.map((step, index) => {
          const ev = eventMap.get(step);
          const isDone = !!ev;
          const isBlocked = negativeTerminalEvent !== null && index > negativeAfterIndex;
          const isCurrent = isDone && index === lastCompletedIndex && !negativeTerminalEvent;
          const showNegativeHere = negativeTerminalEvent && index === negativeAfterIndex;
          const cfg = STEP_COLORS[step];

          if (isBlocked) return null;

          return (
            <div key={step}>
              {/* Step card */}
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                  isDone && isCurrent
                    ? 'border-amber-300 bg-amber-50 shadow-md ring-2 ring-amber-200 ring-offset-1'
                    : isDone
                    ? `${cfg.card} shadow-sm`
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
              >
                {/* Icon circle */}
                <div
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl ${
                    isDone ? cfg.iconBg : 'bg-gray-100'
                  }`}
                >
                  {isDone ? (
                    STEP_ICON[step]
                  ) : (
                    <span className="text-base text-gray-300">○</span>
                  )}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      isCurrent ? 'text-amber-800' : isDone ? cfg.text : 'text-gray-400'
                    }`}
                  >
                    {t(`timeline.events.${step}` as const)}
                  </p>

                  {/* Date + duration */}
                  {ev && (
                    <p className={`mt-0.5 text-xs ${isCurrent ? 'text-amber-600' : cfg.subtext}`}>
                      {formatDate(ev.occurredAt)}
                      {ev.durationHours != null &&
                        ` · ${formatDays(ev.durationHours, t('timeline.dayUnit'))}`}
                    </p>
                  )}

                  {/* Ongoing duration for current step */}
                  {isCurrent && ev?.currentAgeHours != null && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-600">
                      {t('timeline.ongoing')}: {formatDays(ev.currentAgeHours, t('timeline.dayUnit'))}
                    </p>
                  )}

                  {/* Upcoming hint */}
                  {!isDone && (
                    <p className="mt-0.5 text-xs text-gray-300">{t('timeline.pending')}</p>
                  )}
                </div>

                {/* Right badge */}
                <div className="flex-shrink-0">
                  {isCurrent ? (
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-4 w-4 animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="h-3 w-3 rounded-full bg-amber-500" />
                    </span>
                  ) : isDone && step === 'provisional_acceptance' ? (
                    <span className="animate-bounce text-xl">🎌</span>
                  ) : isDone ? (
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${cfg.badge}`}
                    >
                      <CheckIcon />
                    </span>
                  ) : (
                    <span className="h-3 w-3 rounded-full border-2 border-gray-300" />
                  )}
                </div>
              </div>

              {/* Negative terminal card — inserted right after its sibling step */}
              {showNegativeHere && negativeTerminalEvent && (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-xl">
                    {STEP_ICON[negativeTerminalEvent.event] ?? '❌'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-red-800">
                      {t(`timeline.events.${negativeTerminalEvent.event}` as const)}
                    </p>
                    <p className="mt-0.5 text-xs text-red-400">
                      {formatDate(negativeTerminalEvent.occurredAt)}
                    </p>
                  </div>
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500">
                    <CrossIcon />
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
