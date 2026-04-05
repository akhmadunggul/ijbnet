import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import type { AdminCandidate } from '../../types/admin';

const schema = z.object({
  verifiedHeight: z.coerce.number().min(100).max(250).nullable().optional(),
  verifiedWeight: z.coerce.number().min(20).max(200).nullable().optional(),
  carrySeconds: z.coerce.number().int().min(0).nullable().optional(),
  vision: z.string().max(200).nullable().optional(),
  tattoo: z.string().max(200).nullable().optional(),
  overallResult: z.enum(['pass', 'hold', 'fail']).nullable().optional(),
  checkedDate: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AdminBodyCheck() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ candidate: AdminCandidate }>({
    queryKey: ['admin-candidate', id],
    queryFn: () => api.get(`/admin/candidates/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const bc = data?.candidate?.bodyCheck;

  useEffect(() => {
    if (bc) {
      reset({
        verifiedHeight: bc.verifiedHeight,
        verifiedWeight: bc.verifiedWeight,
        carrySeconds: bc.carrySeconds,
        vision: null,
        tattoo: null,
        overallResult: bc.overallResult,
        checkedDate: bc.checkedDate ?? '',
      });
    }
  }, [bc, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/admin/candidates/${id}/body-check`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidate', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-candidates'] });
    },
  });

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;
  const candidate = data?.candidate;
  if (!candidate) return null;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/admin/candidates/${id}`)} className="text-sm text-gray-400 hover:text-gray-600">
          ←
        </button>
        <h1 className="text-2xl font-semibold text-navy-900">{t('admin.bodyCheck.title')}</h1>
      </div>
      <p className="text-sm text-gray-500">{candidate.fullName} · {candidate.candidateCode}</p>

      {mutation.isSuccess && (
        <p className="text-sm text-green-600 bg-green-50 rounded-lg px-4 py-2">{t('toastSaved')}</p>
      )}

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="bg-white border border-gray-100 rounded-xl p-6 space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.bodyCheck.height')}</label>
            <input
              {...register('verifiedHeight')}
              type="number"
              step="0.1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
            />
            {errors.verifiedHeight && <p className="text-xs text-red-500 mt-1">{errors.verifiedHeight.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.bodyCheck.weight')}</label>
            <input
              {...register('verifiedWeight')}
              type="number"
              step="0.1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
            />
            {errors.verifiedWeight && <p className="text-xs text-red-500 mt-1">{errors.verifiedWeight.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.bodyCheck.carry')}</label>
          <input
            {...register('carrySeconds')}
            type="number"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.bodyCheck.vision')}</label>
          <input
            {...register('vision')}
            type="text"
            placeholder={lang === 'ja' ? '例: 1.0/0.8（暗号化して保存）' : 'Contoh: 1.0/0.8 (disimpan terenkripsi)'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
          {bc?.verifiedHeight && (
            <p className="text-xs text-gray-400 mt-1">
              {lang === 'ja' ? '現在の値は暗号化されています' : 'Nilai saat ini terenkripsi di server'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.bodyCheck.tattoo')}</label>
          <input
            {...register('tattoo')}
            type="text"
            placeholder={lang === 'ja' ? '例: なし（暗号化して保存）' : 'Contoh: tidak ada (disimpan terenkripsi)'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">{t('admin.bodyCheck.result')}</label>
          <div className="flex gap-4">
            {(['pass', 'hold', 'fail'] as const).map((val) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input {...register('overallResult')} type="radio" value={val} className="accent-navy-700" />
                <span className={`text-sm font-medium ${val === 'pass' ? 'text-green-600' : val === 'fail' ? 'text-red-500' : 'text-amber-600'}`}>
                  {t(`admin.bodyCheck.${val}`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {lang === 'ja' ? '検査日' : 'Tanggal Pemeriksaan'}
          </label>
          <input
            {...register('checkedDate')}
            type="date"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-navy-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-navy-900 transition disabled:opacity-50"
        >
          {mutation.isPending ? '…' : t('admin.bodyCheck.save')}
        </button>
      </form>
    </div>
  );
}
