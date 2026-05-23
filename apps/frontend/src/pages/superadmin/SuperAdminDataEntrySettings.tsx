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

type FontKey = 'ms-mincho' | 'yu-mincho' | 'yu-gothic' | 'noto-serif-jp' | 'noto-sans-jp';
type LayoutKey = 'layout1' | 'layout2';

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
    </div>
  );
}
