import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import AuthImage from '../../components/AuthImage';
import type { CandidateMe, CareerEntry, JapaneseTest } from '../../types/candidate';

// ── Zod schemas ───────────────────────────────────────────────────────────────
const personalSchema = z.object({
  fullName:    z.string().min(1),
  gender:      z.enum(['M', 'F']).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  heightCm:    z.coerce.number().nullable().optional(),
  weightKg:    z.coerce.number().nullable().optional(),
  email:       z.string().email().nullable().optional().or(z.literal('')),
  phone:       z.string().nullable().optional(),
  address:     z.string().nullable().optional(),
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

type PersonalForm   = z.infer<typeof personalSchema>;
type SswForm        = z.infer<typeof sswSchema>;
type EducationForm  = z.infer<typeof educationSchema>;
type CareerForm     = z.infer<typeof careerSchema>;
type TestForm       = z.infer<typeof testSchema>;
type WorkplanForm   = z.infer<typeof workplanSchema>;

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

// ── Photo upload zone ─────────────────────────────────────────────────────────
function PhotoZone({
  slot,
  label,
  spec,
  currentUrl,
  onUploaded,
}: {
  slot: 'closeup' | 'fullbody';
  label: string;
  spec: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
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
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); },
      });
      onUploaded(res.data.url);
    } catch {
      setError(t('toastError'));
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
        className={`relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-navy-400 transition ${aspectClass} max-h-72 flex items-center justify-center bg-gray-50`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        {(localPreview ?? currentUrl) ? (
          localPreview
            ? <img src={localPreview} alt="preview" className="w-full h-full object-cover" />
            : <AuthImage src={currentUrl} alt="current" className="w-full h-full object-cover" fallback={<span className="text-xs text-gray-400">{t('loading')}</span>} />
        ) : (
          <div className="text-center p-4">
            <p className="text-2xl mb-2">📷</p>
            <p className="text-xs text-gray-400">{t('candidate.photo.dropzone')}</p>
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
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ── Tab 1 — Personal ──────────────────────────────────────────────────────────
function PersonalTab({ candidate, onSave, saving }: { candidate: CandidateMe['candidate']; onSave: (d: PersonalForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { isDirty, errors } } = useForm<PersonalForm>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      fullName: candidate.fullName ?? '',
      gender: candidate.gender ?? undefined,
      dateOfBirth: candidate.dateOfBirth ? candidate.dateOfBirth.slice(0, 10) : '',
      heightCm: candidate.heightCm ?? undefined,
      weightKg: candidate.weightKg ?? undefined,
      email: candidate.email ?? '',
      phone: candidate.phone ?? '',
      address: candidate.address ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <Field label={t('dpFullName') + ' *'}>
        <input {...register('fullName')} className={inputCls} />
        {errors.fullName && <p className="text-xs text-red-500 mt-1">{t('errorRequired')}</p>}
      </Field>
      <Field label={t('dpGender')}>
        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="M" {...register('gender')} /> {t('dpGender') === 'Gender' ? 'Male' : 'Laki-laki / 男性'}</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="F" {...register('gender')} /> {t('dpGender') === 'Gender' ? 'Female' : 'Perempuan / 女性'}</label>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('dpDob')}><input type="date" {...register('dateOfBirth')} className={inputCls} /></Field>
        <Field label="NIK (terenkripsi)"><input disabled className={`${inputCls} bg-gray-50 text-gray-400`} placeholder="Diisi admin" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('dpHeight') + ' (cm)'}><input type="number" step="0.1" {...register('heightCm')} className={inputCls} /></Field>
        <Field label={t('dpWeight') + ' (kg)'}><input type="number" step="0.1" {...register('weightKg')} className={inputCls} /></Field>
      </div>
      <Field label={t('dpEmail')}><input type="email" {...register('email')} className={inputCls} /></Field>
      <Field label={t('dpPhone')}><input {...register('phone')} className={inputCls} /></Field>
      <Field label={t('dpAddress')}><textarea {...register('address')} rows={3} className={inputCls} /></Field>
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
function SswTab({ candidate, onSave, saving }: { candidate: CandidateMe['candidate']; onSave: (d: SswForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { isDirty } } = useForm<SswForm>({
    resolver: zodResolver(sswSchema),
    defaultValues: {
      jobCategory: candidate.jobCategory ?? '',
      sswKubun: candidate.sswKubun ?? undefined,
      sswSectorId: candidate.sswSectorId ?? '',
      sswFieldId: candidate.sswFieldId ?? '',
      sswSectorJa: candidate.sswSectorJa ?? '',
      sswFieldJa: candidate.sswFieldJa ?? '',
      jpStudyDuration: candidate.jpStudyDuration ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <Field label={t('sswTitle') + ' — ' + t('sswKubun')}>
        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="SSW1" {...register('sswKubun')} /> SSW1</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" value="SSW2" {...register('sswKubun')} /> SSW2</label>
        </div>
      </Field>
      <Field label="Job Category"><input {...register('jobCategory')} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('sswSector') + ' (ID)'}><input {...register('sswSectorId')} className={inputCls} /></Field>
        <Field label={t('sswField') + ' (ID)'}><input {...register('sswFieldId')} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('sswSector') + ' (JA)'}><input {...register('sswSectorJa')} className={inputCls} /></Field>
        <Field label={t('sswField') + ' (JA)'}><input {...register('sswFieldJa')} className={inputCls} /></Field>
      </div>
      <Field label={t('sswStudy')}><input {...register('jpStudyDuration')} className={inputCls} placeholder="18 bulan" /></Field>
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

function EducationTab({ candidate, onSave, saving }: { candidate: CandidateMe['candidate']; onSave: (d: EducationForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { isDirty } } = useForm<EducationForm>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      eduLevel: candidate.eduLevel ?? '',
      eduLabel: candidate.eduLabel ?? '',
      eduMajor: candidate.eduMajor ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <Field label="Education Level">
        <select {...register('eduLevel')} className={selectCls}>
          <option value="">— Pilih —</option>
          {EDU_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
      <Field label="Education Label"><input {...register('eduLabel')} className={inputCls} placeholder="e.g. SMK Negeri 1 Jakarta" /></Field>
      <Field label="Major / Jurusan"><input {...register('eduMajor')} className={inputCls} /></Field>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-60">
          {saving ? t('candidate.profile.saving') : t('candidate.profile.save')}
        </button>
        {isDirty && <span className="text-xs text-amber-600">{t('candidate.profile.unsaved')}</span>}
      </div>
    </form>
  );
}

// ── Tab 4 — Career ────────────────────────────────────────────────────────────
function CareerTab({ candidate, saving }: { candidate: CandidateMe['candidate']; saving: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { control, register, handleSubmit, formState: { isDirty } } = useForm<CareerForm>({
    defaultValues: {
      entries: (candidate.career ?? []).map((c, i) => ({ ...c, sortOrder: c.sortOrder ?? i })),
    },
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'entries' });

  const careerMutation = useMutation({
    mutationFn: (data: CareerForm) => api.put('/candidates/me/career', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-candidate'] }),
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
            <Field label="Company Name"><input {...register(`entries.${i}.companyName`)} className={inputCls} /></Field>
            <Field label="Division"><input {...register(`entries.${i}.division`)} className={inputCls} /></Field>
            <Field label="Skill Group"><input {...register(`entries.${i}.skillGroup`)} className={inputCls} /></Field>
            <Field label="Period"><input {...register(`entries.${i}.period`)} className={inputCls} placeholder="Jan 2022 – Mar 2024" /></Field>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => append({ companyName: '', division: '', skillGroup: '', period: '', sortOrder: fields.length })} className="text-sm text-navy-600 hover:underline">
        + Add Entry
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

function JapaneseTab({ candidate }: { candidate: CandidateMe['candidate'] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { control, register, handleSubmit, formState: { isDirty } } = useForm<TestForm>({
    defaultValues: {
      entries: (candidate.tests ?? []).map((t) => ({ ...t, testDate: t.testDate ? t.testDate.slice(0, 10) : '' })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });

  const testsMutation = useMutation({
    mutationFn: (data: TestForm) => api.put('/candidates/me/tests', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-candidate'] }),
  });

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit((d) => testsMutation.mutate(d))} className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Test Bahasa Jepang / 日本語テスト</p>
        {fields.map((field, i) => (
          <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between">
              <p className="text-xs font-medium text-gray-500">Test #{i + 1}</p>
              <button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:underline">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Test Name">
                <select {...register(`entries.${i}.testName`)} className={selectCls}>
                  <option value="">— Pilih —</option>
                  {JLPT_TESTS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Score"><input type="number" {...register(`entries.${i}.score`)} className={inputCls} /></Field>
              <Field label="Test Date"><input type="date" {...register(`entries.${i}.testDate`)} className={inputCls} /></Field>
              <Field label="Pass">
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" {...register(`entries.${i}.pass`)} className="h-4 w-4 accent-navy-700" />
                  <span className="text-sm text-gray-600">Lulus / 合格</span>
                </div>
              </Field>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => append({ testName: '', score: undefined, pass: false, testDate: '' })} className="text-sm text-navy-600 hover:underline">
          + Add Test
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
        <p className="text-sm font-medium text-gray-700 mb-3">Weekly Test Scores (read-only)</p>
        {(candidate.weeklyTests ?? []).length === 0 ? (
          <p className="text-xs text-gray-400">{t('noData')}</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-left text-xs text-gray-500 border-b">{['Course','Week','Score','Date'].map((h) => <th key={h} className="pb-2 pr-4">{h}</th>)}</tr></thead>
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
function WorkplanTab({ candidate, onSave, saving }: { candidate: CandidateMe['candidate']; onSave: (d: WorkplanForm) => void; saving: boolean }) {
  const { t } = useTranslation();
  const { register, watch, handleSubmit, formState: { isDirty } } = useForm<WorkplanForm>({
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
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <Field label={t('workplanDuration')}><input {...register('workplanDuration')} className={inputCls} placeholder="3 tahun" /></Field>
      <Field label={t('workplanGoal')}><textarea {...register('workplanGoal')} rows={3} className={inputCls} /></Field>
      <Field label={t('workplanAfter')}><textarea {...register('workplanAfter')} rows={3} className={inputCls} /></Field>
      <Field label={t('workplanExpectation')}><textarea {...register('workplanExpectation')} rows={3} className={inputCls} /></Field>
      <Field label="Marital Status">
        <select {...register('maritalStatus')} className={selectCls}>
          <option value="">—</option>
          {['single','married','divorced','widowed'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      {marital === 'married' && (
        <Field label="Spouse Info"><input {...register('spouseInfo')} className={inputCls} /></Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Children Count"><input type="number" min={0} {...register('childrenCount')} className={inputCls} /></Field>
        <Field label="Accompany Family">
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm"><input type="radio" value="none" {...register('accompany')} /> No</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" value="yes" {...register('accompany')} /> Yes</label>
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
function PhotosTab({ candidate }: { candidate: CandidateMe['candidate'] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [urls, setUrls] = useState({ closeup: candidate.closeupUrl, fullbody: candidate.fullbodyUrl });

  function onUploaded(slot: 'closeup' | 'fullbody', url: string) {
    setUrls((prev) => ({ ...prev, [slot]: url }));
    qc.invalidateQueries({ queryKey: ['my-candidate'] });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
      <PhotoZone slot="closeup" label={t('candidate.photo.closeupLabel')} spec={t('candidate.photo.spec')} currentUrl={urls.closeup} onUploaded={(url) => onUploaded('closeup', url)} />
      <PhotoZone slot="fullbody" label={t('candidate.photo.fullbodyLabel')} spec={t('candidate.photo.spec')} currentUrl={urls.fullbody} onUploaded={(url) => onUploaded('fullbody', url)} />
    </div>
  );
}

// ── Main CandidateProfile ─────────────────────────────────────────────────────
const TABS = ['tab1','tab2','tab3','tab4','tab5','tab6','tab7'] as const;
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
            {submitMutation.isPending ? '…' : t('candidate.profile.submit')}
          </button>
        )}
      </div>

      {isLocked && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          🔒 {t('candidate.profile.locked')}
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
      </div>
    </div>
  );
}
