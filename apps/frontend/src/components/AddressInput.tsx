import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { composeAddressJa } from '../utils/addressJa';

const BASE_URL = 'https://ihsaninh.github.io/wilayah-indonesia';
const apiCache = new Map<string, unknown[]>();

async function fetchRegionData<T>(url: string): Promise<T[]> {
  if (apiCache.has(url)) return apiCache.get(url) as T[];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: T[] = await res.json();
  apiCache.set(url, data as unknown[]);
  return data;
}

type Province    = { id: number; value: string };
type Regency     = { id: number; value: string; type?: string };
type District    = { id: number; value: string };
type Subdistrict = { id: number; value: string; postal_code?: string };

export interface AddressStructured {
  provinsiId:    string;
  provinsiName:  string;
  kotaId:        string;
  kotaName:      string;
  kecamatanId:   string;
  kecamatanName: string;
  kelurahanId:   string;
  kelurahanName: string;
  jalan:         string;
  rtRw:          string;
  kodePos:       string;
}

interface Props {
  value:    AddressStructured | null;
  onChange: (v: AddressStructured) => void;
  disabled?: boolean;
}

const selCls = 'w-full border border-navy-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-navy-500 disabled:opacity-50 disabled:bg-gray-100';
const inpCls = 'w-full border border-navy-300 rounded px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-navy-500 disabled:opacity-50';

const BLANK: AddressStructured = {
  provinsiId: '', provinsiName: '',
  kotaId: '', kotaName: '',
  kecamatanId: '', kecamatanName: '',
  kelurahanId: '', kelurahanName: '',
  jalan: '', rtRw: '', kodePos: '',
};

