/**
 * SurveyPublicPage — public /angket route
 *
 * No auth required. Fetches /api/surveys/active and renders a bilingual
 * survey form. Completely isolated from any candidate/batch logic.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// ── Types ────────────────────────────────────────────────────────────────────

interface QuestionOption {
  value: string;
  labelId: string;
  labelJa: string;
}

interface SurveyQuestion {
  id: string;
  sortOrder: number;
  type: 'text' | 'textarea' | 'single' | 'multiple' | 'rating';
  questionId: string;
  questionJa: string;
  required: number;
  options: QuestionOption[] | null;
  groupLabelJa: string | null;
  groupLabelId: string | null;
}

interface Survey {
  id: string;
  titleId: string;
  titleJa: string;
  descriptionId: string | null;
  descriptionJa: string | null;
  questions: SurveyQuestion[];
}

interface AnswerPayload {
  questionId: string;
  answerText?: string;
  answerOptions?: string[];
}

// Public axios (no auth interceptor)
const publicApi = axios.create({ baseURL: '/api' });

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateToken(surveyId: string): string {
  const key = `survey-token-${surveyId}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem(key, token);
  return token;
}

function hasAlreadyResponded(surveyId: string): boolean {
  return localStorage.getItem(`survey-submitted-${surveyId}`) === '1';
}

function markAsResponded(surveyId: string): void {
  localStorage.setItem(`survey-submitted-${surveyId}`, '1');
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const selected = value.length > 0 ? parseInt(value[0], 10) : 0;
  return (
    <div className="flex gap-2 mt-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange([String(n)])}
          className={`text-2xl transition ${n <= selected ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
          aria-label={`${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function QuestionBlock({
  question,
  lang,
  answer,
  onAnswer,
  t,
}: {
  question: SurveyQuestion;
  lang: 'id' | 'ja';
  answer: AnswerPayload;
  onAnswer: (a: AnswerPayload) => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const questionText = lang === 'ja' ? question.questionJa : question.questionId;

  const labelFor = (opt: QuestionOption) =>
    lang === 'ja' ? opt.labelJa : opt.labelId;

  const toggleOption = (v: string) => {
    const current = answer.answerOptions ?? [];
    if (current.includes(v)) {
      onAnswer({ ...answer, answerOptions: current.filter((x) => x !== v) });
    } else {
      onAnswer({ ...answer, answerOptions: [...current, v] });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6">
      {/* Question text */}
      <p className="font-semibold text-gray-900 text-base leading-snug whitespace-pre-line">
        {questionText}
      </p>

      {/* Answer input */}
      <div className="mt-3">
        {question.type === 'text' && (
          <input
            type="text"
            value={answer.answerText ?? ''}
            onChange={(e) => onAnswer({ ...answer, answerText: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            placeholder=""
          />
        )}

        {question.type === 'textarea' && (
          <textarea
            rows={4}
            value={answer.answerText ?? ''}
            onChange={(e) => onAnswer({ ...answer, answerText: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-y"
            placeholder=""
          />
        )}

        {question.type === 'single' && (
          <div className="space-y-2 mt-1">
            {(question.options ?? []).map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={opt.value}
                  checked={(answer.answerOptions ?? []).includes(opt.value)}
                  onChange={() => onAnswer({ ...answer, answerOptions: [opt.value] })}
                  className="accent-navy-600 w-4 h-4 shrink-0"
                />
                <span className="text-sm text-gray-800 group-hover:text-gray-900">
                  {labelFor(opt)}
                </span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'multiple' && (
          <div className="space-y-2 mt-1">
            {(question.options ?? []).map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={(answer.answerOptions ?? []).includes(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                  className="accent-navy-600 w-4 h-4 shrink-0"
                />
                <span className="text-sm text-gray-800 group-hover:text-gray-900">
                  {labelFor(opt)}
                </span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'rating' && (
          <StarRating
            value={answer.answerOptions ?? []}
            onChange={(v) => onAnswer({ ...answer, answerOptions: v })}
          />
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function AisatsuBlock({ text, lang }: { text: string; lang: 'id' | 'ja' }) {
  const [open, setOpen] = useState(true);

  // Split into lines for formatting: first 2 lines = header, rest = body
  const lines = text.split('\n');
  const addressee = lines[0] ?? '';
  const sender    = lines[1] ?? '';
  // body = everything after the two header lines
  const body = lines.slice(2).join('\n').trim();

  return (
    <div className="mt-6 mb-2 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition text-left"
      >
        <span className="text-sm font-semibold text-gray-700">
          {lang === 'ja' ? '📄 ご挨拶・アンケートのご説明' : '📄 Salam Pembuka & Penjelasan Survei'}
        </span>
        <span className="text-gray-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-6 py-5 text-sm text-gray-700 leading-relaxed">
          <p className="font-semibold">{addressee}</p>
          <p className="text-gray-500 mb-4">{sender}</p>
          <p className="whitespace-pre-line">{body}</p>
        </div>
      )}
    </div>
  );
}

function SurveyClosing({ lang, t }: { lang: 'id' | 'ja'; t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white px-6 py-5 text-sm text-gray-700 leading-relaxed shadow-sm whitespace-pre-line">
      {t('survey.closing')}
    </div>
  );
}

function JisshiYoukou({ lang, t }: { lang: 'id' | 'ja'; t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="mt-4 mb-2 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-gray-700 leading-relaxed shadow-sm">
      <p className="font-bold text-gray-800 mb-3">{t('survey.youkou.title')}</p>
      <dl className="space-y-2">
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-600 shrink-0">【{t('survey.youkou.deadlineLabel')}】</dt>
          <dd>{t('survey.youkou.deadline')}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-600 shrink-0">【{t('survey.youkou.methodLabel')}】</dt>
          <dd>
            {t('survey.youkou.methodText')}{' '}
            <a
              href="https://jinzai.jobagus.id/angket"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline break-all"
            >
              https://jinzai.jobagus.id/angket
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-600 shrink-0">【{t('survey.youkou.scheduleLabel')}】</dt>
          <dd>{t('survey.youkou.scheduleText')}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-600 shrink-0">【{t('survey.youkou.contactLabel')}】</dt>
          <dd>{t('survey.youkou.contactText')}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function SurveyPublicPage() {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState<'id' | 'ja'>('ja');
  const [answers, setAnswers] = useState<Map<string, AnswerPayload>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: survey, isLoading, isError } = useQuery<Survey>({
    queryKey: ['public-active-survey'],
    queryFn: () => publicApi.get('/surveys/active').then((r) => r.data as Survey),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { respondentToken: string; answers: AnswerPayload[] }) => {
      await publicApi.post(`/surveys/${survey!.id}/respond`, payload);
    },
    onSuccess: () => {
      markAsResponded(survey!.id);
      setSubmitted(true);
    },
  });

  // Sync i18n language with lang state
  const toggleLang = () => {
    const next = lang === 'ja' ? 'id' : 'ja';
    setLang(next);
    i18n.changeLanguage(next);
  };

  const setAnswer = (questionId: string, a: AnswerPayload) => {
    setAnswers((prev) => new Map(prev).set(questionId, a));
    setValidationError(null);
  };

  const getAnswer = (questionId: string): AnswerPayload =>
    answers.get(questionId) ?? { questionId };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!survey) return;

    // Already responded check
    if (hasAlreadyResponded(survey.id)) {
      setSubmitted(true);
      return;
    }

    // Validate required questions
    for (const q of survey.questions) {
      if (!q.required) continue;
      const a = answers.get(q.id);
      const hasText = a?.answerText && a.answerText.trim().length > 0;
      const hasOptions = Array.isArray(a?.answerOptions) && a!.answerOptions.length > 0;
      if (!hasText && !hasOptions) {
        setValidationError(
          lang === 'ja'
            ? `未回答の必須質問があります: ${q.questionJa}`
            : `Ada pertanyaan wajib yang belum dijawab: ${q.questionId}`,
        );
        return;
      }
    }

    const token = getOrCreateToken(survey.id);
    const answerList = survey.questions.map((q) => getAnswer(q.id));

    submitMutation.mutate({ respondentToken: token, answers: answerList });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-8 h-14 border-b border-white/10 shadow-sm"
        style={{ background: '#0F1E2D' }}
      >
        <span className="font-serif text-lg text-white tracking-wide">IJBNet</span>
        <button
          onClick={toggleLang}
          className="text-xs font-medium text-white/80 border border-white/20 rounded-full px-3 py-1 hover:bg-white/10 transition"
        >
          {lang === 'ja' ? 'Indonesia' : '日本語'}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Loading */}
        {isLoading && (
          <div className="text-center text-gray-500 py-20 text-sm">
            {t('survey.loading')}
          </div>
        )}

        {/* No active survey */}
        {(isError || (!isLoading && !survey)) && (
          <div className="text-center py-20">
            <p className="text-xl text-gray-700 font-medium">
              {lang === 'ja' ? t('survey.noActive') : t('survey.noActiveDesc')}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {lang === 'ja' ? t('survey.noActiveDesc') : t('survey.noActive')}
            </p>
          </div>
        )}

        {/* Already responded */}
        {survey && hasAlreadyResponded(survey.id) && !submitted && (
          <div className="text-center py-20">
            <p className="text-xl text-gray-700 font-medium">
              {lang === 'ja' ? t('survey.alreadyResponded') : t('survey.alreadyRespondedJa')}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {lang === 'ja' ? t('survey.alreadyRespondedJa') : t('survey.alreadyResponded')}
            </p>
          </div>
        )}

        {/* Thank you */}
        {submitted && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-2xl font-bold text-gray-800">
              {lang === 'ja' ? t('survey.thankYouTitle') : t('survey.thankYouTitleJa')}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {lang === 'ja' ? t('survey.thankYouBody') : t('survey.thankYouBodyJa')}
            </p>
          </div>
        )}

        {/* Survey form */}
        {survey && !hasAlreadyResponded(survey.id) && !submitted && (
          <form onSubmit={handleSubmit} noValidate>
            {/* Survey header */}
            <div className="mb-8">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug text-center">
                {lang === 'ja' ? survey.titleJa : survey.titleId}
              </h1>
              {(lang === 'ja' ? survey.descriptionJa : survey.descriptionId) && (
                <AisatsuBlock
                  text={(lang === 'ja' ? survey.descriptionJa : survey.descriptionId) ?? ''}
                  lang={lang}
                />
              )}
              <JisshiYoukou lang={lang} t={t} />
            </div>

            {/* Questions */}
            <div className="space-y-4">
              {survey.questions
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((q, idx) => {
                  const groupLabel = lang === 'ja' ? q.groupLabelJa : q.groupLabelId;
                  return (
                    <div key={q.id}>
                      {groupLabel && (
                        <div className="pt-4 pb-1">
                          <div
                            className="text-sm font-bold text-white px-4 py-2 rounded-lg"
                            style={{ background: '#0F1E2D' }}
                          >
                            {groupLabel}
                          </div>
                        </div>
                      )}
                      <div className="relative">
                        <div className="absolute -left-0 top-5 w-6 h-6 rounded-full bg-navy-700 text-white text-xs font-bold flex items-center justify-center shadow -translate-x-full mr-2 hidden md:flex">
                          {idx + 1}
                        </div>
                        <QuestionBlock
                          question={q}
                          lang={lang}
                          answer={getAnswer(q.id)}
                          onAnswer={(a) => setAnswer(q.id, a)}
                          t={t}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Closing message */}
            <SurveyClosing lang={lang} t={t} />

            {/* Validation error */}
            {validationError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {validationError}
              </div>
            )}

            {/* Submit error */}
            {submitMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {t('survey.errorSubmit')}
              </div>
            )}

            {/* Submit button */}
            <div className="mt-8 flex justify-center">
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="px-8 py-3 rounded-xl font-semibold text-white text-sm shadow-md transition disabled:opacity-60"
                style={{ background: '#0F1E2D' }}
              >
                {submitMutation.isPending ? t('survey.submitting') : t('survey.submitBtn')}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
