import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { JRAS_DIMENSION_KEYS } from '@ijbnet/shared';
import type { JrasReviewerType } from '@ijbnet/shared';
import type { JrasInstrumentDetail, JrasItemData, JrasReviewData } from '../../types/jras';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  retired: 'bg-gray-100 text-gray-400',
};

function apiError(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { message?: string; details?: unknown } } })?.response?.data;
  return data?.message ?? (data?.details ? JSON.stringify(data.details) : fallback);
}

// ── Item read-only card (tampilan sama dengan portal reviewer, tanpa verdict) ──

function ItemView({ item, index }: { item: JrasItemData; index: number }) {
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
    </div>
  );
}

// ── Review masuk ──────────────────────────────────────────────────────────────

function ReviewCard({ review, items }: { review: JrasReviewData; items: JrasItemData[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const indexById = new Map(items.map((it, idx) => [it.id, idx]));
  const itemNotes = (review.itemNotesJson ?? []).filter((n) => n.verdict === 'needs_change' || n.comment);

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            review.verdict === 'approve' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {review.verdict === 'approve' ? `✓ ${t('jras.verdictApprove')}` : `✎ ${t('jras.verdictRequestChanges')}`}
        </span>
        <span className="text-sm font-medium text-gray-900">
          {review.reviewer?.name ?? review.reviewer?.email ?? '—'}
        </span>
        {review.reviewerType && (
          <span className="text-xs text-gray-400">{t(`jras.reviewerType.${review.reviewerType}`)}</span>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          v{review.instrumentVersion} · {new Date(review.submittedAt).toLocaleDateString()}
        </span>
      </div>

      {review.note && <p className="text-xs text-gray-600 whitespace-pre-wrap">{review.note}</p>}

      {itemNotes.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            {expanded ? '▾' : '▸'} {t('jras.itemNeedsChange')} ({itemNotes.length})
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {itemNotes.map((n) => (
                <div key={n.itemId} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-bold text-gray-400">
                    #{(indexById.get(n.itemId) ?? -1) + 1 || '?'}
                    {n.verdict === 'needs_change' && (
                      <span className="text-amber-600 ml-1.5">✎ {t('jras.itemNeedsChange')}</span>
                    )}
                  </p>
                  {n.comment && <p className="text-xs text-gray-700 whitespace-pre-wrap">{n.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────

export default function SuperAdminJrasInstrument() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lang = i18n.language;

  const [meta, setMeta] = useState<{
    dimensionKey: string; type: string; titleId: string; titleJa: string;
    descriptionId: string; descriptionJa: string;
  } | null>(null);
  const [itemsJson, setItemsJson] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery<JrasInstrumentDetail>({
    queryKey: ['jras-superadmin-instrument', id],
    queryFn: () => api.get(`/jras/superadmin/instruments/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['jras-superadmin-instrument', id] });
    void qc.invalidateQueries({ queryKey: ['jras-instruments'] });
  };

  const actionMutation = useMutation({
    mutationFn: (action: 'send-to-review' | 'return-to-draft' | 'activate' | 'retire') =>
      api.post(`/jras/superadmin/instruments/${id}/${action}`),
    onSuccess: () => { setError(''); invalidate(); },
    onError: (e: unknown) => setError(apiError(e, t('toastError'))),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/jras/superadmin/instruments/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jras-instruments'] });
      navigate('/superadmin/jras');
    },
    onError: (e: unknown) => setError(apiError(e, t('toastError'))),
  });

  const metaMutation = useMutation({
    mutationFn: () => api.put(`/jras/superadmin/instruments/${id}`, {
      dimensionKey: meta!.dimensionKey,
      type: meta!.type,
      titleId: meta!.titleId,
      titleJa: meta!.titleJa,
      descriptionId: meta!.descriptionId || null,
      descriptionJa: meta!.descriptionJa || null,
    }),
    onSuccess: () => { setMeta(null); setError(''); invalidate(); },
    onError: (e: unknown) => setError(apiError(e, t('toastError'))),
  });

  const itemsMutation = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(itemsJson ?? '');
      } catch {
        throw new Error('INVALID_JSON');
      }
      return api.put(`/jras/superadmin/instruments/${id}/items`, { items: parsed });
    },
    onSuccess: () => { setItemsJson(null); setError(''); invalidate(); },
    onError: (e: unknown) => {
      if ((e as Error).message === 'INVALID_JSON') { setError('JSON tidak valid'); return; }
      setError(apiError(e, t('toastError')));
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">{t('loading')}</div>;
  if (isError || !data) return <div className="p-6 text-sm text-red-600">{t('toastError')}</div>;

  const isDraft = data.status === 'draft';
  const approval = data.approval;
  const currentReviews = (data.reviews ?? []).filter((r) => r.instrumentVersion === data.version);

  // Items dalam format import (untuk editor JSON)
  const itemsAsImportJson = () => JSON.stringify(
    data.items.map((it) => ({
      type: it.type,
      promptId: it.promptId,
      promptJa: it.promptJa,
      options: it.optionsJson,
      scoring: it.scoringJson,
      ...(it.criticalFlag ? { criticalFlag: true } : {}),
      ...(it.sensitive ? { sensitive: true } : {}),
    })),
    null,
    2,
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/superadmin/jras" className="text-sm text-gray-400 hover:text-gray-600">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">
            {lang === 'ja' ? data.titleJa : data.titleId}
          </h1>
          <p className="text-xs text-gray-400">
            {t(`jras.dim.${data.dimensionKey}`)} · {t(`jras.type.${data.type}`)} · {t('jras.version')} {data.version}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[data.status]}`}>
          {t(`jras.status.${data.status}`)}
        </span>
      </div>

      {/* Aksi sesuai status */}
      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <>
            <button
              onClick={() => actionMutation.mutate('send-to-review')}
              disabled={actionMutation.isPending || data.items.length === 0}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
            >
              {t('superadmin.jras.sendToReview')}
            </button>
            <button
              onClick={() => { if (confirm(t('superadmin.jras.deleteConfirm'))) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
              className="border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            >
              {t('superadmin.jras.deleteInstrument')}
            </button>
          </>
        )}
        {(data.status === 'in_review' || data.status === 'approved') && (
          <button
            onClick={() => actionMutation.mutate('return-to-draft')}
            disabled={actionMutation.isPending}
            className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            {t('superadmin.jras.returnToDraft')}
          </button>
        )}
        {data.status === 'approved' && (
          <button
            onClick={() => actionMutation.mutate('activate')}
            disabled={actionMutation.isPending || !approval?.quotaMet}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {t('superadmin.jras.activate')}
          </button>
        )}
        {data.status === 'active' && (
          <button
            onClick={() => actionMutation.mutate('retire')}
            disabled={actionMutation.isPending}
            className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            {t('superadmin.jras.retire')}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 break-all">{error}</p>}

      {/* Status kuota persetujuan */}
      {approval && data.status !== 'draft' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('superadmin.jras.quotaStatus')}</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {(['ex_ssw', 'jp_hr'] as JrasReviewerType[]).map((type) => {
              const got = approval.approvals[type] ?? 0;
              const need = approval.quota[type as 'ex_ssw' | 'jp_hr'];
              return (
                <span
                  key={type}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    got >= need ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {t(`jras.reviewerType.${type}`)}: {got}/{need}
                </span>
              );
            })}
            {(approval.approvals.expert ?? 0) > 0 && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600">
                {t('jras.reviewerType.expert')}: {approval.approvals.expert}
              </span>
            )}
          </div>
          <p className={`text-xs mt-2 ${approval.quotaMet ? 'text-green-600' : 'text-amber-600'}`}>
            {approval.quotaMet ? `✓ ${t('superadmin.jras.quotaMet')}` : t('superadmin.jras.quotaNotMet')}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{t('superadmin.jras.metaTitle')}</h2>
          {isDraft && !meta && (
            <button
              onClick={() => setMeta({
                dimensionKey: data.dimensionKey,
                type: data.type,
                titleId: data.titleId,
                titleJa: data.titleJa,
                descriptionId: data.descriptionId ?? '',
                descriptionJa: data.descriptionJa ?? '',
              })}
              className="text-xs text-blue-600 hover:underline"
            >
              {t('btnEdit')}
            </button>
          )}
        </div>
        {!isDraft && <p className="text-xs text-gray-400">{t('superadmin.jras.draftOnlyHint')}</p>}

        {meta ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colDimension')}</label>
                <select
                  value={meta.dimensionKey}
                  onChange={(e) => setMeta((m) => m && ({ ...m, dimensionKey: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {JRAS_DIMENSION_KEYS.map((d) => (
                    <option key={d} value={d}>{t(`jras.dim.${d}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colType')}</label>
                <select
                  value={meta.type}
                  onChange={(e) => setMeta((m) => m && ({ ...m, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['sjt', 'likert', 'quiz', 'observation'].map((ty) => (
                    <option key={ty} value={ty}>{t(`jras.type.${ty}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colTitle')} (ID)</label>
                <input
                  value={meta.titleId}
                  onChange={(e) => setMeta((m) => m && ({ ...m, titleId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colTitle')} (JA)</label>
                <input
                  value={meta.titleJa}
                  onChange={(e) => setMeta((m) => m && ({ ...m, titleJa: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colDescription')} (ID)</label>
                <textarea
                  value={meta.descriptionId}
                  onChange={(e) => setMeta((m) => m && ({ ...m, descriptionId: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colDescription')} (JA)</label>
                <textarea
                  value={meta.descriptionJa}
                  onChange={(e) => setMeta((m) => m && ({ ...m, descriptionJa: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMeta(null)}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={() => metaMutation.mutate()}
                disabled={metaMutation.isPending || !meta.titleId || !meta.titleJa}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
              >
                {metaMutation.isPending ? '…' : t('btnSave')}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-700 space-y-1">
            <p>{data.titleId}</p>
            <p className="text-gray-500">{data.titleJa}</p>
            {(data.descriptionId || data.descriptionJa) && (
              <p className="text-xs text-gray-500 whitespace-pre-wrap">
                {lang === 'ja' ? (data.descriptionJa ?? data.descriptionId) : (data.descriptionId ?? data.descriptionJa)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Review masuk */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('superadmin.jras.reviewsTitle')}</h2>
        {currentReviews.length === 0 ? (
          <p className="text-xs text-gray-400">{t('superadmin.jras.noReviews')}</p>
        ) : (
          <div className="space-y-2">
            {currentReviews.map((r) => (
              <ReviewCard key={r.id} review={r} items={data.items} />
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {t('superadmin.jras.itemsTitle')} ({data.items.length})
          </h2>
          {isDraft && itemsJson === null && (
            <button
              onClick={() => setItemsJson(itemsAsImportJson())}
              className="text-xs text-blue-600 hover:underline"
            >
              {t('superadmin.jras.itemsEditor')}
            </button>
          )}
        </div>

        {itemsJson !== null ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs text-gray-400">{t('superadmin.jras.itemsEditorHint')}</p>
            <textarea
              value={itemsJson}
              onChange={(e) => setItemsJson(e.target.value)}
              spellCheck={false}
              rows={20}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setItemsJson(null); setError(''); }}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={() => itemsMutation.mutate()}
                disabled={itemsMutation.isPending}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
              >
                {itemsMutation.isPending ? '…' : t('superadmin.jras.itemsSave')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item, idx) => (
              <ItemView key={item.id} item={item} index={idx} />
            ))}
            {data.items.length === 0 && (
              <p className="text-sm text-gray-400 bg-white rounded-xl border border-gray-100 p-6 text-center">—</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
