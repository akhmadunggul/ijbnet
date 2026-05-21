import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

type TargetType = 'all' | 'lpk' | 'program' | 'batch';

interface LpkOption { id: string; name: string; }
interface ProgramOption { id: string; label: string; kubun: string | null; }
interface BatchOption { id: string; batchCode: string | null; company?: { name: string; nameJa?: string | null } | null; }
interface RecipientPreview { count: number; samples: { id: string; candidateCode: string; fullName: string; email: string | null }[]; }

export default function ManagerNotifyPage() {
  const { t } = useTranslation();

  const [targetType, setTargetType] = useState<TargetType>('all');
  const [targetId, setTargetId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [sendError, setSendError] = useState('');

  const { data: lpks } = useQuery<{ lpks: LpkOption[] }>({
    queryKey: ['manager-notify-lpks'],
    queryFn: () => api.get('/manager/lpks').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: programs } = useQuery<{ programs: ProgramOption[] }>({
    queryKey: ['manager-notify-programs'],
    queryFn: () => api.get('/manager/notify/programs').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: batches } = useQuery<{ batches: BatchOption[] }>({
    queryKey: ['manager-notify-batches'],
    queryFn: () =>
      api.get('/manager/batches?limit=200').then((r) => r.data),
    staleTime: 60_000,
  });

  const hasTarget =
    targetType === 'all' ||
    ((targetType === 'lpk' || targetType === 'batch') && targetId) ||
    (targetType === 'program' && targetId);

  const { data: preview, isFetching: previewLoading } = useQuery<RecipientPreview>({
    queryKey: ['notify-recipients', targetType, targetId],
    queryFn: () => {
      const params: Record<string, string> = { targetType };
      if (targetId) params['targetId'] = targetId;
      return api.get('/manager/notify/recipients', { params }).then((r) => r.data);
    },
    enabled: !!hasTarget,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/manager/notify', {
        targetType,
        targetId: targetId || undefined,
        subject,
        body,
      }).then((r) => r.data as { sent: number }),
    onSuccess: (data) => {
      setSentCount(data.sent);
      setSendError('');
      setSubject('');
      setBody('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? t('notify.errorGeneric');
      setSendError(msg);
    },
  });

  function handleTargetTypeChange(type: TargetType) {
    setTargetType(type);
    setTargetId('');
    setSentCount(null);
    setSendError('');
  }

  const canSend =
    hasTarget &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (preview?.count ?? 0) > 0 &&
    !mutation.isPending;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-navy-900 mb-1">{t('notify.title')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('notify.subtitle')}</p>

      {/* Target type selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-3">{t('notify.targetLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {(['all', 'lpk', 'program', 'batch'] as TargetType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleTargetTypeChange(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                targetType === type
                  ? 'bg-navy-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t(`notify.target.${type}`)}
            </button>
          ))}
        </div>

        {/* Dynamic dropdown */}
        {targetType === 'lpk' && (
          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1">{t('notify.selectLpk')}</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
            >
              <option value="">{t('notify.selectPlaceholder')}</option>
              {lpks?.lpks.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {targetType === 'program' && (
          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1">{t('notify.selectProgram')}</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
            >
              <option value="">{t('notify.selectPlaceholder')}</option>
              {programs?.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kubun ? `[${p.kubun}] ` : ''}{p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {targetType === 'batch' && (
          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1">{t('notify.selectBatch')}</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
            >
              <option value="">{t('notify.selectPlaceholder')}</option>
              {batches?.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchCode ?? b.id}
                  {b.company?.name ? ` — ${b.company.name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Recipient preview */}
      {hasTarget && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm">
          {previewLoading ? (
            <span className="text-blue-500">{t('notify.loadingRecipients')}</span>
          ) : preview ? (
            <>
              <p className="font-medium text-blue-800 mb-2">
                {t('notify.recipientsFound', { count: preview.count })}
              </p>
              {preview.samples.length > 0 && (
                <ul className="space-y-0.5 text-blue-700">
                  {preview.samples.map((s) => (
                    <li key={s.id} className="truncate">
                      {s.candidateCode} — {s.fullName}
                      {s.email && <span className="text-blue-500"> &lt;{s.email}&gt;</span>}
                    </li>
                  ))}
                  {preview.count > preview.samples.length && (
                    <li className="text-blue-500 italic">
                      {t('notify.andMore', { n: preview.count - preview.samples.length })}
                    </li>
                  )}
                </ul>
              )}
              {preview.count === 0 && (
                <p className="text-amber-700">{t('notify.noRecipients')}</p>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Message compose */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('notify.subjectLabel')}</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder={t('notify.subjectPlaceholder')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('notify.bodyLabel')}</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={6}
            placeholder={t('notify.bodyPlaceholder')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300 resize-y"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/5000</p>
        </div>

        {sendError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {sendError}
          </p>
        )}

        {sentCount !== null && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {t('notify.sentSuccess', { count: sentCount })}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => {
              setSentCount(null);
              setSendError('');
              mutation.mutate();
            }}
            disabled={!canSend}
            className="px-6 py-2 bg-navy-700 text-white rounded-lg text-sm font-medium hover:bg-navy-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {mutation.isPending ? t('notify.sending') : t('notify.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
