import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type TabKey = 'tab1'|'tab2'|'tab3'|'tab4'|'tab5'|'tab6'|'tab7'|'tab8'|'tab9';
const ALL_TABS: TabKey[] = ['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9'];
type FontKey = 'ms-mincho'|'yu-mincho'|'yu-gothic'|'noto-serif-jp'|'noto-sans-jp';
type LayoutKey = 'layout1'|'layout2';
type CompletenessMode = 'legacy'|'cv';
type JourneyVizMode = 'text'|'graphical';
type ShokumuLayout = 'reverse'|'chronological'|'career';
type ShokumuRolloutMode = 'all'|'lpk';
type ShokumuTemplate = 'generic'|'gakken';
type ServiceTestStatus = 'idle'|'testing'|'online'|'offline'|'not_configured'|'error';

interface TabConfigResponse { config: Record<TabKey, boolean>; }
interface TranslationConfigResponse { enabled: boolean; }
interface TranslationService { id: string; name: string; model: string; endpoint: string; keyConfigured: boolean; }
interface TranslationStatusResponse { services: TranslationService[]; }
interface TranslationApiConfig { keySource: 'db'|'env'|'none'; keyMasked: string | null; }
interface LpkOption { id: string; name: string; city: string | null; }
interface LpkListResponse { lpks: LpkOption[]; }

