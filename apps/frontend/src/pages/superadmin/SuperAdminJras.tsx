import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { JRAS_DIMENSION_KEYS } from '@ijbnet/shared';
import type {
  JrasInstrumentSummary,
  JrasConfigData,
  JrasCommitteeMemberData,
  JrasRiskRuleData,
  JrasReviewerData,
} from '../../types/jras';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  retired: 'bg-gray-100 text-gray-400',
};

const IMPORT_EXAMPLE = `{
  "instrument": {
    "dimensionKey": "culture",
    "type": "sjt",
    "titleId": "SJT Budaya Kerja",
    "titleJa": "職場文化SJT"
  },
  "items": [
    {
      "type": "sjt",
      "promptId": "…",
      "promptJa": "…",
      "options": [
        { "labelId": "…", "labelJa": "…" },
        { "labelId": "…", "labelJa": "…" }
      ],
      "scoring": { "scoringType": "weighted", "weights": [0, 1], "rationale": "…" }
    }
  ]
}`;

// ── Modal: import JSON ────────────────────────────────────────────────────────

function ImportModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('INVALID_JSON');
      }
      return api.post('/jras/superadmin/instruments/import', parsed);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jras-instruments'] });
      onClose();
    },
    onError: (e: unknown) => {
      if ((e as Error).message === 'INVALID_JSON') { setError('JSON tidak valid'); return; }
      const data = (e as { response?: { data?: { message?: string; details?: unknown } } })?.response?.data;
      setError(data?.message ?? (data?.details ? JSON.stringify(data.details) : t('toastError')));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.jras.importJson')}</h3>
        <p className="text-xs text-gray-500 mb-3">{t('superadmin.jras.importHint')}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={IMPORT_EXAMPLE}
          spellCheck={false}
          className="flex-1 min-h-[300px] w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-red-600 mt-2 break-all">{error}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
            {t('btnCancel')}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !text.trim()}
            className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            {mutation.isPending ? '…' : t('superadmin.jras.importJson')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: instrumen baru (metadata) ─────────────────────────────────────────

function CreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ dimensionKey: 'culture', type: 'sjt', titleId: '', titleJa: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/jras/superadmin/instruments', form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jras-instruments'] });
      onClose();
    },
    onError: () => setError(t('toastError')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-base font-semibold text-gray-900">{t('superadmin.jras.createInstrument')}</h3>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colDimension')}</label>
          <select
            value={form.dimensionKey}
            onChange={(e) => setForm((f) => ({ ...f, dimensionKey: e.target.value }))}
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
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
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
            value={form.titleId}
            onChange={(e) => setForm((f) => ({ ...f, titleId: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.colTitle')} (JA)</label>
          <input
            value={form.titleJa}
            onChange={(e) => setForm((f) => ({ ...f, titleJa: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
            {t('btnCancel')}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.titleId || !form.titleJa}
            className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            {mutation.isPending ? '…' : t('btnSave')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Instrumen ────────────────────────────────────────────────────────────

function InstrumentsTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useQuery<JrasInstrumentSummary[]>({
    queryKey: ['jras-instruments'],
    queryFn: () => api.get('/jras/superadmin/instruments').then((r) => r.data),
  });

  const { data: reviewers } = useQuery<JrasReviewerData[]>({
    queryKey: ['jras-reviewers'],
    queryFn: () => api.get('/jras/superadmin/reviewers').then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{t('superadmin.jras.tabInstruments')}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition"
          >
            {t('superadmin.jras.importJson')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition"
          >
            + {t('superadmin.jras.createInstrument')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
        ) : isError ? (
          <div className="p-6 text-sm text-red-600">{t('toastError')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colTitle')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colDimension')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colType')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colVersion')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colItems')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colApprovals')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.jras.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data ?? []).map((inst) => (
                <tr key={inst.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link to={`/superadmin/jras/instruments/${inst.id}`} className="font-medium text-blue-600 hover:underline">
                      {lang === 'ja' ? inst.titleJa : inst.titleId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t(`jras.dim.${inst.dimensionKey}`)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t(`jras.type.${inst.type}`)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">v{inst.version}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inst.itemCount}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {inst.approveCount ?? 0}
                    {(inst.changesCount ?? 0) > 0 && (
                      <span className="text-amber-600"> / ✎{inst.changesCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[inst.status]}`}>
                      {t(`jras.status.${inst.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">—</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Reviewer terdaftar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('superadmin.jras.reviewersTitle')}</h3>
        {(reviewers ?? []).length === 0 ? (
          <p className="text-xs text-gray-400">—</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(reviewers ?? []).map((r) => (
              <span
                key={r.id}
                className={`text-xs px-2.5 py-1 rounded-full ${
                  r.active ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-400 line-through'
                }`}
              >
                {r.user?.name ?? r.user?.email} · {t(`jras.reviewerType.${r.reviewerType}`)}
              </span>
            ))}
          </div>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ── Tab: Pengaturan ───────────────────────────────────────────────────────────

function ConfigTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [config, setConfig] = useState<JrasConfigData | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data } = useQuery<JrasConfigData>({
    queryKey: ['jras-config'],
    queryFn: () => api.get('/jras/superadmin/config').then((r) => r.data),
  });

  const { data: lpks } = useQuery<{ lpks: { id: string; name: string }[] }>({
    queryKey: ['superadmin-lpks-list'],
    queryFn: () => api.get('/superadmin/lpks').then((r) => r.data),
  });

  useEffect(() => {
    if (data && !config) setConfig(data);
  }, [data, config]);

  const mutation = useMutation({
    mutationFn: () => api.put('/jras/superadmin/config', config),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jras-config'] });
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => setError(t('toastError')),
  });

  if (!config) return <div className="p-6 text-sm text-gray-500">{t('loading')}</div>;

  const toggleLpk = (id: string) => {
    setConfig((c) => c && ({
      ...c,
      lpkIds: c.lpkIds.includes(id) ? c.lpkIds.filter((x) => x !== id) : [...c.lpkIds, id],
    }));
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Rollout per LPK */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('superadmin.jras.rolloutTitle')}</h3>
        <p className="text-xs text-gray-400 mb-3">{t('superadmin.jras.rolloutHint')}</p>
        <div className="space-y-2">
          {(lpks?.lpks ?? []).map((lpk) => (
            <label key={lpk.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.lpkIds.includes(lpk.id)}
                onChange={() => toggleLpk(lpk.id)}
                className="rounded border-gray-300"
              />
              {lpk.name}
            </label>
          ))}
        </div>
      </div>

      {/* Bobot dimensi */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('superadmin.jras.weightsTitle')}</h3>
        <p className="text-xs text-gray-400 mb-3">{t('superadmin.jras.weightsHint')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {JRAS_DIMENSION_KEYS.map((d) => (
            <div key={d}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{t(`jras.dim.${d}`)}</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={config.weights[d] ?? 1}
                onChange={(e) =>
                  setConfig((c) => c && ({ ...c, weights: { ...c.weights, [d]: Number(e.target.value) } }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Kuota review */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('superadmin.jras.quotaTitle')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.quotaExSsw')}</label>
            <input
              type="number"
              min={0}
              max={10}
              value={config.reviewQuota.ex_ssw}
              onChange={(e) =>
                setConfig((c) => c && ({ ...c, reviewQuota: { ...c.reviewQuota, ex_ssw: Number(e.target.value) } }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.quotaJpHr')}</label>
            <input
              type="number"
              min={0}
              max={10}
              value={config.reviewQuota.jp_hr}
              onChange={(e) =>
                setConfig((c) => c && ({ ...c, reviewQuota: { ...c.reviewQuota, jp_hr: Number(e.target.value) } }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Threshold */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('superadmin.jras.thresholdsTitle')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.thresholdReady')}</label>
            <input
              type="number"
              min={0}
              max={100}
              value={config.thresholds.ready}
              onChange={(e) =>
                setConfig((c) => c && ({ ...c, thresholds: { ...c.thresholds, ready: Number(e.target.value) } }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.jras.thresholdRisk')}</label>
            <input
              type="number"
              min={0}
              max={100}
              value={config.thresholds.risk}
              onChange={(e) =>
                setConfig((c) => c && ({ ...c, thresholds: { ...c.thresholds, risk: Number(e.target.value) } }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && <p className="text-xs text-green-600">{t('superadmin.jras.configSaved')}</p>}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="bg-gray-900 text-white text-sm px-6 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
      >
        {mutation.isPending ? '…' : t('superadmin.jras.saveConfig')}
      </button>
    </div>
  );
}

// ── Tab: Komite ───────────────────────────────────────────────────────────────

function CommitteeTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: members } = useQuery<JrasCommitteeMemberData[]>({
    queryKey: ['jras-committee'],
    queryFn: () => api.get('/jras/superadmin/committee').then((r) => r.data),
  });

  // Kandidat anggota: semua user non-candidate yang aktif
  const { data: usersData } = useQuery<{ users: { id: string; name: string; email: string; role: string }[] }>({
    queryKey: ['jras-committee-user-pool'],
    queryFn: () => api.get('/superadmin/users?pageSize=100&isActive=true').then((r) => r.data),
  });

  useEffect(() => {
    if (members && selected === null) {
      setSelected(new Set(members.map((m) => m.userId)));
    }
  }, [members, selected]);

  const mutation = useMutation({
    mutationFn: () => api.put('/jras/superadmin/committee', { userIds: Array.from(selected ?? []) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jras-committee'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (selected === null) return <div className="p-6 text-sm text-gray-500">{t('loading')}</div>;

  const pool = (usersData?.users ?? []).filter((u) => u.role !== 'candidate');

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('superadmin.jras.committeeTitle')}</h3>
        <p className="text-xs text-gray-400 mb-3">{t('superadmin.jras.committeeHint')}</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pool.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(u.id)}
                onChange={() => toggle(u.id)}
                className="rounded border-gray-300"
              />
              <span className="flex-1">{u.name ?? u.email}</span>
              <span className="text-xs text-gray-400">{u.role}</span>
            </label>
          ))}
        </div>
      </div>
      {saved && <p className="text-xs text-green-600">{t('superadmin.jras.committeeSaved')}</p>}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="bg-gray-900 text-white text-sm px-6 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
      >
        {mutation.isPending ? '…' : t('superadmin.jras.saveCommittee')}
      </button>
    </div>
  );
}

// ── Tab: Early Warning rules ──────────────────────────────────────────────────

function RulesTab() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lang = i18n.language;

  const { data, isLoading } = useQuery<JrasRiskRuleData[]>({
    queryKey: ['jras-risk-rules'],
    queryFn: () => api.get('/jras/superadmin/risk-rules').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ ruleKey, enabled }: { ruleKey: string; enabled: boolean }) =>
      api.put(`/jras/superadmin/risk-rules/${ruleKey}`, { enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['jras-risk-rules'] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">{t('loading')}</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('superadmin.jras.rulesTitle')}</h3>
        <p className="text-xs text-gray-400 mb-3">{t('superadmin.jras.rulesHint')}</p>
        <div className="divide-y divide-gray-50">
          {(data ?? []).map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 py-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${rule.severity === 'red' ? 'bg-red-500' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{rule.ruleKey}</p>
                <p className="text-xs text-gray-500">
                  {lang === 'ja' ? (rule.descriptionJa ?? rule.descriptionId) : (rule.descriptionId ?? rule.descriptionJa)}
                </p>
              </div>
              <button
                onClick={() => toggleMutation.mutate({ ruleKey: rule.ruleKey, enabled: !rule.enabled })}
                className={`relative w-10 h-5.5 h-6 rounded-full transition shrink-0 ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${rule.enabled ? 'left-[18px]' : 'left-0.5'}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────

export default function SuperAdminJras() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'instruments' | 'config' | 'committee' | 'rules'>('instruments');

  const tabs = [
    { key: 'instruments' as const, label: t('superadmin.jras.tabInstruments') },
    { key: 'config' as const, label: t('superadmin.jras.tabConfig') },
    { key: 'committee' as const, label: t('superadmin.jras.tabCommittee') },
    { key: 'rules' as const, label: t('superadmin.jras.tabRules') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('superadmin.jras.title')}</h1>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
              tab === tb.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'instruments' && <InstrumentsTab />}
      {tab === 'config' && <ConfigTab />}
      {tab === 'committee' && <CommitteeTab />}
      {tab === 'rules' && <RulesTab />}
    </div>
  );
}
