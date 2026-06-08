/**
 * SuperAdminSurveys — superadmin survey management page
 *
 * Completely isolated from candidate/batch/LPK data.
 * Two views: "list" and "detail" (selected survey with 3 tabs).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type SurveyStatus = 'draft' | 'active' | 'closed';
type QuestionType = 'text' | 'textarea' | 'single' | 'multiple' | 'rating';

interface QuestionOption {
  value: string;
  labelId: string;
  labelJa: string;
}

interface SurveyQuestion {
  id: string;
  surveyId: string;
  sortOrder: number;
  type: QuestionType;
  questionId: string;
  questionJa: string;
  required: number;
  options: QuestionOption[] | null;
  groupLabelJa: string | null;
  groupLabelId: string | null;
}

interface SurveyAnswer {
  questionId: string;
  answerText: string | null;
  answerOptions: string[] | null;
}

interface SurveyResponse {
  id: string;
  submittedAt: string;
  answers: SurveyAnswer[];
}

interface ResponsesPage {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: SurveyResponse[];
}

interface SurveySummary {
  id: string;
  slug: string;
  titleId: string;
  titleJa: string;
  status: SurveyStatus;
  publishedAt: string | null;
  closedAt: string | null;
  isFeatured: number;
  responseCount: number;
}

interface SurveyDetail extends SurveySummary {
  descriptionId: string | null;
  descriptionJa: string | null;
  questions: SurveyQuestion[];
}

interface QuestionStat {
  questionId: string;
  type: QuestionType;
  questionJa: string;
  questionTextId: string;
  responseCount: number;
  options?: { value: string; labelJa: string; labelId: string; count: number; pct: number }[];
  texts?: { text: string; submittedAt: string | null }[];
}

interface SurveyStats {
  surveyId: string;
  totalResponses: number;
  questions: QuestionStat[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: SurveyStatus; t: ReturnType<typeof useTranslation>['t'] }) {
  const cfg: Record<SurveyStatus, string> = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    closed: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`inline-block text-xs font-semibold rounded-full px-2 py-0.5 ${cfg[status]}`}>
      {t(`superadmin.surveys.status.${status}`)}
    </span>
  );
}

// ── Question Form ─────────────────────────────────────────────────────────────

interface QuestionFormState {
  type: QuestionType;
  questionId: string;
  questionJa: string;
  required: number;
  options: QuestionOption[];
  sortOrder: number;
}

function QuestionForm({
  initial,
  onSave,
  onCancel,
  t,
}: {
  initial: QuestionFormState;
  onSave: (data: QuestionFormState) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const [form, setForm] = useState<QuestionFormState>(initial);

  const needsOptions = ['single', 'multiple', 'rating'].includes(form.type);

  const addOption = () => {
    setForm((f) => ({
      ...f,
      options: [...f.options, { value: '', labelId: '', labelJa: '' }],
    }));
  };

  const removeOption = (i: number) => {
    setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  };

  const setOption = (i: number, field: keyof QuestionOption, v: string) => {
    setForm((f) => {
      const opts = [...f.options];
      opts[i] = { ...opts[i], [field]: v };
      return { ...f, options: opts };
    });
  };

  return (
    <div className="space-y-4">
      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('superadmin.surveys.questionType')}
        </label>
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as QuestionType, options: [] }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
        >
          {(['text', 'textarea', 'single', 'multiple', 'rating'] as QuestionType[]).map((t2) => (
            <option key={t2} value={t2}>{t(`superadmin.surveys.types.${t2}`)}</option>
          ))}
        </select>
      </div>

      {/* Sort order */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24"
        />
      </div>

      {/* Question ID */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('superadmin.surveys.questionTextId')}
        </label>
        <textarea
          rows={2}
          value={form.questionId}
          onChange={(e) => setForm((f) => ({ ...f, questionId: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full resize-none"
        />
      </div>

      {/* Question JA */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('superadmin.surveys.questionTextJa')}
        </label>
        <textarea
          rows={2}
          value={form.questionJa}
          onChange={(e) => setForm((f) => ({ ...f, questionJa: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full resize-none"
        />
      </div>

      {/* Required */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.required === 1}
          onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked ? 1 : 0 }))}
          className="accent-navy-600"
        />
        {t('superadmin.surveys.required')}
      </label>

      {/* Options (for choice / rating types) */}
      {needsOptions && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">{t('superadmin.surveys.options')}</p>
          {form.options.map((opt, i) => (
            <div key={i} className="flex gap-2 mb-2 items-start">
              <input
                type="text"
                placeholder={t('superadmin.surveys.optionValue')}
                value={opt.value}
                onChange={(e) => setOption(i, 'value', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-24"
              />
              <input
                type="text"
                placeholder={t('superadmin.surveys.optionLabelId')}
                value={opt.labelId}
                onChange={(e) => setOption(i, 'labelId', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
              />
              <input
                type="text"
                placeholder={t('superadmin.surveys.optionLabelJa')}
                value={opt.labelJa}
                onChange={(e) => setOption(i, 'labelJa', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-red-400 hover:text-red-600 text-sm px-1"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="text-xs text-navy-600 hover:underline"
          >
            + {t('superadmin.surveys.addOption')}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          className="px-4 py-1.5 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-800 transition"
        >
          {t('superadmin.surveys.saveBtn')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
        >
          キャンセル / Batal
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SuperAdminSurveys() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'settings' | 'questions' | 'stats' | 'responses'>('settings');
  const [responsePage, setResponsePage] = useState(1);
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    titleId: '',
    titleJa: '',
    descriptionId: '',
    descriptionJa: '',
    slug: '',
    publishedAt: '',
    closedAt: '',
    isFeatured: 1,
  });

  // Settings edit state (populated when detail loads)
  const [settingsForm, setSettingsForm] = useState<{
    titleId: string;
    titleJa: string;
    descriptionId: string;
    descriptionJa: string;
    slug: string;
    status: SurveyStatus;
    publishedAt: string;
    closedAt: string;
    isFeatured: number;
  } | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: surveys = [], isLoading: listLoading } = useQuery<SurveySummary[]>({
    queryKey: ['superadmin-surveys'],
    queryFn: () => api.get('/surveys').then((r) => r.data as SurveySummary[]),
  });

  const { data: surveyDetail } = useQuery<SurveyDetail>({
    queryKey: ['superadmin-survey', selectedId],
    queryFn: () => api.get(`/surveys/${selectedId}`).then((r) => r.data as SurveyDetail),
    enabled: !!selectedId,
  });

  // Populate settings form whenever survey detail loads / changes
  useEffect(() => {
    if (!surveyDetail) return;
    setSettingsForm({
      titleId: surveyDetail.titleId,
      titleJa: surveyDetail.titleJa,
      descriptionId: surveyDetail.descriptionId ?? '',
      descriptionJa: surveyDetail.descriptionJa ?? '',
      slug: surveyDetail.slug,
      status: surveyDetail.status,
      publishedAt: toDatetimeLocal(surveyDetail.publishedAt),
      closedAt: toDatetimeLocal(surveyDetail.closedAt),
      isFeatured: surveyDetail.isFeatured,
    });
  }, [surveyDetail]);

  const { data: stats } = useQuery<SurveyStats>({
    queryKey: ['superadmin-survey-stats', selectedId],
    queryFn: () => api.get(`/surveys/${selectedId}/stats`).then((r) => r.data as SurveyStats),
    enabled: !!selectedId && detailTab === 'stats',
  });

  const { data: responsesPage } = useQuery<ResponsesPage>({
    queryKey: ['superadmin-survey-responses', selectedId, responsePage],
    queryFn: () =>
      api.get(`/surveys/${selectedId}/responses?page=${responsePage}&limit=20`).then((r) => r.data as ResponsesPage),
    enabled: !!selectedId && detailTab === 'responses',
  });

  const handleExportCsv = () => {
    const token = (api.defaults.headers['Authorization'] as string | undefined)?.replace('Bearer ', '') ?? '';
    const a = document.createElement('a');
    a.href = `/api/surveys/${selectedId}/export.csv`;
    a.download = `survey-responses.csv`;
    // Use fetch to include auth header
    void fetch(a.href, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.post('/surveys', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-surveys'] });
      setShowCreateModal(false);
      setCreateForm({ titleId: '', titleJa: '', descriptionId: '', descriptionJa: '', slug: '', publishedAt: '', closedAt: '', isFeatured: 1 });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof settingsForm) =>
      api.put(`/surveys/${selectedId}`, {
        ...data,
        publishedAt: data?.publishedAt || null,
        closedAt: data?.closedAt || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-surveys'] });
      void qc.invalidateQueries({ queryKey: ['superadmin-survey', selectedId] });
      setSavedMsg(t('superadmin.surveys.saved'));
      setTimeout(() => setSavedMsg(''), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/surveys/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-surveys'] });
      setView('list');
      setSelectedId(null);
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: (data: QuestionFormState) =>
      api.post(`/surveys/${selectedId}/questions`, {
        type: data.type,
        questionId: data.questionId,
        questionJa: data.questionJa,
        required: data.required,
        options: data.options.length > 0 ? data.options : null,
        sortOrder: data.sortOrder,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-survey', selectedId] });
      setShowQuestionForm(false);
    },
  });

  const editQuestionMutation = useMutation({
    mutationFn: (data: QuestionFormState & { id: string }) =>
      api.put(`/surveys/${selectedId}/questions/${data.id}`, {
        type: data.type,
        questionId: data.questionId,
        questionJa: data.questionJa,
        required: data.required,
        options: data.options.length > 0 ? data.options : null,
        sortOrder: data.sortOrder,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-survey', selectedId] });
      setEditingQuestion(null);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (qid: string) => api.delete(`/surveys/${selectedId}/questions/${qid}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-survey', selectedId] });
    },
  });

  // ── List view ──────────────────────────────────────────────────────────────

  const openDetail = (id: string) => {
    setSelectedId(id);
    setView('detail');
    setDetailTab('settings');
  };

  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">{t('superadmin.surveys.title')}</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-800 transition font-medium"
          >
            + {t('superadmin.surveys.createBtn')}
          </button>
        </div>

        {/* Survey list */}
        {listLoading ? (
          <div className="text-center text-gray-400 py-12 text-sm">読み込み中… / Memuat…</div>
        ) : surveys.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">{t('superadmin.surveys.noActive')}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('superadmin.surveys.colTitle')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('superadmin.surveys.colStatus')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('superadmin.surveys.colResponses')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('superadmin.surveys.colPublished')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('superadmin.surveys.colClosed')}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">{t('superadmin.surveys.colFeatured')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {surveys.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.titleJa}</p>
                      <p className="text-xs text-gray-400">{s.titleId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} t={t} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {s.responseCount}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDt(s.publishedAt)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDt(s.closedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      {s.isFeatured ? (
                        <span className="text-green-500 text-base">✔</span>
                      ) : (
                        <span className="text-gray-300 text-base">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(s.id)}
                        className="px-3 py-1 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                      >
                        編集 / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('superadmin.surveys.createBtn')}</h2>
              <div className="space-y-3">
                {(
                  [
                    { key: 'titleJa' as const, label: t('superadmin.surveys.fields.titleJa') },
                    { key: 'titleId' as const, label: t('superadmin.surveys.fields.titleId') },
                    { key: 'slug' as const, label: t('superadmin.surveys.fields.slug') },
                  ] as { key: keyof typeof createForm; label: string }[]
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type="text"
                      value={String(createForm[key])}
                      onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
                    />
                  </div>
                ))}
                {(
                  [
                    { key: 'descriptionJa' as const, label: t('superadmin.surveys.fields.descJa') },
                    { key: 'descriptionId' as const, label: t('superadmin.surveys.fields.descId') },
                  ] as { key: keyof typeof createForm; label: string }[]
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <textarea
                      rows={2}
                      value={String(createForm[key])}
                      onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full resize-none"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.surveys.fields.publishedAt')}</label>
                  <input
                    type="datetime-local"
                    value={createForm.publishedAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, publishedAt: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.surveys.fields.closedAt')}</label>
                  <input
                    type="datetime-local"
                    value={createForm.closedAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, closedAt: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.isFeatured === 1}
                    onChange={(e) => setCreateForm((f) => ({ ...f, isFeatured: e.target.checked ? 1 : 0 }))}
                    className="accent-navy-600"
                  />
                  {t('superadmin.surveys.fields.featured')}
                </label>
              </div>
              {createMutation.isError && (
                <p className="text-sm text-red-600 mt-2">作成に失敗しました。 / Gagal membuat.</p>
              )}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => createMutation.mutate(createForm)}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-navy-700 text-white text-sm rounded-lg font-medium hover:bg-navy-800 transition disabled:opacity-60"
                >
                  {createMutation.isPending ? '…' : t('superadmin.surveys.createBtn')}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { setView('list'); setSelectedId(null); }}
          className="text-sm text-navy-600 hover:underline"
        >
          {t('superadmin.surveys.backToList')}
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">
          {surveyDetail?.titleJa ?? '…'}
        </h1>
        {surveyDetail && <StatusBadge status={surveyDetail.status} t={t} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {(['settings', 'questions', 'stats', 'responses'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setDetailTab(tab); if (tab === 'responses') setResponsePage(1); }}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition ${
              detailTab === tab
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`superadmin.surveys.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* ── Pengaturan tab ──────────────────────────────────────────────────── */}
      {detailTab === 'settings' && settingsForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl space-y-4">
          {(
            [
              { key: 'titleJa' as const, label: t('superadmin.surveys.fields.titleJa') },
              { key: 'titleId' as const, label: t('superadmin.surveys.fields.titleId') },
              { key: 'slug' as const, label: t('superadmin.surveys.fields.slug') },
            ]
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type="text"
                value={settingsForm[key]}
                onChange={(e) => setSettingsForm((f) => f ? { ...f, [key]: e.target.value } : f)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
              />
            </div>
          ))}

          {(
            [
              { key: 'descriptionJa' as const, label: t('superadmin.surveys.fields.descJa') },
              { key: 'descriptionId' as const, label: t('superadmin.surveys.fields.descId') },
            ]
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <textarea
                rows={3}
                value={settingsForm[key]}
                onChange={(e) => setSettingsForm((f) => f ? { ...f, [key]: e.target.value } : f)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full resize-none"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.surveys.fields.status')}</label>
            <select
              value={settingsForm.status}
              onChange={(e) => setSettingsForm((f) => f ? { ...f, status: e.target.value as SurveyStatus } : f)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
            >
              {(['draft', 'active', 'closed'] as SurveyStatus[]).map((s) => (
                <option key={s} value={s}>{t(`superadmin.surveys.status.${s}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.surveys.fields.publishedAt')}</label>
            <input
              type="datetime-local"
              value={settingsForm.publishedAt}
              onChange={(e) => setSettingsForm((f) => f ? { ...f, publishedAt: e.target.value } : f)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.surveys.fields.closedAt')}</label>
            <input
              type="datetime-local"
              value={settingsForm.closedAt}
              onChange={(e) => setSettingsForm((f) => f ? { ...f, closedAt: e.target.value } : f)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settingsForm.isFeatured === 1}
              onChange={(e) => setSettingsForm((f) => f ? { ...f, isFeatured: e.target.checked ? 1 : 0 } : f)}
              className="accent-navy-600"
            />
            {t('superadmin.surveys.fields.featured')}
          </label>

          {savedMsg && <p className="text-sm text-green-600">{savedMsg}</p>}
          {saveMutation.isError && (
            <p className="text-sm text-red-600">保存に失敗しました。 / Gagal menyimpan.</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => saveMutation.mutate(settingsForm)}
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg font-medium hover:bg-navy-800 transition disabled:opacity-60"
            >
              {saveMutation.isPending ? '…' : t('superadmin.surveys.saveBtn')}
            </button>
            <button
              onClick={() => {
                if (window.confirm(t('superadmin.surveys.confirmDelete'))) {
                  deleteMutation.mutate(selectedId!);
                }
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition disabled:opacity-60"
            >
              削除 / Hapus
            </button>
          </div>
        </div>
      )}

      {/* ── Pertanyaan tab ──────────────────────────────────────────────────── */}
      {detailTab === 'questions' && (
        <div className="max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              {surveyDetail?.questions?.length ?? 0} 問 / pertanyaan
            </p>
            {!showQuestionForm && !editingQuestion && (
              <button
                onClick={() => setShowQuestionForm(true)}
                className="px-3 py-1.5 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-800 transition"
              >
                + {t('superadmin.surveys.addQuestion')}
              </button>
            )}
          </div>

          {/* Add question form */}
          {showQuestionForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <p className="font-medium text-gray-800 mb-3">{t('superadmin.surveys.addQuestion')}</p>
              <QuestionForm
                initial={{ type: 'single', questionId: '', questionJa: '', required: 1, options: [], sortOrder: (surveyDetail?.questions?.length ?? 0) + 1 }}
                onSave={(data) => addQuestionMutation.mutate(data)}
                onCancel={() => setShowQuestionForm(false)}
                t={t}
              />
            </div>
          )}

          {/* Edit question form */}
          {editingQuestion && (
            <div className="bg-white border border-blue-200 rounded-xl p-5 mb-4">
              <p className="font-medium text-gray-800 mb-3">{t('superadmin.surveys.editQuestion')}</p>
              <QuestionForm
                initial={{
                  type: editingQuestion.type,
                  questionId: editingQuestion.questionId,
                  questionJa: editingQuestion.questionJa,
                  required: editingQuestion.required,
                  options: editingQuestion.options ?? [],
                  sortOrder: editingQuestion.sortOrder,
                }}
                onSave={(data) => editQuestionMutation.mutate({ ...data, id: editingQuestion.id })}
                onCancel={() => setEditingQuestion(null)}
                t={t}
              />
            </div>
          )}

          {/* Question list */}
          {!surveyDetail?.questions?.length ? (
            <p className="text-sm text-gray-400">{t('superadmin.surveys.noQuestions')}</p>
          ) : (
            <div className="space-y-3">
              {surveyDetail.questions
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((q) => (
                  <div key={q.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex gap-3 items-start">
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                      {q.sortOrder}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{q.questionJa}</p>
                      <p className="text-xs text-gray-400 truncate">{q.questionId}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
                          {t(`superadmin.surveys.types.${q.type}`)}
                        </span>
                        {q.required === 1 && (
                          <span className="text-xs bg-red-50 text-red-500 rounded px-1.5 py-0.5">
                            {t('superadmin.surveys.required')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { setEditingQuestion(q); setShowQuestionForm(false); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t('superadmin.surveys.confirmDeleteQuestion'))) {
                            deleteQuestionMutation.mutate(q.id);
                          }
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Statistik tab ───────────────────────────────────────────────────── */}
      {detailTab === 'stats' && (
        <div className="max-w-2xl">
          {!stats ? (
            <div className="text-center text-gray-400 py-12 text-sm">読み込み中… / Memuat…</div>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">{t('superadmin.surveys.totalResponses')}</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalResponses}</p>
                </div>
                {stats.totalResponses > 0 && (
                  <button
                    onClick={handleExportCsv}
                    className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                  >
                    ⬇ CSV エクスポート
                  </button>
                )}
              </div>

              {stats.totalResponses === 0 ? (
                <p className="text-sm text-gray-400">{t('superadmin.surveys.noStats')}</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const groupMap = new Map(
                      (surveyDetail?.questions ?? []).map((q) => [q.id, q.groupLabelJa]),
                    );
                    return stats.questions.map((qs) => {
                      const groupLabel = groupMap.get(qs.questionId);
                      return (
                        <div key={qs.questionId}>
                          {groupLabel && (
                            <div
                              className="text-xs font-bold text-white px-4 py-2 rounded-lg mt-4 mb-1"
                              style={{ background: '#0F1E2D' }}
                            >
                              {groupLabel}
                            </div>
                          )}
                          <div className="bg-white border border-gray-200 rounded-xl px-6 py-5">
                            <p className="font-semibold text-gray-900 text-sm">{qs.questionJa}</p>
                            <p className="text-xs text-gray-400 mb-3">{qs.questionTextId}</p>

                            {qs.options && (
                              <div className="space-y-2">
                                {qs.options.map((opt) => (
                                  <div key={opt.value}>
                                    <div className="flex justify-between text-xs text-gray-700 mb-0.5">
                                      <span className="flex-1 mr-2">{opt.labelJa}</span>
                                      <span className="font-mono shrink-0">{opt.count}件 ({opt.pct}%)</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${opt.pct}%`, background: '#1E3A5F' }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {qs.texts && (
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {qs.texts.length === 0 ? (
                                  <p className="text-xs text-gray-400">{t('superadmin.surveys.noStats')}</p>
                                ) : (
                                  qs.texts.map((item, i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{item.text}</p>
                                      {item.submittedAt && (
                                        <p className="text-xs text-gray-400 mt-1">{formatDt(item.submittedAt)}</p>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Jawaban tab ─────────────────────────────────────────────────────── */}
      {detailTab === 'responses' && (
        <div className="max-w-3xl">
          {!responsesPage ? (
            <div className="text-center text-gray-400 py-12 text-sm">読み込み中… / Memuat…</div>
          ) : responsesPage.total === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">{t('superadmin.surveys.noStats')}</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {responsesPage.total} 件の回答 / {responsesPage.total} jawaban
                </p>
                <button
                  onClick={handleExportCsv}
                  className="px-4 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  ⬇ CSV エクスポート
                </button>
              </div>

              <div className="space-y-3">
                {responsesPage.data.map((resp) => {
                  const questions = surveyDetail?.questions
                    ?.slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
                  const answerMap = new Map(resp.answers.map((a) => [a.questionId, a]));
                  const companyName = answerMap.get(questions[0]?.id)?.answerText ?? '—';
                  const isExpanded = expandedResponse === resp.id;

                  return (
                    <div key={resp.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
                        onClick={() => setExpandedResponse(isExpanded ? null : resp.id)}
                      >
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{companyName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDt(resp.submittedAt)}</p>
                        </div>
                        <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                          {questions.map((q) => {
                            const a = answerMap.get(q.id);
                            if (!a) return null;
                            const hasText    = a.answerText && a.answerText.trim().length > 0;
                            const hasOptions = Array.isArray(a.answerOptions) && a.answerOptions.length > 0;
                            if (!hasText && !hasOptions) return null;

                            const opts = (q.options ?? []) as { value: string; labelJa: string }[];
                            const displayValue = hasOptions
                              ? (a.answerOptions ?? []).map((v) => opts.find((o) => o.value === v)?.labelJa ?? v).join('、')
                              : (a.answerText ?? '');

                            return (
                              <div key={q.id}>
                                <p className="text-xs font-medium text-gray-500">{q.questionJa}</p>
                                <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap break-words">{displayValue}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {responsesPage.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    disabled={responsePage <= 1}
                    onClick={() => setResponsePage((p) => p - 1)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                  >
                    ←
                  </button>
                  <span className="text-sm text-gray-600">
                    {responsePage} / {responsesPage.totalPages}
                  </span>
                  <button
                    disabled={responsePage >= responsesPage.totalPages}
                    onClick={() => setResponsePage((p) => p + 1)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