// ── Constants ─────────────────────────────────────────────────────────────────
const FONT_OPTIONS: { key: FontKey; label: string; sublabel: string; value: string; googleFont?: string }[] = [
  { key: 'ms-mincho',    label: 'MS Mincho',     sublabel: 'Windows (既定)',          value: '"MS Mincho", serif' },
  { key: 'yu-mincho',    label: 'Yu Mincho',      sublabel: 'Windows / macOS (推奨)',  value: '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho", serif' },
  { key: 'yu-gothic',    label: 'Yu Gothic',      sublabel: 'ゴシック体 (sans-serif)', value: '"Hiragino Sans", "Yu Gothic", "Meiryo", "MS PGothic", sans-serif' },
  { key: 'noto-serif-jp',label: 'Noto Serif JP',  sublabel: 'Google Fonts (明朝体)',   value: '"Noto Serif JP", serif',     googleFont: 'Noto+Serif+JP:wght@400;700' },
  { key: 'noto-sans-jp', label: 'Noto Sans JP',   sublabel: 'Google Fonts (ゴシック)', value: '"Noto Sans JP", sans-serif', googleFont: 'Noto+Sans+JP:wght@400;700' },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
        checked ? 'bg-navy-700' : 'bg-gray-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SuperAdminDataEntrySettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // ── State ──
  const [config, setConfig] = useState<Record<TabKey, boolean>>({
    tab1: true, tab2: true, tab3: true, tab4: true, tab5: true,
    tab6: true, tab7: true, tab8: true, tab9: true,
  });
  const [translateEnabled, setTranslateEnabled] = useState(true);
  const [fontKey, setFontKey] = useState<FontKey>('ms-mincho');
  const [layoutKey, setLayoutKey] = useState<LayoutKey>('layout1');
  const [cvLangMode, setCvLangMode] = useState<'bilingual'|'lpk'>('bilingual');
  const [cvLangJaLpkIds, setCvLangJaLpkIds] = useState<string[]>([]);
  const [completenessMode, setCompletenessMode] = useState<CompletenessMode>('legacy');
  const [photoBgEnabled, setPhotoBgEnabled] = useState(false);
  const [photoBgColor, setPhotoBgColor] = useState('#ffffff');
  const [journeyVizMode, setJourneyVizMode] = useState<JourneyVizMode>('graphical');
  const [shokumuEnabled, setShokumuEnabled] = useState(false);
  const [shokumuLayout, setShokumuLayout] = useState<ShokumuLayout>('reverse');
  const [shokumuMergeCv, setShokumuMergeCv] = useState(false);
  const [shokumuRolloutMode, setShokumuRolloutMode] = useState<ShokumuRolloutMode>('all');
  const [shokumuRolloutLpkIds, setShokumuRolloutLpkIds] = useState<string[]>([]);
  const [shokumuTemplate, setShokumuTemplate] = useState<ShokumuTemplate>('generic');
  const [shokumuRecruiterEnabled, setShokumuRecruiterEnabled] = useState(false);

  // API key management state (explicit save — not auto-save)
  const [serviceTestStatus, setServiceTestStatus] = useState<Record<string, ServiceTestStatus>>({});
  const [serviceTestLatency, setServiceTestLatency] = useState<Record<string, number | null>>({});
  const [serviceTestDetail, setServiceTestDetail] = useState<Record<string, string | null>>({});
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [apiKeySaving, setApiKeySaving] = useState<Record<string, boolean>>({});
  const [apiKeySaved, setApiKeySaved] = useState<Record<string, boolean>>({});
  const [apiKeyError, setApiKeyError] = useState<Record<string, boolean>>({});

  // Unified save feedback — one map instead of per-section booleans
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});
  const [errorFlash, setErrorFlash] = useState<Record<string, boolean>>({});
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function markSaved(key: string) {
    setSavedFlash(p => ({ ...p, [key]: true }));
    setErrorFlash(p => ({ ...p, [key]: false }));
    setTimeout(() => setSavedFlash(p => ({ ...p, [key]: false })), 2500);
  }
  function markError(key: string) {
    setErrorFlash(p => ({ ...p, [key]: true }));
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<TabConfigResponse>({
    queryKey: ['candidate-tab-config'],
    queryFn: () => api.get('/superadmin/candidate-tab-config').then(r => r.data),
  });
  const { data: translateData } = useQuery<TranslationConfigResponse>({
    queryKey: ['translation-config'],
    queryFn: () => api.get('/superadmin/translation-config').then(r => r.data),
  });
  const { data: fontData } = useQuery<{ fontKey: FontKey }>({
    queryKey: ['cv-font'],
    queryFn: () => api.get('/superadmin/cv-font').then(r => r.data),
  });
  const { data: layoutData } = useQuery<{ layout: LayoutKey }>({
    queryKey: ['cv-layout'],
    queryFn: () => api.get('/superadmin/cv-layout').then(r => r.data),
  });
  const { data: completenessModeData } = useQuery<{ mode: CompletenessMode }>({
    queryKey: ['completeness-mode'],
    queryFn: () => api.get('/superadmin/completeness-mode').then(r => r.data),
  });
  const { data: photoBgData } = useQuery<{ color: string; enabled: boolean }>({
    queryKey: ['photo-bg-color'],
    queryFn: () => api.get('/superadmin/photo-bg-color').then(r => r.data),
  });
  const { data: journeyVizData } = useQuery<{ mode: JourneyVizMode }>({
    queryKey: ['journey-visualization'],
    queryFn: () => api.get('/superadmin/journey-visualization').then(r => r.data),
  });
  const { data: cvLangConfigData } = useQuery<{ mode: string; jaLpkIds: string[] }>({
    queryKey: ['cv-lang-config'],
    queryFn: () => api.get('/superadmin/cv-lang-config').then(r => r.data),
  });
  const { data: shokumuConfigData } = useQuery<{
    enabled: boolean; layout: ShokumuLayout; mergeCv: boolean;
    rolloutMode: ShokumuRolloutMode; rolloutLpkIds: string[];
    template: ShokumuTemplate; recruiterEnabled: boolean;
  }>({
    queryKey: ['shokumu-config'],
    queryFn: () => api.get('/superadmin/shokumu-config').then(r => r.data),
  });
  const { data: lpkListData } = useQuery<LpkListResponse>({
    queryKey: ['superadmin-lpks'],
    queryFn: () => api.get('/superadmin/lpks').then(r => r.data),
    staleTime: 120_000,
  });
  const { data: translationStatusData, refetch: refetchStatus } = useQuery<TranslationStatusResponse>({
    queryKey: ['translation-status'],
    queryFn: () => api.get('/superadmin/translation-status').then(r => r.data),
    staleTime: 30_000,
  });
  const { data: translationApiConfig, refetch: refetchApiConfig } = useQuery<TranslationApiConfig>({
    queryKey: ['translation-api-config'],
    queryFn: () => api.get('/superadmin/translation-api-config').then(r => r.data),
    staleTime: 30_000,
  });

  // ── Server → state sync ───────────────────────────────────────────────────
  useEffect(() => { if (data?.config) setConfig({ ...data.config } as Record<TabKey, boolean>); }, [data]);
  useEffect(() => { if (translateData !== undefined) setTranslateEnabled(translateData.enabled !== false); }, [translateData]);
  useEffect(() => { if (fontData?.fontKey) setFontKey(fontData.fontKey); }, [fontData]);
  useEffect(() => { if (layoutData?.layout) setLayoutKey(layoutData.layout as LayoutKey); }, [layoutData]);
  useEffect(() => { if (completenessModeData?.mode) setCompletenessMode(completenessModeData.mode); }, [completenessModeData]);
  useEffect(() => {
    if (photoBgData !== undefined) {
      setPhotoBgEnabled(photoBgData.enabled);
      if (photoBgData.color) setPhotoBgColor(photoBgData.color);
    }
  }, [photoBgData]);
  useEffect(() => { if (journeyVizData?.mode) setJourneyVizMode(journeyVizData.mode); }, [journeyVizData]);
  useEffect(() => {
    if (cvLangConfigData !== undefined) {
      setCvLangMode(cvLangConfigData.mode === 'lpk' ? 'lpk' : 'bilingual');
      setCvLangJaLpkIds(cvLangConfigData.jaLpkIds ?? []);
    }
  }, [cvLangConfigData]);
  useEffect(() => {
    if (shokumuConfigData !== undefined) {
      setShokumuEnabled(shokumuConfigData.enabled);
      if (shokumuConfigData.layout) setShokumuLayout(shokumuConfigData.layout);
      setShokumuMergeCv(shokumuConfigData.mergeCv);
      if (shokumuConfigData.rolloutMode) setShokumuRolloutMode(shokumuConfigData.rolloutMode);
      setShokumuRolloutLpkIds(shokumuConfigData.rolloutLpkIds ?? []);
      if (shokumuConfigData.template) setShokumuTemplate(shokumuConfigData.template);
      setShokumuRecruiterEnabled(shokumuConfigData.recruiterEnabled ?? false);
    }
  }, [shokumuConfigData]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const tabMutation = useMutation({
    mutationFn: (cfg: Record<TabKey, boolean>) =>
      api.put('/superadmin/candidate-tab-config', cfg).then(r => r.data),
    onSuccess: () => { markSaved('tabs'); void qc.invalidateQueries({ queryKey: ['candidate-tab-config'] }); },
    onError: () => markError('tabs'),
  });
  const translateMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put('/superadmin/translation-config', { enabled }).then(r => r.data),
    onSuccess: () => { markSaved('translate'); void qc.invalidateQueries({ queryKey: ['translation-config'] }); },
    onError: () => markError('translate'),
  });
  const fontMutation = useMutation({
    mutationFn: (key: FontKey) => api.put('/superadmin/cv-font', { fontKey: key }).then(r => r.data),
    onSuccess: () => { markSaved('font'); void qc.invalidateQueries({ queryKey: ['cv-font'] }); },
    onError: () => markError('font'),
  });
  const layoutMutation = useMutation({
    mutationFn: (key: LayoutKey) => api.put('/superadmin/cv-layout', { layout: key }).then(r => r.data),
    onSuccess: () => { markSaved('layout'); void qc.invalidateQueries({ queryKey: ['cv-layout'] }); },
    onError: () => markError('layout'),
  });
  const cvLangMutation = useMutation({
    mutationFn: ({ mode, jaLpkIds }: { mode: string; jaLpkIds: string[] }) =>
      api.put('/superadmin/cv-lang-config', { mode, jaLpkIds }).then(r => r.data),
    onSuccess: () => { markSaved('cvlang'); void qc.invalidateQueries({ queryKey: ['cv-lang-config'] }); },
    onError: () => markError('cvlang'),
  });
  const completenessMutation = useMutation({
    mutationFn: (mode: CompletenessMode) =>
      api.put('/superadmin/completeness-mode', { mode }).then(r => r.data),
    onSuccess: () => { markSaved('completeness'); void qc.invalidateQueries({ queryKey: ['completeness-mode'] }); },
    onError: () => markError('completeness'),
  });
  const photoBgMutation = useMutation({
    mutationFn: ({ enabled, color }: { enabled: boolean; color: string }) =>
      api.put('/superadmin/photo-bg-color', { enabled, color }).then(r => r.data),
    onSuccess: () => { markSaved('photobg'); void qc.invalidateQueries({ queryKey: ['photo-bg-color'] }); },
    onError: () => markError('photobg'),
  });
  const journeyVizMutation = useMutation({
    mutationFn: (mode: JourneyVizMode) =>
      api.put('/superadmin/journey-visualization', { mode }).then(r => r.data),
    onSuccess: () => { markSaved('journeyviz'); void qc.invalidateQueries({ queryKey: ['journey-visualization'] }); },
    onError: () => markError('journeyviz'),
  });
  const shokumuMutation = useMutation({
    mutationFn: (p: { enabled: boolean; layout: string; mergeCv: boolean; rolloutMode: string; rolloutLpkIds: string[]; template: string; recruiterEnabled: boolean }) =>
      api.put('/superadmin/shokumu-config', p).then(r => r.data),
    onSuccess: () => { markSaved('shokumu'); void qc.invalidateQueries({ queryKey: ['shokumu-config'] }); },
    onError: () => markError('shokumu'),
  });

  // ── Auto-save helpers ─────────────────────────────────────────────────────
  function handleTabToggle(tab: TabKey, value: boolean) {
    const next = { ...config, [tab]: value };
    setConfig(next);
    tabMutation.mutate(next);
  }

  function saveShokumu(patch: Partial<{
    enabled: boolean; layout: ShokumuLayout; mergeCv: boolean;
    rolloutMode: ShokumuRolloutMode; rolloutLpkIds: string[];
    template: ShokumuTemplate; recruiterEnabled: boolean;
  }>) {
    shokumuMutation.mutate({
      enabled:          patch.enabled          ?? shokumuEnabled,
      layout:           patch.layout           ?? shokumuLayout,
      mergeCv:          patch.mergeCv          ?? shokumuMergeCv,
      rolloutMode:      patch.rolloutMode      ?? shokumuRolloutMode,
      rolloutLpkIds:    patch.rolloutLpkIds    ?? shokumuRolloutLpkIds,
      template:         patch.template         ?? shokumuTemplate,
      recruiterEnabled: patch.recruiterEnabled ?? shokumuRecruiterEnabled,
    });
  }

  // ── API key helpers (kept with explicit save buttons) ─────────────────────
  async function saveApiKey(serviceId: string, skipValidation = false) {
    const key = apiKeyInput[serviceId]?.trim() ?? '';
    if (!key) return;
    setApiKeySaving(p => ({ ...p, [serviceId]: true }));
    setApiKeySaved(p => ({ ...p, [serviceId]: false }));
    setApiKeyError(p => ({ ...p, [serviceId]: false }));
    setServiceTestDetail(p => ({ ...p, [serviceId]: null }));
    try {
      await api.put('/superadmin/translation-api-config', { apiKey: key, skipValidation });
      setApiKeyInput(p => ({ ...p, [serviceId]: '' }));
      setApiKeySaved(p => ({ ...p, [serviceId]: true }));
      void refetchApiConfig();
      void refetchStatus();
      setTimeout(() => setApiKeySaved(p => ({ ...p, [serviceId]: false })), 3000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? null;
      setApiKeyError(p => ({ ...p, [serviceId]: true }));
      if (detail) setServiceTestDetail(p => ({ ...p, [serviceId]: detail }));
    } finally {
      setApiKeySaving(p => ({ ...p, [serviceId]: false }));
    }
  }

  async function clearApiKey(serviceId: string) {
    setApiKeySaving(p => ({ ...p, [serviceId]: true }));
    try {
      await api.put('/superadmin/translation-api-config', { apiKey: null });
      void refetchApiConfig();
      void refetchStatus();
    } catch {
      setApiKeyError(p => ({ ...p, [serviceId]: true }));
    } finally {
      setApiKeySaving(p => ({ ...p, [serviceId]: false }));
    }
  }

  async function testService(serviceId: string) {
    setServiceTestStatus(p => ({ ...p, [serviceId]: 'testing' }));
    setServiceTestLatency(p => ({ ...p, [serviceId]: null }));
    setServiceTestDetail(p => ({ ...p, [serviceId]: null }));
    try {
      const result = await api.post<{ status: string; latencyMs: number | null; httpStatus?: number; errorDetail?: string | null }>(
        '/superadmin/translation-status/test', { serviceId },
      ).then(r => r.data);
      setServiceTestStatus(p => ({ ...p, [serviceId]: result.status as ServiceTestStatus }));
      setServiceTestLatency(p => ({ ...p, [serviceId]: result.latencyMs ?? null }));
      if (result.errorDetail) setServiceTestDetail(p => ({ ...p, [serviceId]: `HTTP ${result.httpStatus ?? '?'}: ${result.errorDetail}` }));
    } catch {
      setServiceTestStatus(p => ({ ...p, [serviceId]: 'offline' }));
      setServiceTestDetail(p => ({ ...p, [serviceId]: 'Network error' }));
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  type TabNav = 'tabProfil'|'cv'|'resume'|'foto'|'terjemahan'|'sistem';
  const [activeTab, setActiveTab] = useState<TabNav>('tabProfil');

  const TAB_NAV: { key: TabNav; labelKey: string }[] = [
    { key: 'tabProfil',  labelKey: 'tabNav_tabProfil' },
    { key: 'cv',         labelKey: 'tabNav_cv' },
    { key: 'resume',     labelKey: 'tabNav_resume' },
    { key: 'foto',       labelKey: 'tabNav_foto' },
    { key: 'terjemahan', labelKey: 'tabNav_terjemahan' },
    { key: 'sistem',     labelKey: 'tabNav_sistem' },
  ];

  const badge = (key: string) => {
    if (savedFlash[key]) return <span className="text-xs text-green-600 shrink-0">✓ {t('superadmin.dataEntrySettings.saved')}</span>;
    if (errorFlash[key]) return <span className="text-xs text-red-500 shrink-0">{t('superadmin.dataEntrySettings.errorSave')}</span>;
    return null;
  };

  const panelHead = (desc: string, badgeKey: string) => (
    <div className="flex items-start justify-between mb-4">
      <p className="text-sm text-gray-500">{desc}</p>
      <div className="ml-4 shrink-0">{badge(badgeKey)}</div>
    </div>
  );

  const subHead = (title: string, badgeKey: string) => (
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {badge(badgeKey)}
    </div>
  );

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;

  // ── Translation service panel (reused in Terjemahan tab) ────────────────
  const translationServicePanel = (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.translateLabel')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('superadmin.dataEntrySettings.translateHint')}</p>
        </div>
        <Toggle
          checked={translateEnabled}
          onChange={v => { setTranslateEnabled(v); translateMutation.mutate(v); }}
        />
      </div>
      {(translationStatusData?.services ?? []).length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">{t('superadmin.dataEntrySettings.svcNone')}</p>
      ) : (
        <>
          <div className="px-5 py-2 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('superadmin.dataEntrySettings.translateServicesTitle')}</p>
          </div>
          {(translationStatusData?.services ?? []).map(svc => {
            const testStatus = serviceTestStatus[svc.id] ?? 'idle';
            const latency    = serviceTestLatency[svc.id];
            const testDetail = serviceTestDetail[svc.id] ?? null;
            const statusDot =
              testStatus === 'online'         ? 'bg-green-500' :
              testStatus === 'offline'        ? 'bg-red-500'   :
              testStatus === 'error'          ? 'bg-orange-400':
              testStatus === 'not_configured' ? 'bg-gray-300'  :
              testStatus === 'testing'        ? 'bg-yellow-400 animate-pulse' :
              'bg-gray-200';
            const statusLabel =
              testStatus === 'online'         ? t('superadmin.dataEntrySettings.svcOnline')         :
              testStatus === 'offline'        ? t('superadmin.dataEntrySettings.svcOffline')        :
              testStatus === 'error'          ? t('superadmin.dataEntrySettings.svcError')          :
              testStatus === 'not_configured' ? t('superadmin.dataEntrySettings.svcNotConfigured')  :
              testStatus === 'testing'        ? t('superadmin.dataEntrySettings.svcTesting')        :
              null;
            const keySource  = translationApiConfig?.keySource ?? 'none';
            const keyMasked  = translationApiConfig?.keyMasked ?? null;
            const sourceBadge =
              keySource === 'db'  ? <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">{t('superadmin.dataEntrySettings.svcKeyDb')}</span> :
              keySource === 'env' ? <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{t('superadmin.dataEntrySettings.svcKeyEnv')}</span> :
                                    <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">{t('superadmin.dataEntrySettings.svcKeyMissing')}</span>;
            return (
              <div key={svc.id} className="divide-y divide-gray-50">
                <div className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{svc.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{svc.model} · {svc.endpoint}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sourceBadge}
                    {statusLabel && (
                      <span className={`text-xs ${testStatus === 'error' || testStatus === 'offline' ? 'text-red-500' : 'text-gray-500'}`}>
                        {statusLabel}{latency != null ? ` (${latency}ms)` : ''}
                      </span>
                    )}
                    <button
                      onClick={() => { void testService(svc.id); }}
                      disabled={testStatus === 'testing'}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition disabled:opacity-50"
                    >
                      {testStatus === 'testing' ? '…' : t('superadmin.dataEntrySettings.svcTest')}
                    </button>
                  </div>
                </div>
                <div className="px-5 py-3 bg-gray-50 space-y-2">
                  <p className="text-xs font-medium text-gray-600">{t('superadmin.dataEntrySettings.svcApiKeyTitle')}</p>
                  {keyMasked && (
                    <p className="text-xs text-gray-500 font-mono">
                      {t('superadmin.dataEntrySettings.svcCurrentKey')}: <span className="text-gray-700">{keyMasked}</span>
                      {keySource === 'env' && <span className="ml-2 text-amber-600">({t('superadmin.dataEntrySettings.svcKeyEnvReadOnly')})</span>}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={apiKeyInput[svc.id] ?? ''}
                      onChange={e => setApiKeyInput(p => ({ ...p, [svc.id]: e.target.value }))}
                      placeholder={t('superadmin.dataEntrySettings.svcApiKeyPlaceholder')}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 font-mono"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => { void saveApiKey(svc.id); }}
                      disabled={!apiKeyInput[svc.id]?.trim() || apiKeySaving[svc.id]}
                      className="px-3 py-1.5 text-xs bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition disabled:opacity-40"
                    >
                      {apiKeySaving[svc.id] ? '…' : t('superadmin.dataEntrySettings.svcApiKeySave')}
                    </button>
                    {keySource === 'db' && (
                      <button
                        onClick={() => { void clearApiKey(svc.id); }}
                        disabled={apiKeySaving[svc.id]}
                        className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-40"
                      >
                        {t('superadmin.dataEntrySettings.svcApiKeyClear')}
                      </button>
                    )}
                  </div>
                  {apiKeySaved[svc.id] && <p className="text-xs text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</p>}
                  {apiKeyError[svc.id] && (
                    <div className="space-y-1">
                      <p className="text-xs text-red-500">
                        {t('superadmin.dataEntrySettings.errorSave')}
                        {serviceTestDetail[svc.id] && <span className="ml-1 font-mono">— {serviceTestDetail[svc.id]}</span>}
                      </p>
                      {apiKeyInput[svc.id]?.trim() && (
                        <button
                          onClick={() => { void saveApiKey(svc.id, true); }}
                          disabled={apiKeySaving[svc.id]}
                          className="text-xs text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
                        >
                          {t('superadmin.dataEntrySettings.svcApiKeySaveForce')}
                        </button>
                      )}
                    </div>
                  )}
                  {testDetail && !apiKeyError[svc.id] && (
                    <p className="text-xs text-red-400 font-mono mt-1">{testDetail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.dataEntrySettings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('superadmin.dataEntrySettings.descriptionFull')}</p>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200">
        {TAB_NAV.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab === tab.key
                ? 'text-navy-700 after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-navy-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`superadmin.dataEntrySettings.${tab.labelKey}`)}
          </button>
        ))}
      </div>

      {/* ── Tab panels ────────────────────────────────────────────────────── */}

      {/* ── Tab: Tab Profil ────────────────────────────────────────────────── */}
      {activeTab === 'tabProfil' && (
        <div className="space-y-2">
          {panelHead(t('superadmin.dataEntrySettings.description'), 'tabs')}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {ALL_TABS.map(tab => (
              <div key={tab} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-gray-800">{t(`candidate.profile.${tab}`)}</span>
                <Toggle
                  checked={config[tab] !== false}
                  onChange={v => handleTabToggle(tab, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: CV ────────────────────────────────────────────────────────── */}
      {activeTab === 'cv' && (
        <div className="space-y-2">
          {panelHead(t('superadmin.dataEntrySettings.cvSettingsDesc'), '__cv__')}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">

            {/* Font */}
            <div className="px-5 py-4">
              {subHead(t('superadmin.dataEntrySettings.cvFontTitle'), 'font')}
              <p className="text-xs text-gray-500 mb-3">{t('superadmin.dataEntrySettings.cvFontDesc')}</p>
              <div className="divide-y divide-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                {FONT_OPTIONS.map(opt => (
                  <label key={opt.key} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="cv_font"
                        value={opt.key}
                        checked={fontKey === opt.key}
                        onChange={() => { setFontKey(opt.key); fontMutation.mutate(opt.key); }}
                        className="accent-navy-700"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.sublabel}</p>
                        {opt.googleFont && <p className="text-[10px] text-amber-500 mt-0.5">※ インターネット接続が必要</p>}
                      </div>
                    </div>
                    <span style={{ fontFamily: opt.value }} className="text-base text-gray-700 select-none">日本語のサンプル</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Layout */}
            <div className="px-5 py-4">
              {subHead(t('superadmin.dataEntrySettings.cvLayoutTitle'), 'layout')}
              <p className="text-xs text-gray-500 mb-3">{t('superadmin.dataEntrySettings.cvLayoutDesc')}</p>
              <div className="space-y-3">
                {(['layout1', 'layout2'] as LayoutKey[]).map(key => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="cv_layout"
                      value={key}
                      checked={layoutKey === key}
                      onChange={() => { setLayoutKey(key); layoutMutation.mutate(key); }}
                      className="accent-navy-700 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.${key}Label`)}</p>
                      <p className="text-xs text-gray-400">{t(`superadmin.dataEntrySettings.${key}Desc`)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Language format */}
            <div className="px-5 py-4">
              {subHead(t('superadmin.dataEntrySettings.cvLangTitle'), 'cvlang')}
              <p className="text-xs text-gray-500 mb-3">{t('superadmin.dataEntrySettings.cvLangDesc')}</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio" name="cv_lang_mode" value="bilingual"
                    checked={cvLangMode === 'bilingual'}
                    onChange={() => { setCvLangMode('bilingual'); cvLangMutation.mutate({ mode: 'bilingual', jaLpkIds: cvLangJaLpkIds }); }}
                    className="accent-navy-700"
                  />
                  <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.cvLangBilingual')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio" name="cv_lang_mode" value="lpk"
                    checked={cvLangMode === 'lpk'}
                    onChange={() => { setCvLangMode('lpk'); cvLangMutation.mutate({ mode: 'lpk', jaLpkIds: cvLangJaLpkIds }); }}
                    className="accent-navy-700"
                  />
                  <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.cvLangPerLpk')}</span>
                </label>
              </div>
              {cvLangMode === 'lpk' && (
                <div className="mt-3 ml-6 border border-gray-100 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto space-y-1.5">
                  {(lpkListData?.lpks ?? []).length === 0 && <p className="text-xs text-gray-400">No LPKs found.</p>}
                  {(lpkListData?.lpks ?? []).map(lpk => {
                    const newIds = (checked: boolean) =>
                      checked ? [...cvLangJaLpkIds, lpk.id] : cvLangJaLpkIds.filter(id => id !== lpk.id);
                    return (
                      <label key={lpk.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cvLangJaLpkIds.includes(lpk.id)}
                          onChange={e => {
                            const ids = newIds(e.target.checked);
                            setCvLangJaLpkIds(ids);
                            cvLangMutation.mutate({ mode: 'lpk', jaLpkIds: ids });
                          }}
                          className="accent-navy-700 w-4 h-4"
                        />
                        <span className="text-sm text-gray-800">{lpk.name}</span>
                        {lpk.city && <span className="text-xs text-gray-400">{lpk.city}</span>}
                        <span className="ml-auto text-xs text-gold-600 font-medium">{t('superadmin.dataEntrySettings.cvLangJaLabel')}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Resume ───────────────────────────────────────────────────── */}
      {activeTab === 'resume' && (
        <div className="space-y-2">
          {panelHead(t('superadmin.dataEntrySettings.shokumuDesc'), 'shokumu')}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">

            {/* Enable toggles */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.shokumuEnable')}</span>
                <Toggle
                  checked={shokumuEnabled}
                  onChange={v => { setShokumuEnabled(v); saveShokumu({ enabled: v }); }}
                />
              </div>
              <div className={`flex items-center justify-between transition-opacity ${!shokumuEnabled ? 'opacity-40' : ''}`}>
                <span className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.shokumuRecruiterEnable')}</span>
                <Toggle
                  checked={shokumuRecruiterEnabled}
                  disabled={!shokumuEnabled}
                  onChange={v => { setShokumuRecruiterEnabled(v); saveShokumu({ recruiterEnabled: v }); }}
                />
              </div>
            </div>

            {/* Template */}
            <div className={`px-5 py-4 space-y-3 transition-opacity ${!shokumuEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('superadmin.dataEntrySettings.shokumuTemplateTitle')}</p>
              {(['generic', 'gakken'] as ShokumuTemplate[]).map(tmpl => (
                <label key={tmpl} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio" name="shokumu_template" value={tmpl}
                    checked={shokumuTemplate === tmpl}
                    onChange={() => { setShokumuTemplate(tmpl); saveShokumu({ template: tmpl }); }}
                    className="accent-navy-700 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.shokumuTemplate_${tmpl}Label`)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t(`superadmin.dataEntrySettings.shokumuTemplate_${tmpl}Desc`)}</p>
                  </div>
                </label>
              ))}
              {shokumuTemplate === 'gakken' && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${translateEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${translateEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.gakkenAutoTranslateTitle')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {translateEnabled
                        ? t('superadmin.dataEntrySettings.gakkenAutoTranslateActiveDesc')
                        : t('superadmin.dataEntrySettings.gakkenAutoTranslateInactiveDesc')}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${translateEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {translateEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              )}
            </div>

            {/* Font (read-only) */}
            <div className={`px-5 py-3 flex items-center justify-between transition-opacity ${!shokumuEnabled ? 'opacity-40' : ''}`}>
              <div>
                <p className="text-sm font-medium text-gray-700">{t('superadmin.dataEntrySettings.shokumuFontLabel')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('superadmin.dataEntrySettings.shokumuFontNote')}</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-1 font-medium">
                {FONT_OPTIONS.find(o => o.key === fontKey)?.label ?? fontKey}
              </span>
            </div>

            {/* Layout / sort order */}
            <div className={`px-5 py-4 space-y-2 transition-opacity ${!shokumuEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('superadmin.dataEntrySettings.shokumuLayoutTitle')}</p>
              {(['reverse', 'chronological', 'career'] as ShokumuLayout[]).map(mode => (
                <label key={mode} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio" name="shokumu_layout" value={mode}
                    checked={shokumuLayout === mode}
                    onChange={() => { setShokumuLayout(mode); saveShokumu({ layout: mode }); }}
                    className="accent-navy-700"
                  />
                  <span className="text-sm text-gray-800">{t(`superadmin.dataEntrySettings.shokumuLayout_${mode}Label`)}</span>
                </label>
              ))}
            </div>

            {/* Output mode */}
            <div className={`px-5 py-4 space-y-2 transition-opacity ${!shokumuEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('superadmin.dataEntrySettings.shokumuOutputTitle')}</p>
              {[
                { value: false, label: t('superadmin.dataEntrySettings.shokumuOutputSeparate') },
                { value: true,  label: t('superadmin.dataEntrySettings.shokumuOutputMerged') },
              ].map(opt => (
                <label key={String(opt.value)} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio" name="shokumu_merge" value={String(opt.value)}
                    checked={shokumuMergeCv === opt.value}
                    onChange={() => { setShokumuMergeCv(opt.value); saveShokumu({ mergeCv: opt.value }); }}
                    className="accent-navy-700"
                  />
                  <span className="text-sm text-gray-800">{opt.label}</span>
                </label>
              ))}
            </div>

            {/* Rollout */}
            <div className={`px-5 py-4 space-y-2 transition-opacity ${!shokumuEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('superadmin.dataEntrySettings.shokumuRolloutTitle')}</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio" name="shokumu_rollout" value="all"
                  checked={shokumuRolloutMode === 'all'}
                  onChange={() => { setShokumuRolloutMode('all'); saveShokumu({ rolloutMode: 'all' }); }}
                  className="accent-navy-700"
                />
                <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.shokumuRolloutAll')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio" name="shokumu_rollout" value="lpk"
                  checked={shokumuRolloutMode === 'lpk'}
                  onChange={() => { setShokumuRolloutMode('lpk'); saveShokumu({ rolloutMode: 'lpk' }); }}
                  className="accent-navy-700"
                />
                <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.shokumuRolloutLpk')}</span>
              </label>
              {shokumuRolloutMode === 'lpk' && (
                <div className="mt-2 ml-6 border border-gray-100 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto space-y-1.5">
                  {(lpkListData?.lpks ?? []).length === 0 && <p className="text-xs text-gray-400">No LPKs found.</p>}
                  {(lpkListData?.lpks ?? []).map(lpk => (
                    <label key={lpk.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shokumuRolloutLpkIds.includes(lpk.id)}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...shokumuRolloutLpkIds, lpk.id]
                            : shokumuRolloutLpkIds.filter(id => id !== lpk.id);
                          setShokumuRolloutLpkIds(ids);
                          saveShokumu({ rolloutLpkIds: ids });
                        }}
                        className="accent-navy-700 w-4 h-4"
                      />
                      <span className="text-sm text-gray-800">{lpk.name}</span>
                      {lpk.city && <span className="text-xs text-gray-400">{lpk.city}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Foto ──────────────────────────────────────────────────────── */}
      {activeTab === 'foto' && (
        <div className="space-y-2">
          {panelHead(t('superadmin.dataEntrySettings.photoBgDesc'), 'photobg')}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.photoBgEnable')}</span>
              <Toggle
                checked={photoBgEnabled}
                onChange={v => { setPhotoBgEnabled(v); photoBgMutation.mutate({ enabled: v, color: photoBgColor }); }}
              />
            </div>
            {photoBgEnabled && (
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700">{t('superadmin.dataEntrySettings.photoBgColorLabel')}</label>
                <input
                  type="color"
                  value={photoBgColor}
                  onChange={e => {
                    const color = e.target.value;
                    setPhotoBgColor(color);
                    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
                    colorDebounceRef.current = setTimeout(() => {
                      photoBgMutation.mutate({ enabled: photoBgEnabled, color });
                    }, 600);
                  }}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                />
                <span className="text-sm text-gray-400 font-mono">{photoBgColor.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Terjemahan ────────────────────────────────────────────────── */}
      {activeTab === 'terjemahan' && (
        <div className="space-y-2">
          {panelHead(t('superadmin.dataEntrySettings.translateDesc'), 'translate')}
          {translationServicePanel}
        </div>
      )}

      {/* ── Tab: Sistem ────────────────────────────────────────────────────── */}
      {activeTab === 'sistem' && (
        <div className="space-y-6">

          {/* Completeness Mode */}
          <div>
            {subHead(t('superadmin.dataEntrySettings.completenessTitle'), 'completeness')}
            <p className="text-xs text-gray-500 mb-3">{t('superadmin.dataEntrySettings.completenessDesc')}</p>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {(['legacy', 'cv'] as CompletenessMode[]).map(mode => (
                <label key={mode} className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="radio" name="completeness_mode" value={mode}
                    checked={completenessMode === mode}
                    onChange={() => { setCompletenessMode(mode); completenessMutation.mutate(mode); }}
                    className="accent-navy-700 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.completeness_${mode}Label`)}</p>
                    <p className="text-xs text-gray-400">{t(`superadmin.dataEntrySettings.completeness_${mode}Desc`)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Journey Visualization */}
          <div>
            {subHead(t('superadmin.dataEntrySettings.journeyVizTitle'), 'journeyviz')}
            <p className="text-xs text-gray-500 mb-3">{t('superadmin.dataEntrySettings.journeyVizDesc')}</p>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {(['text', 'graphical'] as JourneyVizMode[]).map(mode => (
                <label key={mode} className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="radio" name="journey_visualization" value={mode}
                    checked={journeyVizMode === mode}
                    onChange={() => { setJourneyVizMode(mode); journeyVizMutation.mutate(mode); }}
                    className="accent-navy-700 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.journeyViz_${mode}Label`)}</p>
                    <p className="text-xs text-gray-400">{t(`superadmin.dataEntrySettings.journeyViz_${mode}Desc`)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
