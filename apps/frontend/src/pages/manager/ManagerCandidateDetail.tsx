import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import CandidateTimeline from '../../components/CandidateTimeline';
import type { ManagerCandidate } from '../../types/manager';

const STATUS_CONFIG: Record<string, { key: string; color: string }> = {
  incomplete:   { key: 'chipIncomplete',  color: 'bg-gray-100 text-gray-600' },
  submitted:    { key: 'chipSubmitted',   color: 'bg-blue-100 text-blue-700' },
  under_review: { key: 'chipUnderReview', color: 'bg-amber-100 text-amber-700' },
  approved:     { key: 'chipApproved',    color: 'bg-green-100 text-green-700' },
  confirmed:    { key: 'chipConfirmed',   color: 'bg-yellow-100 text-yellow-700' },
  rejected:     { key: 'chipRejected',    color: 'bg-red-100 text-red-700' },
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-gray-50 last:border-0">
      <dt className="text-xs font-medium text-gray-400 sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm text-navy-900">{value ?? '—'}</dd>
    </div>
  );
}

export default function ManagerCandidateDetail() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const { data: candidate, isLoading } = useQuery<ManagerCandidate>({
    queryKey: ['manager-candidate', id],
    queryFn: () => api.get(`/manager/candidates/${id}`).then((r) => r.data.candidate),
    enabled: !!id,
  });

  useEffect(() => {
    if (candidate?.internalNotes && notes === '') {
      setNotes(candidate.internalNotes);
    }
  }, [candidate?.internalNotes]);

  const saveNotesMutation = useMutation({
    mutationFn: () => api.patch(`/manager/candidates/${id}`, { internalNotes: notes }),
    onSuccess: () => {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['manager-candidate', id] });
    },
  });

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;
  if (!candidate) return <div className="text-sm text-gray-400">{t('noData')}</div>;

  const statusCfg = STATUS_CONFIG[candidate.profileStatus] ?? STATUS_CONFIG['incomplete']!;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/manager/candidates')}
          className="text-sm text-navy-600 hover:underline"
        >
          ← {t('btnBack')}
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{candidate.fullName}</h1>
          <p className="text-xs font-mono text-gray-400 mt-0.5">{candidate.candidateCode}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
          {t(statusCfg.key)}
        </span>
      </div>

      {/* Info panels */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy-900 mb-3">{t('dpTitle')}</h2>
        <dl className="space-y-0">
          <InfoRow label={t('dpFullName')} value={candidate.fullName} />
          <InfoRow
            label={t('dpGender')}
            value={candidate.gender ? t(candidate.gender === 'M' ? 'genderM' : 'genderF') : null}
          />
          <InfoRow label={t('dpDob')} value={candidate.dateOfBirth} />
          <InfoRow label={t('dpEmail')} value={candidate.email} />
          <InfoRow label={t('dpPhone')} value={candidate.phone} />
          <InfoRow label={t('dpAddress')} value={candidate.address} />
          <InfoRow label={t('colLpk')} value={candidate.lpk?.name ?? null} />
        </dl>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy-900 mb-3">{t('sswTitle')}</h2>
        <dl className="space-y-0">
          <InfoRow label={t('sswKubun')} value={candidate.sswKubun} />
          <InfoRow label={t('sswField')} value={lang === 'ja' ? candidate.sswFieldJa : candidate.sswFieldId} />
        </dl>
      </div>

      {candidate.completeness && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-navy-900 mb-3">
            {t('manager.candidates.completenessLabel')}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-navy-600 rounded-full transition-all"
                style={{ width: `${candidate.completeness.pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-navy-700">{candidate.completeness.pct}%</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {candidate.completeness.score} / {candidate.completeness.total}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <CandidateTimeline
          endpoint={`/manager/candidates/${id}/timeline`}
          queryKey={['manager-timeline', id!]}
        />
      </div>

      {/* Internal notes */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy-900 mb-3">{t('manager.candidates.internalNotes')}</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={t('admin.notes.placeholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300 resize-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => saveNotesMutation.mutate()}
            disabled={saveNotesMutation.isPending}
            className="text-sm bg-navy-700 text-white px-4 py-1.5 rounded-lg hover:bg-navy-800 transition disabled:opacity-50"
          >
            {saveNotesMutation.isPending ? t('loading') : t('manager.candidates.saveNotes')}
          </button>
          {notesSaved && (
            <span className="text-xs text-green-600">{t('toastSaved')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
