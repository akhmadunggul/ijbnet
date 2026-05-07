import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import AuthImage from '../../components/AuthImage';
import type { CandidateMe, CandidateData, CareerEntry, JapaneseTest, CertificationEntry, EducationHistoryEntry } from '../../types/candidate';

// ── Zod schemas ───────────────────────────────────────────────────────────────
const personalSchema = z.object({
  fullName:            z.string().min(1),
  nameKatakana:        z.string().nullable().optional(),
  gender:              z.enum(['M', 'F']).nullable().optional(),
  dateOfBirth:         z.string().nullable().optional(),
  birthPlace:          z.string().nullable().optional(),
  nik:                 z.string().refine((v) => v === '' || /^\d{16}$/.test(v), { message: 'NIK harus 16 digit angka' }).optional(),
  heightCm:            z.coerce.number().nullable().optional(),
  weightKg:            z.coerce.number().nullable().optional(),
  selfReportedHeight:  z.coerce.number().nullable().optional(),
  selfReportedWeight:  z.coerce.number().nullable().optional(),
  bloodType:           z.enum(['A','B','AB','O','A+','B+','AB+','O+','Unknown']).nullable().optional(),
  religion:            z.enum(['Islam','Kristen','Katolik','Budha','Hindu','Lainnya']).nullable().optional(),
  hasVisitedJapan:     z.boolean().nullable().optional(),
  hasPassport:         z.boolean().nullable().optional(),
  hobbies:             z.string().nullable().optional(),
  email:               z.string().email().nullable().optional().or(z.literal('')),
  phone:               z.string().nullable().optional(),
  address:             z.string().nullable().optional(),
  lpkId:               z.string().nullable().optional(),
});

const sswSchema = z.object({
  jobCategory:    z.string().nullable().optional(),
  sswKubun:       z.enum(['SSW1', 'SSW2']).nullable().optional(),
  sswSectorId:    z.string().nullable().optional(),
  sswFieldId:     z.string().nullable().optional(),
  sswSectorJa:    z.string().nullable().optional(),
  sswFieldJa:     z.string().nullable().optional(),
  jpStudyDuration:z.string().nullable().optional(),
});

const educationSchema = z.object({
  eduLevel: z.string().nullable().optional(),
  eduLabel: z.string().nullable().optional(),
  eduMajor: z.string().nullable().optional(),
});

const educationHistorySchema = z.object({
  entries: z.array(z.object({
    id:         z.string().optional(),
    schoolName: z.string().min(1),
    major:      z.string().nullable().optional(),
    startDate:  z.string().nullable().optional(),
    endDate:    z.string().nullable().optional(),
    sortOrder:  z.number().optional(),
  })),
});

const careerSchema = z.object({
  entries: z.array(z.object({
    id:          z.string().optional(),
    companyName: z.string().nullable().optional(),
    division:    z.string().nullable().optional(),
    skillGroup:  z.string().nullable().optional(),
    period:      z.string().nullable().optional(),
    sortOrder:   z.number().optional(),
  })),
});

const testSchema = z.object({
  entries: z.array(z.object({
    id:       z.string().optional(),
    testName: z.string().nullable().optional(),
    score:    z.coerce.number().nullable().optional(),
    pass:     z.boolean().nullable().optional(),
    testDate: z.string().nullable().optional(),
  })),
});

const workplanSchema = z.object({
  workplanDuration:    z.string().nullable().optional(),
  workplanGoal:        z.string().nullable().optional(),
  workplanAfter:       z.string().nullable().optional(),
  workplanExpectation: z.string().nullable().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).nullable().optional(),
  spouseInfo:    z.string().nullable().optional(),
  childrenCount: z.coerce.number().int().min(0).optional(),
  accompany:     z.enum(['none', 'yes']).optional(),
});

const certificationSchema = z.object({
  entries: z.array(z.object({
    id:          z.string().optional(),
    certName:    z.string().min(1),
    certLevel:   z.string().nullable().optional(),
    issuedDate:  z.string().nullable().optional(),
    issuedBy:    z.string().nullable().optional(),
  })),
});

const prMotivationSchema = z.object({
  selfPrId:       z.string().max(300).nullable().optional(),
  selfPrJa:       z.string().max(150).nullable().optional(),
  motivationId:   z.string().max(300).nullable().optional(),
  motivationJa:   z.string().max(150).nullable().optional(),
  applyReasonId:  z.string().max(300).nullable().optional(),
  applyReasonJa:  z.string().max(150).nullable().optional(),
  selfIntroId:    z.string().max(200).nullable().optional(),
  selfIntroJa:    z.string().max(100).nullable().optional(),
});

