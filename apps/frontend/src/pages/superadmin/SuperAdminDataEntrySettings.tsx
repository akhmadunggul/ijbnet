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

  const { data, isLoading } = useQuery<TabConfigResponse>({
    queryKey: ['candidate-tab-config'],
    queryFn: () => api.get('/superadmin/candidate-tab-config').then((r) => r.data),
  });

  const { data: translateData } = useQuery<TranslationConfigResponse>({
    queryKey: ['translation-config'],
    queryFn: () => api.get('/superadmin/translation-config').then((r) => r.data),
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
    </div>
  );
}
