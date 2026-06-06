import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AbVariant { key: string; name: string; weight: number; }

type Scope = 'all' | 'role' | 'lpk' | 'percentage';
interface AbTargeting {
  scope: Scope;
  roles?: string[];
  /** Explicit per-LPK variant assignment: { [lpkId]: variantKey } */
  lpkVariants?: Record<string, string>;
  percentage?: number;
}

interface LpkOption { id: string; name: string; city: string | null; }

type Status = 'draft' | 'active' | 'paused' | 'concluded';

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  hypothesis: string | null;
  status: Status;
  variants: AbVariant[];
  targeting: AbTargeting;
  metric: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  totalAssignments?: number;
}

interface VariantResult extends AbVariant {
  assignments: number;
  events: Record<string, number>;
  conversionRate: number;
}

interface ExperimentDetail { experiment: Experiment; variants: VariantResult[]; }

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_ROLES = ['candidate', 'admin', 'manager', 'recruiter', 'super_admin'];

const STATUS_COLORS: Record<Status, string> = {
  draft:     'bg-gray-100 text-gray-700',
  active:    'bg-green-100 text-green-700',
  paused:    'bg-amber-100 text-amber-700',
  concluded: 'bg-blue-100 text-blue-700',
};

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  hypothesis: string;
  metric: string;
  startDate: string;
  endDate: string;
  variants: AbVariant[];
  targeting: AbTargeting;
}

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  hypothesis: '',
  metric: '',
  startDate: '',
  endDate: '',
  variants: [
    { key: 'control',   name: 'Control',   weight: 50 },
    { key: 'treatment', name: 'Treatment', weight: 50 },
  ],
  targeting: { scope: 'all' },
};

function formFromExperiment(e: Experiment): FormState {
  return {
    name: e.name,
    description: e.description ?? '',
    hypothesis: e.hypothesis ?? '',
    metric: e.metric ?? '',
    startDate: e.startDate ?? '',
    endDate: e.endDate ?? '',
    variants: e.variants,
    targeting: e.targeting,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {t(`superadmin.experiments.status_${status}`)}
    </span>
  );
}

function VariantRow({
  v, index, onChange, onRemove, canRemove,
}: {
  v: AbVariant;
  index: number;
  onChange: (i: number, field: keyof AbVariant, value: string | number) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <input
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28 font-mono"
        placeholder={t('superadmin.experiments.variantKey')}
        value={v.key}
        onChange={e => onChange(index, 'key', e.target.value)}
      />
      <input
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1"
        placeholder={t('superadmin.experiments.variantName')}
        value={v.name}
        onChange={e => onChange(index, 'name', e.target.value)}
      />
      <input
        type="number" min={0} max={100}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-20 text-right"
        placeholder={t('superadmin.experiments.variantWeight')}
        value={v.weight}
        onChange={e => onChange(index, 'weight', parseInt(e.target.value, 10) || 0)}
      />
      <span className="text-xs text-gray-400">%</span>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 transition text-sm"
        >✕</button>
      )}
    </div>
  );
}

// ── Experiment Form (create / edit) ───────────────────────────────────────────

function ExperimentForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormState;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial);

  const { data: lpkData } = useQuery<{ lpks: LpkOption[] }>({
    queryKey: ['ab-lpk-list'],
    queryFn: () => api.get('/superadmin/lpks').then(r => r.data),
    staleTime: 60_000,
  });
  const allLpks = lpkData?.lpks ?? [];

  const totalWeight = form.variants.reduce((s, v) => s + v.weight, 0);
  const weightOk = totalWeight === 100;

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const updateVariant = (i: number, field: keyof AbVariant, value: string | number) =>
    setForm(p => {
      const vs = [...p.variants];
      vs[i] = { ...vs[i], [field]: value };
      return { ...p, variants: vs };
    });

  const addVariant = () =>
    setForm(p => ({ ...p, variants: [...p.variants, { key: '', name: '', weight: 0 }] }));

  const removeVariant = (i: number) =>
    setForm(p => ({ ...p, variants: p.variants.filter((_, idx) => idx !== i) }));

  const updateTargeting = <K extends keyof AbTargeting>(k: K, v: AbTargeting[K]) =>
    setForm(p => ({ ...p, targeting: { ...p.targeting, [k]: v } }));

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (weightOk) onSave(form); }}
      className="space-y-5"
    >
      {/* Name + Description */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('superadmin.experiments.fieldName')} *</label>
          <input
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
            placeholder="cv-layout-test"
            value={form.name}
            onChange={e => setField('name', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          />
          <p className="text-[11px] text-gray-400 mt-1">{t('superadmin.experiments.fieldNameHint')}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('superadmin.experiments.fieldMetric')}</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
            placeholder="cv_downloaded"
            value={form.metric}
            onChange={e => setField('metric', e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">{t('superadmin.experiments.fieldMetricHint')}</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('superadmin.experiments.fieldHypothesis')}</label>
        <textarea
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
          placeholder={t('superadmin.experiments.fieldHypothesisHint')}
          value={form.hypothesis}
          onChange={e => setField('hypothesis', e.target.value)}
        />
      </div>

      {/* Variants */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">{t('superadmin.experiments.sectionVariants')}</label>
        <div className="space-y-2">
          {form.variants.map((v, i) => (
            <VariantRow
              key={i}
              v={v}
              index={i}
              onChange={updateVariant}
              onRemove={removeVariant}
              canRemove={form.variants.length > 2}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={addVariant}
            className="text-xs text-navy-700 hover:text-navy-900 font-medium"
          >{t('superadmin.experiments.addVariant')}</button>
          <span className={`text-xs font-semibold ${weightOk ? 'text-green-600' : 'text-red-500'}`}>
            {t('superadmin.experiments.weightTotal')}: {totalWeight}%
            {!weightOk && ` — ${t('superadmin.experiments.weightError')}`}
          </span>
        </div>
      </div>

      {/* Targeting */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">{t('superadmin.experiments.fieldTargeting')}</label>
        <div className="flex gap-3 flex-wrap mb-2">
          {(['all', 'role', 'lpk', 'percentage'] as Scope[]).map(scope => (
            <label key={scope} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
              <input
                type="radio" name="scope" value={scope}
                checked={form.targeting.scope === scope}
                onChange={() => setForm(p => ({
                  ...p,
                  targeting: { scope },  // reset scope-specific fields on switch
                }))}
                className="accent-navy-700"
              />
              {t(`superadmin.experiments.scope_${scope}`)}
            </label>
          ))}
        </div>

        {/* Role scope */}
        {form.targeting.scope === 'role' && (
          <div className="flex flex-wrap gap-2 mt-1">
            {ALL_ROLES.map(role => (
              <label key={role} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.targeting.roles?.includes(role) ?? false}
                  onChange={e => {
                    const roles = e.target.checked
                      ? [...(form.targeting.roles ?? []), role]
                      : (form.targeting.roles ?? []).filter(r => r !== role);
                    updateTargeting('roles', roles);
                  }}
                  className="accent-navy-700"
                />
                {role}
              </label>
            ))}
          </div>
        )}

        {/* LPK scope — explicit per-LPK variant mapping */}
        {form.targeting.scope === 'lpk' && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-gray-500 mb-2">
              {t('superadmin.experiments.lpkVariantsHint')}
            </p>
            {allLpks.length === 0 && (
              <p className="text-xs text-gray-400 italic">{t('superadmin.experiments.lpkLoading')}</p>
            )}
            {allLpks.map(lpk => {
              const assigned = form.targeting.lpkVariants?.[lpk.id] ?? '';
              return (
                <div key={lpk.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-48 truncate" title={lpk.name}>
                    {lpk.name}
                    {lpk.city && <span className="text-gray-400 text-xs ml-1">({lpk.city})</span>}
                  </span>
                  <select
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
                    value={assigned}
                    onChange={e => {
                      const val = e.target.value;
                      const next = { ...(form.targeting.lpkVariants ?? {}) };
                      if (val) { next[lpk.id] = val; } else { delete next[lpk.id]; }
                      updateTargeting('lpkVariants', Object.keys(next).length ? next : undefined);
                    }}
                  >
                    <option value="">— {t('superadmin.experiments.lpkNotInExperiment')} —</option>
                    {form.variants.map(v => (
                      <option key={v.key} value={v.key}>{v.key} — {v.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {/* Percentage scope */}
        {form.targeting.scope === 'percentage' && (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number" min={1} max={100}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24"
              value={form.targeting.percentage ?? 50}
              onChange={e => updateTargeting('percentage', parseInt(e.target.value, 10) || 50)}
            />
            <span className="text-sm text-gray-500">% {t('superadmin.experiments.fieldPercentage')}</span>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('superadmin.experiments.fieldStartDate')}</label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('superadmin.experiments.fieldEndDate')}</label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.endDate} onChange={e => setField('endDate', e.target.value)} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
          {t('superadmin.experiments.cancelBtn')}
        </button>
        <button
          type="submit"
          disabled={!weightOk || isSaving}
          className="px-5 py-2 text-sm bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition disabled:opacity-40"
        >
          {isSaving ? '…' : t('superadmin.experiments.saveBtn')}
        </button>
      </div>
    </form>
  );
}

// ── Results panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ detail }: { detail: ExperimentDetail }) {
  const { t } = useTranslation();
  const { experiment, variants } = detail;
  const total = variants.reduce((s, v) => s + v.assignments, 0);

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('superadmin.experiments.resultsTitle')}</p>
      {total === 0 ? (
        <p className="text-sm text-gray-400">{t('superadmin.experiments.noResults')}</p>
      ) : (
        <div className="space-y-3">
          {variants.map(v => {
            const pct = total > 0 ? Math.round((v.assignments / total) * 100) : 0;
            return (
              <div key={v.key} className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{v.name}</span>
                    <span className="ml-2 text-xs font-mono text-gray-400">{v.key}</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{v.assignments}</p>
                      <p className="text-[11px] text-gray-400">{t('superadmin.experiments.assignments')}</p>
                    </div>
                    {experiment.metric && (
                      <div>
                        <p className="text-lg font-bold text-navy-700">{(v.conversionRate * 100).toFixed(1)}%</p>
                        <p className="text-[11px] text-gray-400">{t('superadmin.experiments.conversionRate')}</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Distribution bar */}
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-navy-700 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{pct}% of traffic</p>
                {/* Event breakdown */}
                {Object.keys(v.events).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(v.events).map(([event, count]) => (
                      <span key={event} className="text-xs text-gray-500 font-mono">
                        {event}: <strong>{count}</strong>
                      </span>
                    ))}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SuperAdminExperiments() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Experiment | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ experiments: Experiment[] }>({
    queryKey: ['ab-experiments'],
    queryFn: () => api.get('/ab/admin/experiments').then(r => r.data),
  });

  const { data: detail } = useQuery<ExperimentDetail>({
    queryKey: ['ab-experiment-detail', expandedId],
    queryFn: () => api.get(`/ab/admin/experiments/${expandedId}`).then(r => r.data),
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: (body: FormState) => api.post('/ab/admin/experiments', body).then(r => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ab-experiments'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<FormState> }) =>
      api.put(`/ab/admin/experiments/${id}`, body).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ab-experiments'] });
      void qc.invalidateQueries({ queryKey: ['ab-experiment-detail', expandedId] });
      setEditTarget(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api.put(`/ab/admin/experiments/${id}`, { status }).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ab-experiments'] });
      void qc.invalidateQueries({ queryKey: ['ab-experiment-detail', expandedId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ab/admin/experiments/${id}`).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ab-experiments'] });
      setExpandedId(null);
    },
  });

  const experiments = data?.experiments ?? [];

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('superadmin.experiments.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('superadmin.experiments.description')}</p>
        </div>
        {!showForm && !editTarget && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition shrink-0"
          >
            {t('superadmin.experiments.createBtn')}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">{t('superadmin.experiments.formTitle_create')}</h2>
          <ExperimentForm
            initial={DEFAULT_FORM}
            onSave={form => createMutation.mutate(form)}
            onCancel={() => setShowForm(false)}
            isSaving={createMutation.isPending}
          />
          {createMutation.isError && (
            <p className="text-xs text-red-500 mt-2">
              {(createMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'}
            </p>
          )}
        </div>
      )}

      {/* Experiment list */}
      {experiments.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-gray-400">{t('superadmin.experiments.noExperiments')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.map(exp => {
            const isExpanded = expandedId === exp.id;
            const isEditing = editTarget?.id === exp.id;
            return (
              <div key={exp.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 font-mono">{exp.name}</span>
                      <StatusBadge status={exp.status} />
                    </div>
                    {exp.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{exp.description}</p>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{exp.variants.length}</p>
                      <p className="text-[11px] text-gray-400">{t('superadmin.experiments.colVariants')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{exp.totalAssignments ?? 0}</p>
                      <p className="text-[11px] text-gray-400">{t('superadmin.experiments.colAssignments')}</p>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    {isEditing ? (
                      <>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('superadmin.experiments.formTitle_edit')}</h3>
                        <ExperimentForm
                          initial={formFromExperiment(editTarget)}
                          onSave={form => updateMutation.mutate({ id: exp.id, body: form })}
                          onCancel={() => setEditTarget(null)}
                          isSaving={updateMutation.isPending}
                        />
                      </>
                    ) : (
                      <>
                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                          {exp.hypothesis && (
                            <div className="col-span-2">
                              <span className="text-xs text-gray-400">{t('superadmin.experiments.fieldHypothesis')}: </span>
                              <span className="text-gray-700">{exp.hypothesis}</span>
                            </div>
                          )}
                          {exp.metric && (
                            <div>
                              <span className="text-xs text-gray-400">{t('superadmin.experiments.fieldMetric')}: </span>
                              <span className="font-mono text-gray-700">{exp.metric}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-xs text-gray-400">{t('superadmin.experiments.fieldTargeting')}: </span>
                            <span className="text-gray-700">{t(`superadmin.experiments.scope_${exp.targeting.scope}`)}</span>
                            {exp.targeting.scope === 'role' && exp.targeting.roles && (
                              <span className="text-gray-500"> ({exp.targeting.roles.join(', ')})</span>
                            )}
                            {exp.targeting.scope === 'percentage' && exp.targeting.percentage !== undefined && (
                              <span className="text-gray-500"> ({exp.targeting.percentage}%)</span>
                            )}
                          </div>
                          {(exp.startDate || exp.endDate) && (
                            <div>
                              <span className="text-xs text-gray-400">{t('superadmin.experiments.fieldStartDate')}/End: </span>
                              <span className="text-gray-700">{exp.startDate ?? '–'} → {exp.endDate ?? '–'}</span>
                            </div>
                          )}
                        </div>

                        {/* Variant chips */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {exp.variants.map(v => (
                            <span key={v.key} className="text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-1 font-mono">
                              {v.key} <span className="text-gray-400">{v.weight}%</span>
                            </span>
                          ))}
                        </div>

                        {/* Results */}
                        {detail && detail.experiment.id === exp.id && (
                          <ResultsPanel detail={detail} />
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-4 flex-wrap">
                          {exp.status === 'draft' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: exp.id, status: 'active' })}
                              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                              {t('superadmin.experiments.activateBtn')}
                            </button>
                          )}
                          {exp.status === 'active' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: exp.id, status: 'paused' })}
                              className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                            >
                              {t('superadmin.experiments.pauseBtn')}
                            </button>
                          )}
                          {exp.status === 'paused' && (
                            <>
                              <button
                                onClick={() => statusMutation.mutate({ id: exp.id, status: 'active' })}
                                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                              >
                                {t('superadmin.experiments.activateBtn')}
                              </button>
                              <button
                                onClick={() => statusMutation.mutate({ id: exp.id, status: 'concluded' })}
                                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                              >
                                {t('superadmin.experiments.concludeBtn')}
                              </button>
                            </>
                          )}
                          {(exp.status === 'draft' || exp.status === 'paused') && (
                            <button
                              onClick={() => setEditTarget(exp)}
                              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                            >✏️ {t('superadmin.experiments.saveBtn')}</button>
                          )}
                          {exp.status === 'draft' && (
                            <button
                              onClick={() => {
                                if (window.confirm(t('superadmin.experiments.deleteConfirm'))) {
                                  deleteMutation.mutate(exp.id);
                                }
                              }}
                              className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition ml-auto"
                            >
                              {t('superadmin.experiments.deleteBtn')}
                            </button>
                          )}
                        </div>
                      </>
                    )}
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
