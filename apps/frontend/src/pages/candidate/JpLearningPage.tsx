/**
 * JpLearningPage — /portal/jp-learning
 *
 * Three-screen flow: Topics → Lessons → Exercise (FlashCard or Quiz).
 * Progress is persisted via POST /api/jp/lessons/:id/complete.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  sortOrder: number;
  titleJa: string;
  titleId: string;
  type: 'vocabulary' | 'quiz';
  completed: boolean;
}

interface Topic {
  id: string;
  sortOrder: number;
  emoji: string;
  titleJa: string;
  titleId: string;
  descriptionJa: string | null;
  descriptionId: string | null;
  lessons: Lesson[];
  completedCount: number;
  totalCount: number;
}

interface CardData {
  front: { text: string; romaji: string };
  back: { meaning: string; example: string; exampleMeaning: string };
}

interface QuizData {
  question: string;
  options: { value: string; label: string }[];
  correct: string;
  explanation: string;
}

interface Exercise {
  id: string;
  sortOrder: number;
  type: 'card' | 'quiz';
  dataJson: CardData | QuizData;
}

interface LessonDetail {
  id: string;
  titleJa: string;
  titleId: string;
  type: 'vocabulary' | 'quiz';
  exercises: Exercise[];
  progress: { score: number | null; total: number | null } | null;
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total ? completed / total : 0;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <svg width="44" height="44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke={pct === 1 ? '#16a34a' : '#b8973a'}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="27" textAnchor="middle" fontSize="10" fontWeight="700"
        fill={pct === 1 ? '#16a34a' : '#b8973a'}>
        {completed}/{total}
      </text>
    </svg>
  );
}

// ── Flash Card ────────────────────────────────────────────────────────────────

function FlashCards({
  exercises,
  onComplete,
}: {
  exercises: Exercise[];
  onComplete: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current = exercises[idx];
  const card = current?.dataJson as CardData | undefined;
  const isLast = idx === exercises.length - 1;

  const next = () => {
    setFlipped(false);
    setTimeout(() => setIdx((i) => i + 1), 150);
  };

  if (!card) return null;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-gold-500 transition-all"
          style={{ width: `${((idx + 1) / exercises.length) * 100}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">{idx + 1} / {exercises.length}</p>

      {/* Card */}
      <div
        className="w-full max-w-md cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', minHeight: '220px' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-navy-200 bg-white shadow-lg px-6 py-8"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-3xl font-bold text-navy-800 text-center mb-2">{card.front.text}</p>
            <p className="text-sm text-gray-400 tracking-widest">{card.front.romaji}</p>
            <p className="mt-6 text-xs text-gray-300">Tap untuk melihat arti</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-gold-300 bg-gold-50 shadow-lg px-6 py-8"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-xl font-bold text-navy-800 text-center mb-2">{card.back.meaning}</p>
            {card.back.example && (
              <div className="mt-3 bg-white rounded-xl px-4 py-3 text-center shadow-sm border border-gold-200 w-full">
                <p className="text-sm font-medium text-navy-700">{card.back.example}</p>
                <p className="text-xs text-gray-500 mt-1">{card.back.exampleMeaning}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 w-full max-w-md">
        {!flipped ? (
          <button
            onClick={() => setFlipped(true)}
            className="flex-1 py-3 rounded-xl bg-navy-700 text-white font-semibold text-sm hover:bg-navy-800 transition"
          >
            Lihat Arti
          </button>
        ) : isLast ? (
          <button
            onClick={onComplete}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition"
          >
            ✅ Selesai
          </button>
        ) : (
          <button
            onClick={next}
            className="flex-1 py-3 rounded-xl bg-navy-700 text-white font-semibold text-sm hover:bg-navy-800 transition"
          >
            Lanjut →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

function Quiz({
  exercises,
  onComplete,
}: {
  exercises: Exercise[];
  onComplete: (score: number, total: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const current = exercises[idx];
  const q = current?.dataJson as QuizData | undefined;

  const handleSelect = (value: string) => {
    if (selected) return;
    setSelected(value);
    if (value === q?.correct) setScore((s) => s + 1);
  };

  const next = () => {
    const newScore = score + (selected === q?.correct ? 1 : 0);
    if (idx + 1 >= exercises.length) {
      setFinalScore(newScore);
      setFinished(true);
      onComplete(newScore, exercises.length);
    } else {
      setSelected(null);
      setIdx((i) => i + 1);
    }
  };

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="text-6xl">{finalScore >= exercises.length * 0.8 ? '🎉' : '📚'}</div>
        <p className="text-2xl font-bold text-navy-800">
          {score} / {exercises.length}
        </p>
        <p className="text-sm text-gray-500">
          {score >= exercises.length ? 'Sempurna!' : score >= exercises.length * 0.8 ? 'Bagus sekali!' : 'Tetap semangat!'}
        </p>
      </div>
    );
  }

  if (!q) return null;

  const isAnswered = !!selected;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-gold-500 transition-all"
          style={{ width: `${((idx + 1) / exercises.length) * 100}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 text-right">{idx + 1} / {exercises.length}</p>

      {/* Question */}
      <div className="bg-navy-800 rounded-2xl px-5 py-5">
        <p className="text-white font-bold text-base leading-relaxed">{q.question}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3">
        {q.options.map((opt) => {
          let cls = 'border-2 border-gray-200 bg-white text-gray-800 hover:border-navy-400';
          if (isAnswered) {
            if (opt.value === q.correct) cls = 'border-2 border-green-500 bg-green-50 text-green-800 font-semibold';
            else if (opt.value === selected) cls = 'border-2 border-red-400 bg-red-50 text-red-700';
            else cls = 'border-2 border-gray-100 bg-gray-50 text-gray-400';
          }
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={isAnswered}
              className={`w-full text-left rounded-xl px-4 py-3 text-sm transition ${cls}`}
            >
              <span className="font-bold mr-2">{opt.value.toUpperCase()}.</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {isAnswered && (
        <div className={`rounded-xl px-4 py-3 text-sm ${selected === q.correct ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <p className="font-semibold mb-1">{selected === q.correct ? '✅ Benar!' : '❌ Salah'}</p>
          <p>{q.explanation}</p>
        </div>
      )}

      {isAnswered && (
        <button
          onClick={next}
          className="w-full py-3 rounded-xl bg-navy-700 text-white font-semibold text-sm hover:bg-navy-800 transition"
        >
          {idx + 1 >= exercises.length ? 'Lihat Hasil' : 'Lanjut →'}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Screen =
  | { name: 'topics' }
  | { name: 'lessons'; topicId: string }
  | { name: 'exercise'; lessonId: string; lessonType: 'vocabulary' | 'quiz' };

export default function JpLearningPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>({ name: 'topics' });

  // ── Data fetching ───────────────────────────────────────────────────────────

  const topicsQuery = useQuery<Topic[]>({
    queryKey: ['jp-topics'],
    queryFn: () => api.get('/jp/topics').then((r: { data: Topic[] }) => r.data),
  });

  const lessonQuery = useQuery<LessonDetail>({
    queryKey: ['jp-lesson', screen.name === 'exercise' ? screen.lessonId : null],
    queryFn: () =>
      api.get(`/jp/lessons/${(screen as { name: 'exercise'; lessonId: string }).lessonId}`).then((r: { data: LessonDetail }) => r.data),
    enabled: screen.name === 'exercise',
  });

  const completeMutation = useMutation({
    mutationFn: ({ lessonId, score, total }: { lessonId: string; score?: number; total?: number }) =>
      api.post(`/jp/lessons/${lessonId}/complete`, { score, total }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jp-topics'] });
      void queryClient.invalidateQueries({ queryKey: ['jp-lesson'] });
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFlashComplete = () => {
    if (screen.name !== 'exercise') return;
    completeMutation.mutate({ lessonId: screen.lessonId });
    setScreen({ name: 'lessons', topicId: getCurrentTopicId() });
  };

  const handleQuizComplete = (score: number, total: number) => {
    if (screen.name !== 'exercise') return;
    completeMutation.mutate({ lessonId: screen.lessonId, score, total });
    setTimeout(() => setScreen({ name: 'lessons', topicId: getCurrentTopicId() }), 2000);
  };

  const getCurrentTopicId = (): string => {
    if (screen.name !== 'exercise') return '';
    const topics = topicsQuery.data ?? [];
    for (const t of topics) {
      if (t.lessons.some((l) => l.id === screen.lessonId)) return t.id;
    }
    return '';
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 mb-5">
        <button onClick={() => setScreen({ name: 'topics' })} className="hover:text-navy-700 font-medium">
          {t('navJpLearning')}
        </button>
        {screen.name !== 'topics' && (
          <>
            <span>/</span>
            {(() => {
              const topicId = screen.name === 'lessons' ? screen.topicId : getCurrentTopicId();
              const topic = topicsQuery.data?.find((t) => t.id === topicId);
              return (
                <button
                  onClick={() => setScreen({ name: 'lessons', topicId: topicId })}
                  className="hover:text-navy-700 font-medium"
                >
                  {topic?.emoji} {topic?.titleJa}
                </button>
              );
            })()}
          </>
        )}
        {screen.name === 'exercise' && (
          <>
            <span>/</span>
            <span className="text-navy-700 font-medium">
              {screen.lessonType === 'vocabulary' ? '単語カード' : 'クイズ'}
            </span>
          </>
        )}
      </nav>

      {/* ── Topics screen ─────────────────────────────────────────────────── */}
      {screen.name === 'topics' && (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-navy-800">🇯🇵 {t('navJpLearning')}</h1>
            <p className="text-sm text-gray-500 mt-1">レベル A1 — Starter</p>
          </div>

          {topicsQuery.isLoading && (
            <div className="text-center text-gray-400 py-20 text-sm">読み込み中…</div>
          )}

          {topicsQuery.isError && (
            <div className="text-center py-20 space-y-3">
              <p className="text-4xl">🇯🇵</p>
              <p className="text-base font-semibold text-gray-700">日本語学習機能はご利用いただけません</p>
              <p className="text-sm text-gray-400">この機能はまだあなたの研修センターでは有効になっていません。</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(topicsQuery.data ?? []).map((topic) => (
              <button
                key={topic.id}
                onClick={() => setScreen({ name: 'lessons', topicId: topic.id })}
                className="text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-navy-300 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-3xl">{topic.emoji}</div>
                  <ProgressRing completed={topic.completedCount} total={topic.totalCount} />
                </div>
                <p className="mt-3 font-bold text-navy-800 text-base group-hover:text-navy-600">{topic.titleJa}</p>
                <p className="text-xs text-gray-500 mt-0.5">{topic.titleId}</p>
                {topic.descriptionId && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{topic.descriptionId}</p>
                )}
                {topic.completedCount === topic.totalCount && topic.totalCount > 0 && (
                  <span className="inline-block mt-3 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                    ✅ Selesai
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Lessons screen ────────────────────────────────────────────────── */}
      {screen.name === 'lessons' && (() => {
        const topic = topicsQuery.data?.find((t) => t.id === screen.topicId);
        if (!topic) return null;
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">{topic.emoji}</span>
              <div>
                <h1 className="text-xl font-bold text-navy-800">{topic.titleJa}</h1>
                <p className="text-sm text-gray-500">{topic.titleId}</p>
              </div>
            </div>

            {topic.descriptionId && (
              <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
                {topic.descriptionId}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {topic.lessons.map((lesson, i) => (
                <button
                  key={lesson.id}
                  onClick={() => setScreen({ name: 'exercise', lessonId: lesson.id, lessonType: lesson.type })}
                  className="text-left bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 hover:border-navy-300 hover:shadow-md transition flex items-center gap-4"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${lesson.completed ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {lesson.completed ? '✅' : lesson.type === 'vocabulary' ? '🃏' : '❓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy-800 text-sm">
                      {i + 1}. {lesson.titleJa}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{lesson.titleId}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${lesson.type === 'vocabulary' ? 'bg-blue-50 text-blue-700' : 'bg-gold-50 text-gold-700'}`}>
                    {lesson.type === 'vocabulary' ? 'Flash Card' : 'Kuis'}
                  </span>
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* ── Exercise screen ───────────────────────────────────────────────── */}
      {screen.name === 'exercise' && (() => {
        if (lessonQuery.isLoading) return (
          <div className="text-center text-gray-400 py-20 text-sm">読み込み中…</div>
        );
        const lesson = lessonQuery.data;
        if (!lesson) return null;

        return (
          <>
            <div className="mb-5">
              <h1 className="text-lg font-bold text-navy-800">{lesson.titleJa}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{lesson.titleId}</p>
            </div>

            {lesson.type === 'vocabulary' ? (
              <FlashCards exercises={lesson.exercises} onComplete={handleFlashComplete} />
            ) : (
              <Quiz exercises={lesson.exercises} onComplete={handleQuizComplete} />
            )}
          </>
        );
      })()}
    </div>
  );
}