type PersonalForm          = z.infer<typeof personalSchema>;
type SswForm               = z.infer<typeof sswSchema>;
type EducationForm         = z.infer<typeof educationSchema>;
type EducationHistoryForm  = z.infer<typeof educationHistorySchema>;
type CareerForm            = z.infer<typeof careerSchema>;
type TestForm              = z.infer<typeof testSchema>;
type WorkplanForm          = z.infer<typeof workplanSchema>;
type CertificationForm     = z.infer<typeof certificationSchema>;
type PrMotivationForm      = z.infer<typeof prMotivationSchema>;

// ── Shared field wrapper ──────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500';
const selectCls = inputCls;
const textareaCls = `${inputCls} resize-y`;

// ── Photo upload zone ─────────────────────────────────────────────────────────
function PhotoZone({
  slot,
  label,
  spec,
  currentUrl,
  onUploaded,
  isLocked,
}: {
  slot: 'closeup' | 'fullbody';
  label: string;
  spec: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  isLocked: boolean;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) { setError(t('candidate.photo.errorSize')); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { setError(t('candidate.photo.errorType')); return; }

    setError('');
    setLocalPreview(URL.createObjectURL(file));
    setUploading(true);
    setProgress(0);

    const fd = new FormData();
    fd.append('photo', file);
    try {
      const res = await api.post<{ url: string }>(`/candidates/me/photos/${slot}`, fd, {
        onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); },
      });
      onUploaded(res.data.url);
    } catch (err: unknown) {
      const errorCode = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (errorCode === 'PROFILE_LOCKED') {
        setError(t('candidate.profile.locked'));
      } else {
        setError(t('toastError'));
      }
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const aspectClass = slot === 'closeup' ? 'aspect-square' : 'aspect-[9/16]';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div
        className={`relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden transition ${aspectClass} max-h-72 flex items-center justify-center bg-gray-50 ${!isLocked ? 'cursor-pointer hover:border-navy-400' : 'cursor-default'}`}
        onDragOver={!isLocked ? (e) => e.preventDefault() : undefined}
        onDrop={!isLocked ? onDrop : undefined}
        onClick={!isLocked ? () => inputRef.current?.click() : undefined}
      >
        {(localPreview ?? currentUrl) ? (
          localPreview
            ? <img src={localPreview} alt="preview" className="w-full h-full object-cover" />
            : <AuthImage src={currentUrl} alt="current" className="w-full h-full object-cover" fallback={<span className="text-xs text-gray-400">{t('loading')}</span>} />
        ) : (
          <div className="text-center p-4">
            <p className="text-2xl mb-2">📷</p>
            {!isLocked && <p className="text-xs text-gray-400">{t('candidate.photo.dropzone')}</p>}
            <p className="text-xs text-gray-300 mt-1">{spec}</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 p-2">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-navy-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] text-gray-500 mt-1 text-center">{t('candidate.photo.uploading')} {progress}%</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {isLocked
        ? <p className="text-sm text-amber-600 mt-2">{t('candidate.profile.locked')}</p>
        : <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      }
    </div>
  );
}

// ── Tab 1 — Personal ──────────────────────────────────────────────────────────
const BLOOD_TYPES = ['A','B','AB','O','A+','B+','AB+','O+','Unknown'] as const;
const RELIGIONS   = ['Islam','Kristen','Katolik','Budha','Hindu','Lainnya'] as const;

function PersonalTab({ candidate, onSave, saving }: { candidate: CandidateData; onSave: (d: PersonalForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: lpksData } = useQuery<{ lpks: { id: string; name: string; city: string | null }[] }>({
    queryKey: ['candidate-lpks'],
    queryFn: () => api.get('/candidates/lpks').then((r) => r.data),
    staleTime: 300_000,
  });

  const nikMutation = useMutation({
    mutationFn: (nik: string) => api.patch('/candidates/me/nik', { nik }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-candidate'] }),
  });

  const { register, handleSubmit, reset, formState: { isDirty, errors } } = useForm<PersonalForm>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      fullName:           candidate.fullName ?? '',
      nameKatakana:       candidate.nameKatakana ?? '',
      gender:             candidate.gender ?? undefined,
      dateOfBirth:        candidate.dateOfBirth ? candidate.dateOfBirth.slice(0, 10) : '',
      birthPlace:         candidate.birthPlace ?? '',
      nik:                candidate.nik ?? '',
      heightCm:           candidate.heightCm ?? undefined,
      weightKg:           candidate.weightKg ?? undefined,
      selfReportedHeight: candidate.selfReportedHeight ?? undefined,
      selfReportedWeight: candidate.selfReportedWeight ?? undefined,
      bloodType:          candidate.bloodType ?? undefined,
      religion:           candidate.religion ?? undefined,
      hasVisitedJapan:    candidate.hasVisitedJapan ?? false,
      hasPassport:        candidate.hasPassport ?? false,
      hobbies:            candidate.hobbies ?? '',
      email:              candidate.email ?? '',
      phone:              candidate.phone ?? '',
      address:            candidate.address ?? '',
      lpkId:              candidate.lpkId ?? '',
    },
  });

  async function handlePersonalSubmit(data: PersonalForm) {
    await onSave(data);
    reset(data);
    if (data.nik && data.nik.trim().length === 16) {
      nikMutation.mutate(data.nik.trim());
    }
  }

  const lpkLocked = !!candidate.lpkId;

  return (
    <form onSubmit={handleSubmit(handlePersonalSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('candidate.profile.personal.fullName') + ' *'}>
          <input {...register('fullName')} className={inputCls} />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{t('errorRequired')}</p>}
        </Field>
        <Field label={t('candidate.profile.personal.nameKatakana')}>
          <input {...register('nameKatakana')} className={inputCls} placeholder="例: ヤマダ タロウ" />
        </Field>
      </div>
      <Field label={t('candidate.profile.personal.gender')}>
        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="M" {...register('gender')} /> {t('candidate.profile.personal.genderM')} / 男性</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="F" {...register('gender')} /> {t('candidate.profile.personal.genderF')} / 女性</label>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('candidate.profile.personal.dob')}><input type="date" {...register('dateOfBirth')} className={inputCls} /></Field>
        <Field label={t('candidate.profile.personal.birthPlace')}><input {...register('birthPlace')} className={inputCls} placeholder="Kota / 市区町村" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('dpNik')}>
          <input {...register('nik')} className={inputCls} placeholder="16 digit NIK" maxLength={16} inputMode="numeric" />
          {errors.nik && <p className="text-xs text-red-500 mt-1">{errors.nik.message}</p>}
        </Field>
        <Field label={t('candidate.profile.personal.bloodType')}>
          <select {...register('bloodType')} className={selectCls}>
            <option value="">— Pilih —</option>
            {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('candidate.profile.personal.religion')}>
          <select {...register('religion')} className={selectCls}>
            <option value="">— Pilih —</option>
            {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('candidate.profile.personal.height') + ' (cm)'}><input type="number" step="0.1" {...register('heightCm')} className={inputCls} /></Field>
        <Field label={t('candidate.profile.personal.weight') + ' (kg)'}><input type="number" step="0.1" {...register('weightKg')} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('candidate.profile.personal.selfReportedHeight')}><input type="number" step="0.1" {...register('selfReportedHeight')} className={inputCls} /></Field>
        <Field label={t('candidate.profile.personal.selfReportedWeight')}><input type="number" step="0.1" {...register('selfReportedWeight')} className={inputCls} /></Field>
      </div>
      <div className="flex gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('hasVisitedJapan')} className="h-4 w-4 accent-navy-700" />
          {t('candidate.profile.personal.hasVisitedJapan')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('hasPassport')} className="h-4 w-4 accent-navy-700" />
          {t('candidate.profile.personal.hasPassport')}
        </label>
      </div>
      <Field label={t('candidate.profile.personal.hobbies')}><input {...register('hobbies')} className={inputCls} /></Field>
      <Field label={t('candidate.profile.personal.email')}><input type="email" {...register('email')} className={inputCls} /></Field>
      <Field label={t('candidate.profile.personal.phone')}><input {...register('phone')} className={inputCls} /></Field>
      <Field label={t('candidate.profile.personal.address')}><textarea {...register('address')} rows={3} className={inputCls} /></Field>
      <Field label={t('candidate.profile.personal.lpk') + ' *'}>
        <select
          {...register('lpkId')}
          disabled={lpkLocked}
          className={`${selectCls} ${lpkLocked ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
        >
          <option value="">{t('candidate.profile.personal.lpkPlaceholder')}</option>
          {(lpksData?.lpks ?? []).map((lpk) => (
            <option key={lpk.id} value={lpk.id}>
              {lpk.name}{lpk.city ? ` — ${lpk.city}` : ''}
            </option>
          ))}
        </select>
        {lpkLocked && (
          <p className="text-xs text-gray-400 mt-1">{t('colLpk')} — {t('candidate.profile.locked').split('.')[0]}.</p>
        )}
      </Field>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
          {saving ? t('candidate.profile.saving') : t('candidate.profile.save')}
        </button>
        {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
      </div>
    </form>
  );
}

// ── Tab 2 — SSW ───────────────────────────────────────────────────────────────
interface SswOption { id: string; kubun: 'SSW1' | 'SSW2'; sectorId: string; sectorJa: string; fieldId: string; fieldJa: string; }

function SswTab({ candidate, onSave, saving }: { candidate: CandidateData; onSave: (d: SswForm) => void; saving: boolean }) {
  const { t } = useTranslation();

  const { data: sswOptions = [] } = useQuery<SswOption[]>({
    queryKey: ['ssw-options'],
    queryFn: () => api.get('/candidates/ssw-options').then((r) => r.data),
    staleTime: Infinity,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty } } = useForm<SswForm>({
    resolver: zodResolver(sswSchema),
    defaultValues: {
      jobCategory:     candidate.jobCategory ?? '',
      sswKubun:        candidate.sswKubun ?? undefined,
      sswSectorId:     candidate.sswSectorId ?? '',
      sswFieldId:      candidate.sswFieldId ?? '',
      sswSectorJa:     candidate.sswSectorJa ?? '',
      sswFieldJa:      candidate.sswFieldJa ?? '',
      jpStudyDuration: candidate.jpStudyDuration ?? '',
    },
  });

  const kubun     = watch('sswKubun');
  const sectorId  = watch('sswSectorId');
  const sectorJa  = watch('sswSectorJa');
  const fieldJa   = watch('sswFieldJa');

  const sectors = useMemo(() => {
    const seen = new Set<string>();
    return sswOptions.filter((o) => o.kubun === kubun && !seen.has(o.sectorId) && seen.add(o.sectorId));
  }, [sswOptions, kubun]);

  const fields = useMemo(
    () => sswOptions.filter((o) => o.kubun === kubun && o.sectorId === sectorId),
    [sswOptions, kubun, sectorId],
  );

  const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const match = sswOptions.find((o) => o.kubun === kubun && o.sectorId === val);
    setValue('sswSectorId', val,              { shouldDirty: true });
    setValue('sswSectorJa', match?.sectorJa ?? '', { shouldDirty: true });
    setValue('sswFieldId',  '',               { shouldDirty: true });
    setValue('sswFieldJa',  '',               { shouldDirty: true });
    setValue('jobCategory', '',               { shouldDirty: true });
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const match = sswOptions.find((o) => o.kubun === kubun && o.sectorId === sectorId && o.fieldId === val);
    setValue('sswFieldId',  val,              { shouldDirty: true });
    setValue('sswFieldJa',  match?.fieldJa ?? '', { shouldDirty: true });
    setValue('jobCategory', val,              { shouldDirty: true });
  };

  return (
    <form onSubmit={handleSubmit(async (d) => { await onSave(d); reset(d); })} className="space-y-4">
      {/* Kubun */}
      <Field label={t('sswTitle') + ' — ' + t('candidate.profile.ssw.kubun')}>
        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="SSW1" {...register('sswKubun')} /> SSW1</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="SSW2" {...register('sswKubun')} /> SSW2</label>
        </div>
      </Field>

      {/* Sector dropdown */}
      <Field label={t('candidate.profile.ssw.sectorId')}>
        <select
          value={sectorId ?? ''}
          onChange={handleSectorChange}
          disabled={!kubun}
          className={inputCls}
        >
          <option value="">— {t('candidate.profile.ssw.selectSector')} —</option>
          {sectors.map((s) => (
            <option key={s.sectorId} value={s.sectorId}>{s.sectorId}</option>
          ))}
        </select>
        {sectorJa && <p className="text-xs text-gray-400 mt-1">{sectorJa}</p>}
      </Field>

      {/* Field dropdown */}
      <Field label={t('candidate.profile.ssw.fieldId')}>
        <select
          value={watch('sswFieldId') ?? ''}
          onChange={handleFieldChange}
          disabled={!sectorId}
          className={inputCls}
        >
          <option value="">— {t('candidate.profile.ssw.selectField')} —</option>
          {fields.map((f) => (
            <option key={f.fieldId} value={f.fieldId}>{f.fieldId}</option>
          ))}
        </select>
        {fieldJa && <p className="text-xs text-gray-400 mt-1">{fieldJa}</p>}
      </Field>

      {/* Hidden inputs to carry Ja values and jobCategory into form data */}
      <input type="hidden" {...register('sswSectorJa')} />
      <input type="hidden" {...register('sswFieldJa')} />
      <input type="hidden" {...register('jobCategory')} />

      {/* Study duration */}
      <Field label={t('candidate.profile.ssw.jpStudy')}>
        <input {...register('jpStudyDuration')} className={inputCls} placeholder="18 bulan" />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
          {saving ? t('candidate.profile.saving') : t('candidate.profile.save')}
        </button>
        {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
      </div>
    </form>
  );
}

// ── Tab 3 — Education ─────────────────────────────────────────────────────────
const EDU_LEVELS = ['SD','SMP','SMA','SMK','D1','D2','D3','D4','S1','S2','S3'];

function EducationTab({ candidate, onSave, saving }: { candidate: CandidateData; onSave: (d: EducationForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { register: reg, handleSubmit, reset, formState: { isDirty } } = useForm<EducationForm>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      eduLevel: candidate.eduLevel ?? '',
      eduLabel: candidate.eduLabel ?? '',
      eduMajor: candidate.eduMajor ?? '',
    },
  });

  const historyForm = useForm<EducationHistoryForm>({
    defaultValues: {
      entries: (candidate.educationHistory ?? []).map((e, i) => ({
        ...e,
        startDate: e.startDate ? e.startDate.slice(0, 10) : '',
        endDate: e.endDate ? e.endDate.slice(0, 10) : '',
        sortOrder: e.sortOrder ?? i,
      })),
    },
  });
  const { fields, append, remove, move } = useFieldArray({ control: historyForm.control, name: 'entries' });

  const historyMutation = useMutation({
    mutationFn: (data: EducationHistoryForm) =>
      api.put('/candidates/me/education-history', data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['my-candidate'] });
      historyForm.reset(variables);
    },
  });

  return (
    <div className="space-y-8">
      {/* Highest education level */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-4">{t('candidate.profile.education.level')}</p>
        <form onSubmit={handleSubmit(async (d) => { await onSave(d); reset(d); })} className="space-y-4">
          <Field label={t('candidate.profile.education.level')}>
            <select {...reg('eduLevel')} className={selectCls}>
              <option value="">— Pilih —</option>
              {EDU_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label={t('candidate.profile.education.label')}><input {...reg('eduLabel')} className={inputCls} placeholder="e.g. SMK Negeri 1 Jakarta" /></Field>
          <Field label={t('candidate.profile.education.major')}><input {...reg('eduMajor')} className={inputCls} /></Field>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
              {saving ? t('candidate.profile.saving') : t('candidate.profile.save')}
            </button>
            {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
          </div>
        </form>
      </div>

      <hr className="border-gray-100" />

      {/* Full education history */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-4">{t('candidate.profile.education.historyTitle')}</p>
        <form onSubmit={historyForm.handleSubmit((d) => historyMutation.mutate(d))} className="space-y-4">
          {fields.map((field, i) => (
            <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">#{i + 1}</p>
                <div className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className="text-xs px-2 py-1 border rounded hover:bg-white disabled:opacity-30">▲</button>
                  <button type="button" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} className="text-xs px-2 py-1 border rounded hover:bg-white disabled:opacity-30">▼</button>
                  <button type="button" onClick={() => remove(i)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50">✕</button>
                </div>
              </div>
              <Field label={t('candidate.profile.education.schoolName')}>
                <input {...historyForm.register(`entries.${i}.schoolName`)} className={inputCls} />
              </Field>
              <Field label={t('candidate.profile.education.major')}>
                <input {...historyForm.register(`entries.${i}.major`)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('candidate.profile.education.startDate')}><input type="date" {...historyForm.register(`entries.${i}.startDate`)} className={inputCls} /></Field>
                <Field label={t('candidate.profile.education.endDate')}><input type="date" {...historyForm.register(`entries.${i}.endDate`)} className={inputCls} /></Field>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ schoolName: '', major: '', startDate: '', endDate: '', sortOrder: fields.length })}
            className="text-sm text-navy-600 hover:underline"
          >
            + {t('candidate.profile.education.addEntry')}
          </button>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={historyMutation.isPending} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
              {historyMutation.isPending ? t('candidate.profile.saving') : t('candidate.profile.save')}
            </button>
            {historyForm.formState.isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 4 — Career ────────────────────────────────────────────────────────────
function CareerTab({ candidate, saving }: { candidate: CandidateData; saving: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { control, register, handleSubmit, reset, formState: { isDirty } } = useForm<CareerForm>({
    defaultValues: {
      entries: (candidate.career ?? []).map((c, i) => ({ ...c, sortOrder: c.sortOrder ?? i })),
    },
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'entries' });

  const careerMutation = useMutation({
    mutationFn: (data: CareerForm) => api.put('/candidates/me/career', data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['my-candidate'] });
      reset(variables);
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => careerMutation.mutate(d))} className="space-y-4">
      {fields.map((field, i) => (
        <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Entry #{i + 1}</p>
            <div className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className="text-xs px-2 py-1 border rounded hover:bg-white disabled:opacity-30">▲</button>
              <button type="button" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} className="text-xs px-2 py-1 border rounded hover:bg-white disabled:opacity-30">▼</button>
              <button type="button" onClick={() => remove(i)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50">✕</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('candidate.profile.career.company')}><input {...register(`entries.${i}.companyName`)} className={inputCls} /></Field>
            <Field label={t('candidate.profile.career.division')}><input {...register(`entries.${i}.division`)} className={inputCls} /></Field>
            <Field label={t('candidate.profile.career.skillGroup')}><input {...register(`entries.${i}.skillGroup`)} className={inputCls} /></Field>
            <Field label={t('candidate.profile.career.period')}><input {...register(`entries.${i}.period`)} className={inputCls} placeholder="Jan 2022 – Mar 2024" /></Field>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => append({ companyName: '', division: '', skillGroup: '', period: '', sortOrder: fields.length })} className="text-sm text-navy-600 hover:underline">
        + {t('candidate.profile.career.addEntry')}
      </button>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={careerMutation.isPending} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
          {careerMutation.isPending ? t('candidate.profile.saving') : t('candidate.profile.save')}
        </button>
        {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
      </div>
    </form>
  );
}

// ── Tab 5 — Japanese ──────────────────────────────────────────────────────────
const JLPT_TESTS = ['JLPT N5','JLPT N4','JLPT N3','JLPT N2','JLPT N1','JFT-Basic','BJT J1','BJT J2'];

function JapaneseTab({ candidate }: { candidate: CandidateData }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { control, register, handleSubmit, reset, formState: { isDirty } } = useForm<TestForm>({
    defaultValues: {
      entries: (candidate.tests ?? []).map((tst) => ({ ...tst, testDate: tst.testDate ? tst.testDate.slice(0, 10) : '' })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });

  const testsMutation = useMutation({
    mutationFn: (data: TestForm) => api.put('/candidates/me/tests', data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['my-candidate'] });
      reset(variables);
    },
  });

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit((d) => testsMutation.mutate(d))} className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Test Bahasa Jepang / 日本語テスト</p>
        {fields.map((field, i) => (
          <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between">
              <p className="text-xs font-medium text-gray-500">Test #{i + 1}</p>
              <button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:underline">{t('btnDelete')}</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('candidate.profile.japanese.testName')}>
                <select {...register(`entries.${i}.testName`)} className={selectCls}>
                  <option value="">— Pilih —</option>
                  {JLPT_TESTS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label={t('candidate.profile.japanese.score')}><input type="number" {...register(`entries.${i}.score`)} className={inputCls} /></Field>
              <Field label={t('candidate.profile.japanese.testDate')}><input type="date" {...register(`entries.${i}.testDate`)} className={inputCls} /></Field>
              <Field label={t('candidate.profile.japanese.pass')}>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" {...register(`entries.${i}.pass`)} className="h-4 w-4 accent-navy-700" />
                  <span className="text-sm text-gray-600">Lulus / 合格</span>
                </div>
              </Field>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => append({ testName: '', score: undefined, pass: false, testDate: '' })} className="text-sm text-navy-600 hover:underline">
          + {t('candidate.profile.japanese.addTest')}
        </button>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={testsMutation.isPending} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
            {testsMutation.isPending ? t('candidate.profile.saving') : t('candidate.profile.save')}
          </button>
          {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
        </div>
      </form>

      {/* Weekly tests — read-only */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">{t('candidate.profile.japanese.weeklyTests')} (read-only)</p>
        {(candidate.weeklyTests ?? []).length === 0 ? (
          <p className="text-xs text-gray-400">{t('noData')}</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-left text-xs text-gray-500 border-b">{[t('candidate.profile.japanese.course'), t('candidate.profile.japanese.week'), t('candidate.profile.japanese.score'), 'Date'].map((h) => <th key={h} className="pb-2 pr-4">{h}</th>)}</tr></thead>
            <tbody>
              {candidate.weeklyTests.map((wt) => (
                <tr key={wt.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-700">{wt.courseName ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">{wt.weekNumber ?? '—'}</td>
                  <td className="py-2 pr-4 font-medium text-navy-700">{wt.score ?? '—'}</td>
                  <td className="py-2 text-gray-400 text-xs">{wt.testDate ? wt.testDate.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Tab 6 — Work Plan ─────────────────────────────────────────────────────────
function WorkplanTab({ candidate, onSave, saving }: { candidate: CandidateData; onSave: (d: WorkplanForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const { register, watch, handleSubmit, reset, formState: { isDirty } } = useForm<WorkplanForm>({
    resolver: zodResolver(workplanSchema),
    defaultValues: {
      workplanDuration:    candidate.workplanDuration ?? '',
      workplanGoal:        candidate.workplanGoal ?? '',
      workplanAfter:       candidate.workplanAfter ?? '',
      workplanExpectation: candidate.workplanExpectation ?? '',
      maritalStatus: candidate.maritalStatus ?? undefined,
      spouseInfo:    candidate.spouseInfo ?? '',
      childrenCount: candidate.childrenCount ?? 0,
      accompany:     candidate.accompany ?? 'none',
    },
  });
  const marital = watch('maritalStatus');

  return (
    <form onSubmit={handleSubmit(async (d) => { await onSave(d); reset(d); })} className="space-y-4">
      <Field label={t('candidate.profile.workplan.duration')}><input {...register('workplanDuration')} className={inputCls} placeholder="3 tahun" /></Field>
      <Field label={t('candidate.profile.workplan.goal')}><textarea {...register('workplanGoal')} rows={3} className={textareaCls} /></Field>
      <Field label={t('candidate.profile.workplan.after')}><textarea {...register('workplanAfter')} rows={3} className={textareaCls} /></Field>
      <Field label={t('candidate.profile.workplan.expectation')}><textarea {...register('workplanExpectation')} rows={3} className={textareaCls} /></Field>
      <Field label={t('candidate.profile.workplan.marital')}>
        <select {...register('maritalStatus')} className={selectCls}>
          <option value="">—</option>
          <option value="single">{t('candidate.profile.workplan.maritalSingle')}</option>
          <option value="married">{t('candidate.profile.workplan.maritalMarried')}</option>
          <option value="divorced">{t('candidate.profile.workplan.maritalDivorced')}</option>
          <option value="widowed">{t('candidate.profile.workplan.maritalWidowed')}</option>
        </select>
      </Field>
      {marital === 'married' && (
        <Field label={t('candidate.profile.workplan.spouse')}><input {...register('spouseInfo')} className={inputCls} /></Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('candidate.profile.workplan.children')}><input type="number" min={0} {...register('childrenCount')} className={inputCls} /></Field>
        <Field label={t('candidate.profile.workplan.accompany')}>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm"><input type="radio" value="none" {...register('accompany')} /> {t('candidate.profile.workplan.accompanyNone')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" value="yes" {...register('accompany')} /> {t('candidate.profile.workplan.accompanyYes')}</label>
          </div>
        </Field>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
          {saving ? t('candidate.profile.saving') : t('candidate.profile.save')}
        </button>
        {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
      </div>
    </form>
  );
}

// ── Tab 7 — Photos ────────────────────────────────────────────────────────────
function PhotosTab({ candidate }: { candidate: CandidateData }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [urls, setUrls] = useState({ closeup: candidate.closeupUrl, fullbody: candidate.fullbodyUrl });

  function onUploaded(slot: 'closeup' | 'fullbody', url: string) {
    setUrls((prev) => ({ ...prev, [slot]: url }));
    qc.invalidateQueries({ queryKey: ['my-candidate'] });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
      <PhotoZone slot="closeup" label={t('candidate.photo.closeupLabel')} spec={t('candidate.photo.spec')} currentUrl={urls.closeup} onUploaded={(url) => onUploaded('closeup', url)} isLocked={candidate.isLocked} />
      <PhotoZone slot="fullbody" label={t('candidate.photo.fullbodyLabel')} spec={t('candidate.photo.spec')} currentUrl={urls.fullbody} onUploaded={(url) => onUploaded('fullbody', url)} isLocked={candidate.isLocked} />
    </div>
  );
}

// ── Tab 8 — Certifications ────────────────────────────────────────────────────
function CertificationsTab({ candidate }: { candidate: CandidateData }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { control, register, handleSubmit, reset, formState: { isDirty } } = useForm<CertificationForm>({
    defaultValues: {
      entries: (candidate.certifications ?? []).map((c) => ({
        ...c,
        issuedDate: c.issuedDate ? c.issuedDate.slice(0, 10) : '',
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });

  const certMutation = useMutation({
    mutationFn: (data: CertificationForm) =>
      api.put('/candidates/me/certifications', data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['my-candidate'] });
      reset(variables);
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => certMutation.mutate(d))} className="space-y-4">
      {fields.map((field, i) => (
        <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-xs font-medium text-gray-500">#{i + 1}</p>
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:underline">{t('btnDelete')}</button>
          </div>
          <Field label={t('candidate.profile.certifications.certName') + ' *'}>
            <input {...register(`entries.${i}.certName`)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('candidate.profile.certifications.certLevel')}>
              <input {...register(`entries.${i}.certLevel`)} className={inputCls} />
            </Field>
            <Field label={t('candidate.profile.certifications.issuedDate')}>
              <input type="date" {...register(`entries.${i}.issuedDate`)} className={inputCls} />
            </Field>
          </div>
          <Field label={t('candidate.profile.certifications.issuedBy')}>
            <input {...register(`entries.${i}.issuedBy`)} className={inputCls} />
          </Field>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ certName: '', certLevel: '', issuedDate: '', issuedBy: '' })}
        className="text-sm text-navy-600 hover:underline"
      >
        + {t('candidate.profile.certifications.addEntry')}
      </button>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={certMutation.isPending} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
          {certMutation.isPending ? t('candidate.profile.saving') : t('candidate.profile.save')}
        </button>
        {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
      </div>
    </form>
  );
}

// ── Tab 9 — PR & Motivation ───────────────────────────────────────────────────
function PrMotivationTab({ candidate, onSave, saving }: { candidate: CandidateData; onSave: (d: PrMotivationForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<PrMotivationForm>({
    resolver: zodResolver(prMotivationSchema),
    defaultValues: {
      selfPrId:      candidate.selfPrId ?? '',
      selfPrJa:      candidate.selfPrJa ?? '',
      motivationId:  candidate.motivationId ?? '',
      motivationJa:  candidate.motivationJa ?? '',
      applyReasonId: candidate.applyReasonId ?? '',
      applyReasonJa: candidate.applyReasonJa ?? '',
      selfIntroId:   candidate.selfIntroId ?? '',
      selfIntroJa:   candidate.selfIntroJa ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(async (d) => { await onSave(d); reset(d); })} className="space-y-6">
      <p className="text-xs text-gray-500">{t('candidate.profile.prMotivation.bilingualHint')}</p>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">{t('candidate.profile.prMotivation.selfPr')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Indonesia">
            <textarea {...register('selfPrId')} rows={4} maxLength={300} className={textareaCls} />
          </Field>
          <Field label="日本語">
            <textarea {...register('selfPrJa')} rows={4} maxLength={150} className={textareaCls} />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">{t('candidate.profile.prMotivation.motivation')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Indonesia">
            <textarea {...register('motivationId')} rows={4} maxLength={300} className={textareaCls} />
          </Field>
          <Field label="日本語">
            <textarea {...register('motivationJa')} rows={4} maxLength={150} className={textareaCls} />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">{t('candidate.profile.prMotivation.applyReason')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Indonesia">
            <textarea {...register('applyReasonId')} rows={4} maxLength={300} className={textareaCls} />
          </Field>
          <Field label="日本語">
            <textarea {...register('applyReasonJa')} rows={4} maxLength={150} className={textareaCls} />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">{t('candidate.profile.prMotivation.selfIntro')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Indonesia">
            <textarea {...register('selfIntroId')} rows={4} maxLength={200} className={textareaCls} />
          </Field>
          <Field label="日本語">
            <textarea {...register('selfIntroJa')} rows={4} maxLength={100} className={textareaCls} />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
          {saving ? t('candidate.profile.saving') : t('candidate.profile.save')}
        </button>
        {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
      </div>
    </form>
  );
}

// ── Main CandidateProfile ─────────────────────────────────────────────────────
const TABS = ['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9'] as const;
type TabKey = typeof TABS[number];

export default function CandidateProfile() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('tab1');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<CandidateMe>({
    queryKey: ['my-candidate'],
    queryFn: () => api.get('/candidates/me').then((r) => r.data),
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/candidates/me', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-candidate'] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post('/candidates/me/submit').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-candidate'] }),
  });

  const handleSave = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true);
    try { await patchMutation.mutateAsync(body); }
    finally { setSaving(false); }
  }, [patchMutation]);

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;

  const candidate = data?.candidate;
  if (!candidate) return null;

  const isLocked = candidate.isLocked;
  const { pct } = candidate.completeness;

  const tabLabels: Record<TabKey, string> = {
    tab1: t('candidate.profile.tab1'),
    tab2: t('candidate.profile.tab2'),
    tab3: t('candidate.profile.tab3'),
    tab4: t('candidate.profile.tab4'),
    tab5: t('candidate.profile.tab5'),
    tab6: t('candidate.profile.tab6'),
    tab7: t('candidate.profile.tab7'),
    tab8: t('candidate.profile.tab8'),
    tab9: t('candidate.profile.tab9'),
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{t('trayProfile')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{candidate.candidateCode} · {pct}% complete</p>
        </div>
        {candidate.profileStatus === 'incomplete' && pct === 100 && candidate.consentGiven && (
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-60 shrink-0"
          >
            {submitMutation.isPending ? '…' : t('candidate.profile.submitBtn')}
          </button>
        )}
      </div>

      {isLocked && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {t('candidate.profile.lockedBanner')}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-gray-100">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-t-lg transition ${
              activeTab === tab
                ? 'bg-navy-700 text-white'
                : 'text-gray-500 hover:text-navy-700 hover:bg-navy-50'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        {activeTab === 'tab1' && <PersonalTab candidate={candidate} onSave={(d) => handleSave(d as Record<string, unknown>)} saving={saving} />}
        {activeTab === 'tab2' && <SswTab candidate={candidate} onSave={(d) => handleSave(d as Record<string, unknown>)} saving={saving} />}
        {activeTab === 'tab3' && <EducationTab candidate={candidate} onSave={(d) => handleSave(d as Record<string, unknown>)} saving={saving} />}
        {activeTab === 'tab4' && <CareerTab candidate={candidate} saving={saving} />}
        {activeTab === 'tab5' && <JapaneseTab candidate={candidate} />}
        {activeTab === 'tab6' && <WorkplanTab candidate={candidate} onSave={(d) => handleSave(d as Record<string, unknown>)} saving={saving} />}
        {activeTab === 'tab7' && <PhotosTab candidate={candidate} />}
        {activeTab === 'tab8' && <CertificationsTab candidate={candidate} />}
        {activeTab === 'tab9' && <PrMotivationTab candidate={candidate} onSave={(d) => handleSave(d as Record<string, unknown>)} saving={saving} />}
      </div>
    </div>
  );
}
