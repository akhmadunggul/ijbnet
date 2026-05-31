import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type TabKey = 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5' | 'tab6' | 'tab7' | 'tab8' | 'tab9';
const ALL_TABS: TabKey[] = ['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9'];

interface TabConfigResponse {
  config: Record<TabKey, boolean>;
}

interface TranslationConfigResponse {
  enabled: boolean;
}

interface TranslationService {
  id: string;
  name: string;
  model: string;
  endpoint: string;
  keyConfigured: boolean;
}

interface TranslationStatusResponse {
  services: TranslationService[];
}

type ServiceTestStatus = 'idle' | 'testing' | 'online' | 'offline' | 'not_configured' | 'error';

interface TranslationApiConfig {
  keySource: 'db' | 'env' | 'none';
  keyMasked: string | null;
}

type FontKey = 'ms-mincho' | 'yu-mincho' | 'yu-gothic' | 'noto-serif-jp' | 'noto-sans-jp';
type LayoutKey = 'layout1' | 'layout2';
type CompletenessMode = 'legacy' | 'cv';
type JourneyVizMode = 'text' | 'graphical';
type ShokumuLayout = 'reverse' | 'chronological' | 'career';
type ShokumuRolloutMode = 'all' | 'lpk';

interface LpkOption { id: string; name: string; city: string | null; }
interface LpkListResponse { lpks: LpkOption[]; }

const FONT_OPTIONS: { key: FontKey; label: string; sublabel: string; value: string; googleFont?: string }[] = [
  { key: 'ms-mincho',    label: 'MS Mincho',      sublabel: 'Windows (既定)',          value: '"MS Mincho", serif' },
  { key: 'yu-mincho',    label: 'Yu Mincho',       sublabel: 'Windows / macOS (推奨)',  value: '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho", serif' },
  { key: 'yu-gothic',    label: 'Yu Gothic',       sublabel: 'ゴシック体 (sans-serif)', value: '"Hiragino Sans", "Yu Gothic", "Meiryo", "MS PGothic", sans-serif' },
  { key: 'noto-serif-jp',label: 'Noto Serif JP',   sublabel: 'Google Fonts (明朝体)',   value: '"Noto Serif JP", serif',      googleFont: 'Noto+Serif+JP:wght@400;700' },
  { key: 'noto-sans-jp', label: 'Noto Sans JP',    sublabel: 'Google Fonts (ゴシック)', value: '"Noto Sans JP", sans-serif',  googleFont: 'Noto+Sans+JP:wght@400;700' },
];

export default function SuperAdminDataEntrySettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [config, setConfig] = useState<Record<TabKey, boolean>>({
    tab1: true, tab2: true, tab3: true, tab4: true, tab5: true,
    tab6: true, tab7: true, tab8: true, tab9: true,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [translateEnabled, setTranslateEnabled] = useState(true);
  const [translateSaveSuccess, setTranslateSaveSuccess] = useState(false);
  const [translateSaveError, setTranslateSaveError] = useState(false);
  const [fontKey, setFontKey] = useState<FontKey>('ms-mincho');
  const [fontSaveSuccess, setFontSaveSuccess] = useState(false);
  const [fontSaveError, setFontSaveError] = useState(false);
  const [layoutKey, setLayoutKey] = useState<LayoutKey>('layout1');
  const [layoutSaveSuccess, setLayoutSaveSuccess] = useState(false);
  const [layoutSaveError, setLayoutSaveError] = useState(false);
  const [completenessMode, setCompletenessMode] = useState<CompletenessMode>('legacy');
  const [completenessSaveSuccess, setCompletenessSaveSuccess] = useState(false);
  const [completenessSaveError, setCompletenessSaveError] = useState(false);
  const [photoBgEnabled, setPhotoBgEnabled] = useState(false);
  const [photoBgColor, setPhotoBgColor] = useState('#ffffff');
  const [photoBgSaveSuccess, setPhotoBgSaveSuccess] = useState(false);
  const [photoBgSaveError, setPhotoBgSaveError] = useState(false);
  const [journeyVizMode, setJourneyVizMode] = useState<JourneyVizMode>('graphical');
  const [journeyVizSaveSuccess, setJourneyVizSaveSuccess] = useState(false);
  const [journeyVizSaveError, setJourneyVizSaveError] = useState(false);
  const [shokumuEnabled, setShokumuEnabled] = useState(false);
  const [shokumuLayout, setShokumuLayout] = useState<ShokumuLayout>('reverse');
  const [shokumuMergeCv, setShokumuMergeCv] = useState(false);
  const [shokumuRolloutMode, setShokumuRolloutMode] = useState<ShokumuRolloutMode>('all');
  const [shokumuRolloutLpkIds, setShokumuRolloutLpkIds] = useState<string[]>([]);
  const [shokumuSaveSuccess, setShokumuSaveSuccess] = useState(false);
  const [shokumuSaveError, setShokumuSaveError] = useState(false);
  const [serviceTestStatus, setServiceTestStatus] = useState<Record<string, ServiceTestStatus>>({});
  const [serviceTestLatency, setServiceTestLatency] = useState<Record<string, number | null>>({});
  const [serviceTestDetail, setServiceTestDetail] = useState<Record<string, string | null>>({});
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [apiKeySaving, setApiKeySaving] = useState<Record<string, boolean>>({});
  const [apiKeySaved, setApiKeySaved] = useState<Record<string, boolean>>({});
  const [apiKeyError, setApiKeyError] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery<TabConfigResponse>({
    queryKey: ['candidate-tab-config'],
    queryFn: () => api.get('/superadmin/candidate-tab-config').then((r) => r.data),
  });

  const { data: translateData } = useQuery<TranslationConfigResponse>({
    queryKey: ['translation-config'],
    queryFn: () => api.get('/superadmin/translation-config').then((r) => r.data),
  });

  const { data: fontData } = useQuery<{ fontKey: FontKey }>({
    queryKey: ['cv-font'],
    queryFn: () => api.get('/superadmin/cv-font').then((r) => r.data),
  });

  const { data: layoutData } = useQuery<{ layout: LayoutKey }>({
    queryKey: ['cv-layout'],
    queryFn: () => api.get('/superadmin/cv-layout').then((r) => r.data),
  });

  const { data: completenessModeData } = useQuery<{ mode: CompletenessMode }>({
    queryKey: ['completeness-mode'],
    queryFn: () => api.get('/superadmin/completeness-mode').then((r) => r.data),
  });

  const { data: photoBgData } = useQuery<{ color: string; enabled: boolean }>({
    queryKey: ['photo-bg-color'],
    queryFn: () => api.get('/superadmin/photo-bg-color').then((r) => r.data),
  });

  const { data: journeyVizData } = useQuery<{ mode: JourneyVizMode }>({
    queryKey: ['journey-visualization'],
    queryFn: () => api.get('/superadmin/journey-visualization').then((r) => r.data),
  });

  const { data: shokumuConfigData } = useQuery<{ enabled: boolean; layout: ShokumuLayout; mergeCv: boolean; rolloutMode: ShokumuRolloutMode; rolloutLpkIds: string[] }>({
    queryKey: ['shokumu-config'],
    queryFn: () => api.get('/superadmin/shokumu-config').then((r) => r.data),
  });

  const { data: lpkListData } = useQuery<LpkListResponse>({
    queryKey: ['superadmin-lpks'],
    queryFn: () => api.get('/superadmin/lpks').then((r) => r.data),
    staleTime: 120_000,
  });

  const { data: translationStatusData, refetch: refetchStatus } = useQuery<TranslationStatusResponse>({
    queryKey: ['translation-status'],
    queryFn: () => api.get('/superadmin/translation-status').then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: translationApiConfig, refetch: refetchApiConfig } = useQuery<TranslationApiConfig>({
    queryKey: ['translation-api-config'],
    queryFn: () => api.get('/superadmin/translation-api-config').then((r) => r.data),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data?.config) {
      setConfig({ ...data.config } as Record<TabKey, boolean>);
    }
  }, [data]);

  useEffect(() => {
    if (translateData !== undefined) {
      setTranslateEnabled(translateData.enabled !== false);
    }
  }, [translateData]);

  useEffect(() => {
    if (fontData?.fontKey) setFontKey(fontData.fontKey);
  }, [fontData]);

  useEffect(() => {
    if (layoutData?.layout) setLayoutKey(layoutData.layout as LayoutKey);
  }, [layoutData]);

  useEffect(() => {
    if (completenessModeData?.mode) setCompletenessMode(completenessModeData.mode);
  }, [completenessModeData]);

  useEffect(() => {
    if (photoBgData !== undefined) {
      setPhotoBgEnabled(photoBgData.enabled);
      if (photoBgData.color) setPhotoBgColor(photoBgData.color);
    }
  }, [photoBgData]);

  useEffect(() => {
    if (journeyVizData?.mode) setJourneyVizMode(journeyVizData.mode);
  }, [journeyVizData]);

  useEffect(() => {
    if (shokumuConfigData !== undefined) {
      setShokumuEnabled(shokumuConfigData.enabled);
      if (shokumuConfigData.layout) setShokumuLayout(shokumuConfigData.layout);
      setShokumuMergeCv(shokumuConfigData.mergeCv);
      if (shokumuConfigData.rolloutMode) setShokumuRolloutMode(shokumuConfigData.rolloutMode);
      setShokumuRolloutLpkIds(shokumuConfigData.rolloutLpkIds ?? []);
    }
  }, [shokumuConfigData]);

  const saveMutation = useMutation({
    mutationFn: (cfg: Record<TabKey, boolean>) =>
      api.put('/superadmin/candidate-tab-config', cfg).then((r) => r.data),
    onSuccess: () => {
      setSaveSuccess(true);
      setSaveError(false);
      void qc.invalidateQueries({ queryKey: ['candidate-tab-config'] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: () => {
      setSaveError(true);
      setSaveSuccess(false);
    },
  });

  const fontMutation = useMutation({
    mutationFn: (key: FontKey) =>
      api.put('/superadmin/cv-font', { fontKey: key }).then((r) => r.data),
    onSuccess: () => {
      setFontSaveSuccess(true);
      setFontSaveError(false);
      void qc.invalidateQueries({ queryKey: ['cv-font'] });
      setTimeout(() => setFontSaveSuccess(false), 3000);
    },
    onError: () => {
      setFontSaveError(true);
      setFontSaveSuccess(false);
    },
  });

  const layoutMutation = useMutation({
    mutationFn: (key: LayoutKey) =>
      api.put('/superadmin/cv-layout', { layout: key }).then((r) => r.data),
    onSuccess: () => {
      setLayoutSaveSuccess(true);
      setLayoutSaveError(false);
      void qc.invalidateQueries({ queryKey: ['cv-layout'] });
      setTimeout(() => setLayoutSaveSuccess(false), 3000);
    },
    onError: () => {
      setLayoutSaveError(true);
      setLayoutSaveSuccess(false);
    },
  });

  const photoBgMutation = useMutation({
    mutationFn: ({ enabled, color }: { enabled: boolean; color: string }) =>
      api.put('/superadmin/photo-bg-color', { enabled, color }).then((r) => r.data),
    onSuccess: () => {
      setPhotoBgSaveSuccess(true);
      setPhotoBgSaveError(false);
      void qc.invalidateQueries({ queryKey: ['photo-bg-color'] });
      setTimeout(() => setPhotoBgSaveSuccess(false), 3000);
    },
    onError: () => {
      setPhotoBgSaveError(true);
      setPhotoBgSaveSuccess(false);
    },
  });

  const completenessMutation = useMutation({
    mutationFn: (mode: CompletenessMode) =>
      api.put('/superadmin/completeness-mode', { mode }).then((r) => r.data),
    onSuccess: () => {
      setCompletenessSaveSuccess(true);
      setCompletenessSaveError(false);
      void qc.invalidateQueries({ queryKey: ['completeness-mode'] });
      setTimeout(() => setCompletenessSaveSuccess(false), 3000);
    },
    onError: () => {
      setCompletenessSaveError(true);
      setCompletenessSaveSuccess(false);
    },
  });

  const journeyVizMutation = useMutation({
    mutationFn: (mode: JourneyVizMode) =>
      api.put('/superadmin/journey-visualization', { mode }).then((r) => r.data),
    onSuccess: () => {
      setJourneyVizSaveSuccess(true);
      setJourneyVizSaveError(false);
      void qc.invalidateQueries({ queryKey: ['journey-visualization'] });
      setTimeout(() => setJourneyVizSaveSuccess(false), 3000);
    },
    onError: () => {
      setJourneyVizSaveError(true);
      setJourneyVizSaveSuccess(false);
    },
  });

  const shokumuMutation = useMutation({
    mutationFn: ({ enabled, layout, mergeCv, rolloutMode, rolloutLpkIds }: { enabled: boolean; layout: string; mergeCv: boolean; rolloutMode: string; rolloutLpkIds: string[] }) =>
      api.put('/superadmin/shokumu-config', { enabled, layout, mergeCv, rolloutMode, rolloutLpkIds }).then((r) => r.data),
    onSuccess: () => {
      setShokumuSaveSuccess(true);
      setShokumuSaveError(false);
      void qc.invalidateQueries({ queryKey: ['shokumu-config'] });
      setTimeout(() => setShokumuSaveSuccess(false), 3000);
    },
    onError: () => {
      setShokumuSaveError(true);
      setShokumuSaveSuccess(false);
    },
  });

  const translateMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put('/superadmin/translation-config', { enabled }).then((r) => r.data),
    onSuccess: () => {
      setTranslateSaveSuccess(true);
      setTranslateSaveError(false);
      void qc.invalidateQueries({ queryKey: ['translation-config'] });
      setTimeout(() => setTranslateSaveSuccess(false), 3000);
    },
    onError: () => {
      setTranslateSaveError(true);
      setTranslateSaveSuccess(false);
    },
  });

  async function saveApiKey(serviceId: string, skipValidation = false) {
    const key = apiKeyInput[serviceId]?.trim() ?? '';
    if (!key) return;
    setApiKeySaving((p) => ({ ...p, [serviceId]: true }));
    setApiKeySaved((p) => ({ ...p, [serviceId]: false }));
    setApiKeyError((p) => ({ ...p, [serviceId]: false }));
    setServiceTestDetail((p) => ({ ...p, [serviceId]: null }));
    try {
      await api.put('/superadmin/translation-api-config', { apiKey: key, skipValidation });
      setApiKeyInput((p) => ({ ...p, [serviceId]: '' }));
      setApiKeySaved((p) => ({ ...p, [serviceId]: true }));
      void refetchApiConfig();
      void refetchStatus();
      setTimeout(() => setApiKeySaved((p) => ({ ...p, [serviceId]: false })), 3000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? null;
      setApiKeyError((p) => ({ ...p, [serviceId]: true }));
      if (detail) setServiceTestDetail((p) => ({ ...p, [serviceId]: detail }));
    } finally {
      setApiKeySaving((p) => ({ ...p, [serviceId]: false }));
    }
  }

  async function clearApiKey(serviceId: string) {
    setApiKeySaving((p) => ({ ...p, [serviceId]: true }));
    try {
      await api.put('/superadmin/translation-api-config', { apiKey: null });
      void refetchApiConfig();
      void refetchStatus();
    } catch {
      setApiKeyError((p) => ({ ...p, [serviceId]: true }));
    } finally {
      setApiKeySaving((p) => ({ ...p, [serviceId]: false }));
    }
  }

  async function testService(serviceId: string) {
    setServiceTestStatus((prev) => ({ ...prev, [serviceId]: 'testing' }));
    setServiceTestLatency((prev) => ({ ...prev, [serviceId]: null }));
    setServiceTestDetail((prev) => ({ ...prev, [serviceId]: null }));
    try {
      const result = await api.post<{ status: string; latencyMs: number | null; httpStatus?: number; errorDetail?: string | null }>(
        '/superadmin/translation-status/test', { serviceId },
      ).then((r) => r.data);
      setServiceTestStatus((prev) => ({ ...prev, [serviceId]: result.status as ServiceTestStatus }));
      setServiceTestLatency((prev) => ({ ...prev, [serviceId]: result.latencyMs ?? null }));
      if (result.errorDetail) setServiceTestDetail((prev) => ({ ...prev, [serviceId]: `HTTP ${result.httpStatus ?? '?'}: ${result.errorDetail}` }));
    } catch {
      setServiceTestStatus((prev) => ({ ...prev, [serviceId]: 'offline' }));
      setServiceTestDetail((prev) => ({ ...prev, [serviceId]: 'Network error' }));
    }
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.dataEntrySettings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('superadmin.dataEntrySettings.description')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {ALL_TABS.map((tab) => (
          <div key={tab} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-800">
              {t(`candidate.profile.${tab}`)}
            </span>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={tab}
                  value="active"
                  checked={config[tab] !== false}
                  onChange={() => setConfig((prev) => ({ ...prev, [tab]: true }))}
                  className="accent-green-600"
                />
                <span className="text-sm text-gray-700">{t('superadmin.dataEntrySettings.tabActive')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={tab}
                  value="inactive"
                  checked={config[tab] === false}
                  onChange={() => setConfig((prev) => ({ ...prev, [tab]: false }))}
                  className="accent-red-500"
                />
                <span className="text-sm text-gray-700">{t('superadmin.dataEntrySettings.tabInactive')}</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate(config)}
          disabled={saveMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {saveMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {saveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>

      {/* Translation Settings */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.translateTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.translateDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.translateLabel')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('superadmin.dataEntrySettings.translateHint')}</p>
          </div>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="translate_enabled"
                value="active"
                checked={translateEnabled}
                onChange={() => setTranslateEnabled(true)}
                className="accent-green-600"
              />
              <span className="text-sm text-gray-700">{t('superadmin.dataEntrySettings.tabActive')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="translate_enabled"
                value="inactive"
                checked={!translateEnabled}
                onChange={() => setTranslateEnabled(false)}
                className="accent-red-500"
              />
              <span className="text-sm text-gray-700">{t('superadmin.dataEntrySettings.tabInactive')}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => translateMutation.mutate(translateEnabled)}
          disabled={translateMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {translateMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {translateSaveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {translateSaveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>

      {/* Translation Service Status */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.translateServicesTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.translateServicesDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {(translationStatusData?.services ?? []).map((svc) => {
          const testStatus = serviceTestStatus[svc.id] ?? 'idle';
          const latency = serviceTestLatency[svc.id];
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

          const keySource = translationApiConfig?.keySource ?? 'none';
          const keyMasked = translationApiConfig?.keyMasked ?? null;
          const sourceBadge =
            keySource === 'db'  ? <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">{t('superadmin.dataEntrySettings.svcKeyDb')}</span> :
            keySource === 'env' ? <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{t('superadmin.dataEntrySettings.svcKeyEnv')}</span> :
                                  <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">{t('superadmin.dataEntrySettings.svcKeyMissing')}</span>;

          return (
            <div key={svc.id} className="divide-y divide-gray-50">
              {/* Status row */}
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

              {/* API Key config row */}
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
                    onChange={(e) => setApiKeyInput((p) => ({ ...p, [svc.id]: e.target.value }))}
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
        {(translationStatusData?.services ?? []).length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-400">{t('superadmin.dataEntrySettings.svcNone')}</p>
        )}
      </div>

      {/* CV Font Settings */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.cvFontTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.cvFontDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {FONT_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition">
            <div className="flex items-center gap-4">
              <input
                type="radio"
                name="cv_font"
                value={opt.key}
                checked={fontKey === opt.key}
                onChange={() => setFontKey(opt.key)}
                className="accent-navy-700"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.sublabel}</p>
                {opt.googleFont && (
                  <p className="text-[10px] text-amber-500 mt-0.5">※ インターネット接続が必要</p>
                )}
              </div>
            </div>
            <span style={{ fontFamily: opt.value }} className="text-base text-gray-700 select-none">
              日本語のサンプル
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => fontMutation.mutate(fontKey)}
          disabled={fontMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {fontMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {fontSaveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {fontSaveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>

      {/* CV Layout Settings */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.cvLayoutTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.cvLayoutDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {(['layout1', 'layout2'] as LayoutKey[]).map((key) => (
          <label key={key} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition">
            <input
              type="radio"
              name="cv_layout"
              value={key}
              checked={layoutKey === key}
              onChange={() => setLayoutKey(key)}
              className="accent-navy-700"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.${key}Label`)}</p>
              <p className="text-xs text-gray-400">{t(`superadmin.dataEntrySettings.${key}Desc`)}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => layoutMutation.mutate(layoutKey)}
          disabled={layoutMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {layoutMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {layoutSaveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {layoutSaveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>

      {/* Completeness Mode */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.completenessTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.completenessDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {(['legacy', 'cv'] as CompletenessMode[]).map((mode) => (
          <label key={mode} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition">
            <input
              type="radio"
              name="completeness_mode"
              value={mode}
              checked={completenessMode === mode}
              onChange={() => setCompletenessMode(mode)}
              className="accent-navy-700"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.completeness_${mode}Label`)}</p>
              <p className="text-xs text-gray-400">{t(`superadmin.dataEntrySettings.completeness_${mode}Desc`)}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => completenessMutation.mutate(completenessMode)}
          disabled={completenessMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {completenessMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {completenessSaveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {completenessSaveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>

      {/* Photo Background Colour */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.photoBgTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.photoBgDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={photoBgEnabled}
            onChange={(e) => setPhotoBgEnabled(e.target.checked)}
            className="accent-navy-700 w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.photoBgEnable')}</span>
        </label>
        {photoBgEnabled && (
          <div className="flex items-center gap-4 pl-7">
            <label className="text-sm text-gray-700">{t('superadmin.dataEntrySettings.photoBgColorLabel')}</label>
            <input
              type="color"
              value={photoBgColor}
              onChange={(e) => setPhotoBgColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-gray-200"
            />
            <span className="text-sm text-gray-400 font-mono">{photoBgColor.toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => photoBgMutation.mutate({ enabled: photoBgEnabled, color: photoBgColor })}
          disabled={photoBgMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {photoBgMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {photoBgSaveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {photoBgSaveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>

      {/* Journey Visualization Mode */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.journeyVizTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.journeyVizDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {(['text', 'graphical'] as JourneyVizMode[]).map((mode) => (
          <label key={mode} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition">
            <input
              type="radio"
              name="journey_visualization"
              value={mode}
              checked={journeyVizMode === mode}
              onChange={() => setJourneyVizMode(mode)}
              className="accent-navy-700"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.journeyViz_${mode}Label`)}</p>
              <p className="text-xs text-gray-400">{t(`superadmin.dataEntrySettings.journeyViz_${mode}Desc`)}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => journeyVizMutation.mutate(journeyVizMode)}
          disabled={journeyVizMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {journeyVizMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {journeyVizSaveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {journeyVizSaveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>

      {/* Resume / 職務経歴書 Settings */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('superadmin.dataEntrySettings.shokumuTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('superadmin.dataEntrySettings.shokumuDesc')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 space-y-4">
        {/* Enable toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={shokumuEnabled}
            onChange={(e) => setShokumuEnabled(e.target.checked)}
            className="accent-navy-700 w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-800">{t('superadmin.dataEntrySettings.shokumuEnable')}</span>
        </label>

        {/* Font — shared with CV font setting */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('superadmin.dataEntrySettings.shokumuFontLabel')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('superadmin.dataEntrySettings.shokumuFontNote')}</p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-1 font-medium">
            {FONT_OPTIONS.find((o) => o.key === fontKey)?.label ?? fontKey}
          </span>
        </div>

        {/* Layout */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">{t('superadmin.dataEntrySettings.shokumuLayoutTitle')}</p>
          <div className="space-y-2">
            {(['reverse', 'chronological', 'career'] as ShokumuLayout[]).map((mode) => (
              <label key={mode} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="shokumu_layout"
                  value={mode}
                  checked={shokumuLayout === mode}
                  onChange={() => setShokumuLayout(mode)}
                  className="accent-navy-700"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{t(`superadmin.dataEntrySettings.shokumuLayout_${mode}Label`)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Output mode */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">{t('superadmin.dataEntrySettings.shokumuOutputTitle')}</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="shokumu_merge"
                value="separate"
                checked={!shokumuMergeCv}
                onChange={() => setShokumuMergeCv(false)}
                className="accent-navy-700"
              />
              <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.shokumuOutputSeparate')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="shokumu_merge"
                value="merged"
                checked={shokumuMergeCv}
                onChange={() => setShokumuMergeCv(true)}
                className="accent-navy-700"
              />
              <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.shokumuOutputMerged')}</span>
            </label>
          </div>
        </div>

        {/* Rollout / A-B target */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">{t('superadmin.dataEntrySettings.shokumuRolloutTitle')}</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="shokumu_rollout"
                value="all"
                checked={shokumuRolloutMode === 'all'}
                onChange={() => setShokumuRolloutMode('all')}
                className="accent-navy-700"
              />
              <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.shokumuRolloutAll')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="shokumu_rollout"
                value="lpk"
                checked={shokumuRolloutMode === 'lpk'}
                onChange={() => setShokumuRolloutMode('lpk')}
                className="accent-navy-700"
              />
              <span className="text-sm text-gray-800">{t('superadmin.dataEntrySettings.shokumuRolloutLpk')}</span>
            </label>
          </div>

          {shokumuRolloutMode === 'lpk' && (
            <div className="mt-3 ml-7 border border-gray-100 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto space-y-1.5">
              {(lpkListData?.lpks ?? []).length === 0 && (
                <p className="text-xs text-gray-400">No LPKs found.</p>
              )}
              {(lpkListData?.lpks ?? []).map((lpk) => (
                <label key={lpk.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shokumuRolloutLpkIds.includes(lpk.id)}
                    onChange={(e) =>
                      setShokumuRolloutLpkIds((prev) =>
                        e.target.checked ? [...prev, lpk.id] : prev.filter((id) => id !== lpk.id),
                      )
                    }
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

      <div className="flex items-center gap-4">
        <button
          onClick={() => shokumuMutation.mutate({ enabled: shokumuEnabled, layout: shokumuLayout, mergeCv: shokumuMergeCv, rolloutMode: shokumuRolloutMode, rolloutLpkIds: shokumuRolloutLpkIds })}
          disabled={shokumuMutation.isPending}
          className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
        >
          {shokumuMutation.isPending ? '…' : t('superadmin.dataEntrySettings.saveBtn')}
        </button>
        {shokumuSaveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.dataEntrySettings.saved')}</span>
        )}
        {shokumuSaveError && (
          <span className="text-sm text-red-600">{t('superadmin.dataEntrySettings.errorSave')}</span>
        )}
      </div>
    </div>
  );
}