export default function AddressInput({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();

  const [provinces,    setProvinces]    = useState<Province[]>([]);
  const [regencies,    setRegencies]    = useState<Regency[]>([]);
  const [districts,    setDistricts]    = useState<District[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);

  const [loadingProv, setLoadingProv] = useState(false);
  const [loadingKota, setLoadingKota] = useState(false);
  const [loadingKec,  setLoadingKec]  = useState(false);
  const [loadingKel,  setLoadingKel]  = useState(false);
  const [fetchError,  setFetchError]  = useState<string | null>(null);

  const provinsiId   = value?.provinsiId   ?? '';
  const kotaId       = value?.kotaId       ?? '';
  const kecamatanId  = value?.kecamatanId  ?? '';

  // Load provinces on mount
  useEffect(() => {
    setLoadingProv(true);
    setFetchError(null);
    fetchRegionData<Province>(`${BASE_URL}/provinces.json`)
      .then(setProvinces)
      .catch(() => setFetchError(t('candidate.profile.personal.addressLoadError')))
      .finally(() => setLoadingProv(false));
  }, []);

  // Auto-resolve provinsiName when provinces load but name is empty (stale data fix)
  useEffect(() => {
    if (provinces.length > 0 && value?.provinsiId && !value.provinsiName) {
      const prov = provinces.find(p => String(p.id) === value.provinsiId);
      if (prov) onChange({ ...(value ?? BLANK), provinsiName: prov.value });
    }
  }, [provinces]);

  // Load regencies when province changes
  useEffect(() => {
    setRegencies([]);
    if (!provinsiId) return;
    setLoadingKota(true);
    fetchRegionData<Regency>(`${BASE_URL}/${provinsiId}/regencies.json`)
      .then(setRegencies)
      .catch(() => setFetchError(t('candidate.profile.personal.addressLoadError')))
      .finally(() => setLoadingKota(false));
  }, [provinsiId]);

  // Load districts when regency changes
  useEffect(() => {
    setDistricts([]);
    if (!provinsiId || !kotaId) return;
    setLoadingKec(true);
    fetchRegionData<District>(`${BASE_URL}/${provinsiId}/${kotaId}/district.json`)
      .then(setDistricts)
      .catch(() => setFetchError(t('candidate.profile.personal.addressLoadError')))
      .finally(() => setLoadingKec(false));
  }, [provinsiId, kotaId]);

  // Load subdistricts when district changes
  useEffect(() => {
    setSubdistricts([]);
    if (!provinsiId || !kotaId || !kecamatanId) return;
    setLoadingKel(true);
    fetchRegionData<Subdistrict>(`${BASE_URL}/${provinsiId}/${kotaId}/${kecamatanId}/subdistrict.json`)
      .then(setSubdistricts)
      .catch(() => setFetchError(t('candidate.profile.personal.addressLoadError')))
      .finally(() => setLoadingKel(false));
  }, [provinsiId, kotaId, kecamatanId]);

  function handleProvinsiChange(id: string) {
    const prov = provinces.find(p => String(p.id) === id);
    onChange({ ...BLANK, provinsiId: id, provinsiName: prov?.value ?? '' });
  }

  function handleKotaChange(id: string) {
    const kota = regencies.find(r => String(r.id) === id);
    onChange({
      ...(value ?? BLANK),
      kotaId: id, kotaName: kota?.value ?? '',
      kecamatanId: '', kecamatanName: '',
      kelurahanId: '', kelurahanName: '',
      kodePos: '',
    });
  }

  function handleKecamatanChange(id: string) {
    const kec = districts.find(d => String(d.id) === id);
    onChange({
      ...(value ?? BLANK),
      kecamatanId: id, kecamatanName: kec?.value ?? '',
      kelurahanId: '', kelurahanName: '',
      kodePos: '',
    });
  }

  function handleKelurahanChange(id: string) {
    const kel = subdistricts.find(s => String(s.id) === id);
    onChange({
      ...(value ?? BLANK),
      kelurahanId: id,
      kelurahanName: kel?.value ?? '',
      kodePos: kel?.postal_code ?? '',
    });
  }

  const previewParts = [
    value?.jalan,
    value?.rtRw,
    value?.kelurahanName ? `Kel. ${value.kelurahanName}` : '',
    value?.kecamatanName ? `Kec. ${value.kecamatanName}` : '',
    value?.kotaName,
    value?.provinsiName,
    value?.kodePos,
  ].map(p => (p ?? '').trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      {fetchError && (
        <p className="text-xs text-red-500 bg-red-50 rounded p-2">{fetchError}</p>
      )}

      {/* Provinsi */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('candidate.profile.personal.addressProvinsi')} *
        </label>
        <select
          value={provinsiId}
          onChange={e => handleProvinsiChange(e.target.value)}
          disabled={disabled || loadingProv}
          className={selCls}
        >
          <option value="">{loadingProv ? '…' : `— ${t('candidate.profile.personal.addressSelectProv')} —`}</option>
          {provinces.map(p => (
            <option key={p.id} value={String(p.id)}>{p.value}</option>
          ))}
        </select>
      </div>

      {/* Kota / Kabupaten */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('candidate.profile.personal.addressKota')} *
        </label>
        <select
          value={kotaId}
          onChange={e => handleKotaChange(e.target.value)}
          disabled={disabled || loadingKota || !provinsiId}
          className={selCls}
        >
          <option value="">{loadingKota ? '…' : `— ${t('candidate.profile.personal.addressSelectKota')} —`}</option>
          {regencies.map(r => (
            <option key={r.id} value={String(r.id)}>{r.value}</option>
          ))}
        </select>
      </div>

      {/* Kecamatan */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('candidate.profile.personal.addressKecamatan')} *
        </label>
        <select
          value={kecamatanId}
          onChange={e => handleKecamatanChange(e.target.value)}
          disabled={disabled || loadingKec || !kotaId}
          className={selCls}
        >
          <option value="">{loadingKec ? '…' : `— ${t('candidate.profile.personal.addressSelectKec')} —`}</option>
          {districts.map(d => (
            <option key={d.id} value={String(d.id)}>{d.value}</option>
          ))}
        </select>
      </div>

      {/* Kelurahan / Desa */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('candidate.profile.personal.addressKelurahan')} *
        </label>
        <select
          value={value?.kelurahanId ?? ''}
          onChange={e => handleKelurahanChange(e.target.value)}
          disabled={disabled || loadingKel || !kecamatanId}
          className={selCls}
        >
          <option value="">{loadingKel ? '…' : `— ${t('candidate.profile.personal.addressSelectKel')} —`}</option>
          {subdistricts.map(s => (
            <option key={s.id} value={String(s.id)}>{s.value}</option>
          ))}
        </select>
      </div>

      {/* Jalan */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('candidate.profile.personal.addressJalan')} *
        </label>
        <input
          type="text"
          value={value?.jalan ?? ''}
          onChange={e => onChange({ ...(value ?? BLANK), jalan: e.target.value })}
          disabled={disabled}
          className={inpCls}
          placeholder="JL. MERDEKA NO. 45"
        />
      </div>

      {/* RT / RW */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('candidate.profile.personal.addressRtRw')}
        </label>
        <input
          type="text"
          value={value?.rtRw ?? ''}
          onChange={e => onChange({ ...(value ?? BLANK), rtRw: e.target.value })}
          disabled={disabled}
          className={inpCls}
          placeholder="RT 001/RW 002"
        />
      </div>

      {/* Kode Pos */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('candidate.profile.personal.addressKodePos')}
        </label>
        <input
          type="text"
          value={value?.kodePos ?? ''}
          onChange={e => onChange({ ...(value ?? BLANK), kodePos: e.target.value })}
          disabled={disabled}
          className={inpCls}
          placeholder="12345"
          maxLength={10}
        />
      </div>

      {/* Indonesian preview */}
      {previewParts.length > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 border border-gray-200">
          <span className="font-medium">{t('candidate.profile.personal.addressPreview')}</span>{' '}
          {previewParts.join(', ').toUpperCase()}
        </div>
      )}

      {/* Japanese address preview */}
      {value && composeAddressJa(value) && (
        <div className="text-xs text-gray-600 bg-blue-50 rounded p-2 border border-blue-100">
          <span className="font-medium text-blue-700">🇯🇵 日本語住所：</span>{' '}
          <span>{composeAddressJa(value)}</span>
        </div>
      )}
    </div>
  );
}
