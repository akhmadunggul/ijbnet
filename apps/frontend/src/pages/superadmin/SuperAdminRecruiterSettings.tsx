import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type ColKey = 'foto' | 'nama' | 'ju' | 'pendidikan' | 'program' | 'bahasaJp' | 'cekFisik' | 'fotoBadan' | 'video' | 'profil' | 'pilih';

const ALL_COLS: ColKey[] = ['foto', 'nama', 'ju', 'pendidikan', 'program', 'bahasaJp', 'cekFisik', 'fotoBadan', 'video', 'profil', 'pilih'];

const DEFAULT_CONFIG: Record<ColKey, boolean> = {
  foto: true, nama: true, ju: true, pendidikan: true, program: true,
  bahasaJp: true, cekFisik: true, fotoBadan: true, video: true, profil: true, pilih: true,
};

interface ColConfigResponse {
  config: Record<ColKey, boolean>;
}

export default function SuperAdminRecruiterSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [config, setConfig] = useState<Record<ColKey, boolean>>(DEFAULT_CONFIG);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const { data, isLoading } = useQuery<ColConfigResponse>({
    queryKey: ['recruiter-selection-columns'],
    queryFn: () => api.get('/superadmin/recruiter-selection-columns').then((r) => r.data),
  });

  useEffect(() => {
    if (data?.config) {
      setConfig({ ...DEFAULT_CONFIG, ...data.config });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (cfg: Record<ColKey, boolean>) =>
      api.put('/superadmin/recruiter-selection-columns', cfg).then((r) => r.data),
    onSuccess: () => {
      setSaveSuccess(true);
      setSaveError(false);
      void qc.invalidateQueries({ queryKey: ['recruiter-selection-columns'] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: () => {
      setSaveError(true);
      setSaveSuccess(false);
    },
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.recruiterSettings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('superadmin.recruiterSettings.description')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {ALL_COLS.map((col) => (
          <div key={col} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-800">
              {t(`superadmin.recruiterSettings.col_${col}`)}
            </span>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={col}
                  value="active"
                  checked={config[col] !== false}
                  onChange={() => setConfig((prev) => ({ ...prev, [col]: true }))}
                  className="accent-green-600"
                />
                <span className="text-sm text-gray-700">{t('superadmin.recruiterSettings.tabActive')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={col}
                  value="inactive"
                  checked={config[col] === false}
                  onChange={() => setConfig((prev) => ({ ...prev, [col]: false }))}
                  className="accent-red-500"
                />
                <span className="text-sm text-gray-700">{t('superadmin.recruiterSettings.tabInactive')}</span>
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
          {saveMutation.isPending ? '…' : t('superadmin.recruiterSettings.saveBtn')}
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600">✓ {t('superadmin.recruiterSettings.saved')}</span>
        )}
        {saveError && (
          <span className="text-sm text-red-600">{t('superadmin.recruiterSettings.errorSave')}</span>
        )}
      </div>
    </div>
  );
}
