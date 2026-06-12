import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { JrasInstrumentDetail, JrasItemData, JrasReviewItemNote } from '../../types/jras';

type ItemNoteState = Record<string, { verdict: 'ok' | 'needs_change'; comment: string }>;

function ItemCard({
  item,
  index,
  note,
  readonly,
  onChange,
}: {
  item: JrasItemData;
  index: number;
  note: { verdict: 'ok' | 'needs_change'; comment: string };
  readonly: boolean;
  onChange: (verdict: 'ok' | 'needs_change', comment: string) => void;
}) {
  const { t } = useTranslation();
  const scoring = item.scoringJson;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
        <div className="flex gap-1.5">
          {item.criticalFlag && (
            <span className="text-[10px] font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
              {t('jras.criticalBadge')}
            </span>
          )}
          {item.sensitive && (
            <span className="text-[10px] font-medium bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
              {t('jras.sensitiveBadge')}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{item.promptId}</p>
        <p className="text-sm text-gray-500 whitespace-pre-wrap">{item.promptJa}</p>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">{t('jras.optionsLabel')}</p>
        <div className="space-y-1.5">
          {item.optionsJson.map((opt, i) => {
            const weight = scoring.scoringType === 'weighted' ? scoring.weights?.[i] : undefined;
            const isCorrect = scoring.scoringType === 'keyed' && scoring.correctIndex === i;
            return (
              <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-gray-400 mt-0.5">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800">{opt.labelId}</p>
                  <p className="text-xs text-gray-500">{opt.labelJa}</p>
                </div>
                {weight !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      weight >= 0.67 ? 'bg-green-100 text-green-700'
                      : weight >= 0.34 ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {t('jras.weightLabel')} {weight}
                  </span>
                )}
                {isCorrect && (
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0">
                    ✓ {t('jras.correctLabel')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {scoring.scoringType === 'likert' && scoring.reverse && (
        <p className="text-xs text-amber-600">⚠ {t('jras.reverseLabel')}</p>
      )}

      {item.type === 'sjt' && (
        <div className="bg-navy-50 rounded-lg px-3 py-2">
          <p className="text-[10px] font-bold text-navy-700 uppercase mb-0.5">
            {t('jras.rationaleLabel')}
          </p>
          {scoring.rationale ? (
            <p className="text-xs text-navy-900 whitespace-pre-wrap">{scoring.rationale}</p>
          ) : (
            <p className="text-xs text-red-600">{t('jras.rationaleMissing')}</p>
          )}
        </div>
      )}

      {/* Per-item verdict */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex gap-2">
          <button
            disabled={readonly}
            onClick={() => onChange('ok', note.comment)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:cursor-default ${
              note.verdict === 'ok'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            ✓ {t('jras.itemOk')}
          </button>
          <button
            disabled={readonly}
            onClick={() => onChange('needs_change', note.comment)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:cursor-default ${
              note.verdict === 'needs_change'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            ✎ {t('jras.itemNeedsChange')}
          </button>
        </div>
        {(note.verdict === 'needs_change' || note.comment) && (
          <textarea
            value={note.comment}
            disabled={readonly}
            onChange={(e) => onChange(note.verdict, e.target.value)}
            placeholder={t('jras.itemCommentPlaceholder')}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-navy-500 disabled:bg-gray-50"
          />
        )}
      </div>
    </div>
  );
}

export default function ReviewerInstrumentPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lang = i18n.language;

  const [itemNotes, setItemNotes] = useState<ItemNoteState>({});
  const [verdict, setVerdict] = useState<'approve' | 'request_changes' | ''>('');
  const [note, setNote] = useState('');
  const [submitError, setSubmitError] = useState('');

  const { data, isLoading, isError } = useQuery<JrasInstrumentDetail>({
    queryKey: ['jras-reviewer-instrument', id],
    queryFn: () => api.get(`/jras/reviewer/instruments/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const alreadyReviewed =
    !!data?.myReview && data.myReview.instrumentVersion === data.version;
  const readonly = alreadyReviewed || data?.status !== 'in_review';

  const mutation = useMutation({
    mutationFn: () => {
      const notes: JrasReviewItemNote[] = (data?.items ?? []).map((item) => {
        const n = itemNotes[item.id] ?? { verdict: 'ok' as const, comment: '' };
        return { itemId: item.id, verdict: n.verdict, ...(n.comment ? { comment: n.comment } : {}) };
      });
      return api.post(`/jras/reviewer/instruments/${id}/review`, {
        verdict,
        ...(note ? { note } : {}),
        itemNotes: notes,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jras-reviewer-queue'] });
      void qc.invalidateQueries({ queryKey: ['jras-reviewer-instrument', id] });
      navigate('/reviewer/queue');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg ?? t('toastError'));
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">{t('loading')}</div>;
  if (isError || !data) return <div className="p-6 text-sm text-red-600">{t('toastError')}</div>;

  const getNote = (itemId: string) => itemNotes[itemId] ?? { verdict: 'ok' as const, comment: '' };
  const anyNeedsChange = Object.values(itemNotes).some((n) => n.verdict === 'needs_change');

  // Tampilan read-only memakai itemNotes dari review yang sudah terkirim
  const savedNotes: ItemNoteState = {};
  if (readonly && data.myReview?.itemNotesJson) {
    for (const n of data.myReview.itemNotesJson) {
      savedNotes[n.itemId] = { verdict: n.verdict, comment: n.comment ?? '' };
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/reviewer/queue" className="text-sm text-gray-400 hover:text-gray-600">←</Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {lang === 'ja' ? data.titleJa : data.titleId}
          </h1>
          <p className="text-xs text-gray-400">
            {t(`jras.dim.${data.dimensionKey}`)} · {t(`jras.type.${data.type}`)} · {t('jras.version')} {data.version}
          </p>
        </div>
      </div>

      {(data.descriptionId || data.descriptionJa) && (
        <p className="text-sm text-gray-600 bg-white rounded-xl border border-gray-100 p-4">
          {lang === 'ja' ? (data.descriptionJa ?? data.descriptionId) : (data.descriptionId ?? data.descriptionJa)}
        </p>
      )}

      {alreadyReviewed && data.myReview && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          ✓ {t('jras.myReviewReadonly')} — {t(`jras.verdict${data.myReview.verdict === 'approve' ? 'Approve' : 'RequestChanges'}`)}
          {data.myReview.note && <p className="mt-1 text-xs text-green-700">{data.myReview.note}</p>}
        </div>
      )}

      <div className="space-y-3">
        {data.items.map((item, idx) => (
          <ItemCard
            key={item.id}
            item={item}
            index={idx}
            readonly={readonly}
            note={readonly ? (savedNotes[item.id] ?? { verdict: 'ok', comment: '' }) : getNote(item.id)}
            onChange={(v, c) => setItemNotes((s) => ({ ...s, [item.id]: { verdict: v, comment: c } }))}
          />
        ))}
      </div>

      {!readonly && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('jras.verdictLabel')}</h2>

          {anyNeedsChange && verdict === 'approve' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
              {t('jras.needsChangeHint')}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setVerdict('approve')}
              className={`flex-1 text-sm font-medium px-4 py-2.5 rounded-lg transition ${
                verdict === 'approve' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ✓ {t('jras.verdictApprove')}
            </button>
            <button
              onClick={() => setVerdict('request_changes')}
              className={`flex-1 text-sm font-medium px-4 py-2.5 rounded-lg transition ${
                verdict === 'request_changes' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ✎ {t('jras.verdictRequestChanges')}
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('jras.noteLabel')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('jras.notePlaceholder')}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>

          {submitError && <p className="text-xs text-red-600">{submitError}</p>}

          <button
            disabled={!verdict || mutation.isPending}
            onClick={() => {
              if (confirm(t('jras.submitConfirm'))) mutation.mutate();
            }}
            className="w-full bg-navy-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-navy-800 transition disabled:opacity-50"
          >
            {mutation.isPending ? '…' : t('jras.submitReview')}
          </button>
        </div>
      )}
    </div>
  );
}
