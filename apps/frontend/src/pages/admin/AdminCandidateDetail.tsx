import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import AuthImage from '../../components/AuthImage';
import CandidateTimeline from '../../components/CandidateTimeline';
import type { AdminCandidate, AuditLogEntry } from '../../types/admin';

interface CandidateDetailResponse {
  candidate: AdminCandidate;
}
interface AuditLogsResponse {
  logs: AuditLogEntry[];
}

const STATUS_TRANSITIONS: Record<string, Array<{ to: string; labelId: string; labelJa: string; danger?: boolean }>> = {
  submitted: [{ to: 'under_review', labelId: 'Mulai Review', labelJa: 'レビュー開始' }],
  under_review: [
    { to: 'approved', labelId: 'Setujui', labelJa: '承認' },
    { to: 'rejected', labelId: 'Tolak', labelJa: '不採用', danger: true },
  ],
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <p className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm py-1.5">
      <span className="text-gray-400 w-40 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminCandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState('');
  const [notesInit, setNotesInit] = useState(false);

  const { data, isLoading } = useQuery<CandidateDetailResponse>({
    queryKey: ['admin-candidate', id],
    queryFn: () => api.get(`/admin/candidates/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: auditData } = useQuery<AuditLogsResponse>({
    queryKey: ['admin-audit', id],
    queryFn: () => api.get(`/admin/audit-logs?candidateId=${id}&limit=20`).then((r) => r.data),
    enabled: !!id,
  });

  // Init notes from fetched data
  if (data?.candidate && !notesInit) {
    setNotes(data.candidate.internalNotes ?? '');
    setNotesInit(true);
  }

  const saveNotesMutation = useMutation({
    mutationFn: () => api.patch(`/admin/candidates/${id}`, { internalNotes: notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-candidate', id] }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/admin/candidates/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidate', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const lockMutation = useMutation({
    mutationFn: (isLocked: boolean) => api.patch(`/admin/candidates/${id}/lock`, { isLocked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-candidate', id] }),
  });

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;
  const c = data?.candidate;
  if (!c) return null;

  const transitions = STATUS_TRANSITIONS[c.profileStatus] ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/candidates')} className="text-sm text-gray-400 hover:text-gray-600">
          ← {lang === 'ja' ? '一覧に戻る' : 'Kembali'}
        </button>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{c.fullName}</h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{c.candidateCode}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Status action buttons */}
          {transitions.map((tr) => (
            <button
              key={tr.to}
              onClick={() => {
                if (window.confirm(tr.danger ? t('admin.status.confirmReject') : t('admin.status.confirmApprove'))) {
                  statusMutation.mutate(tr.to);
                }
              }}
              disabled={statusMutation.isPending}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                tr.danger
                  ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  : 'bg-navy-700 text-white hover:bg-navy-900'
              }`}
            >
              {lang === 'ja' ? tr.labelJa : tr.labelId}
            </button>
          ))}
          {/* Lock toggle for approved */}
          {c.profileStatus === 'approved' && (
            <button
              onClick={() => lockMutation.mutate(!c.isLocked)}
              disabled={lockMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
            >
              {c.isLocked
                ? (lang === 'ja' ? t('admin.status.unlockProfile') : t('admin.status.unlockProfile'))
                : (lang === 'ja' ? t('admin.status.lockProfile') : t('admin.status.lockProfile'))}
            </button>
          )}
          {/* Quick nav */}
          <button
            onClick={() => navigate(`/admin/candidates/${c.id}/cv`)}
            className="px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition"
          >
            {lang === 'ja' ? 'CV' : 'Lihat CV'}
          </button>
          <button
            onClick={() => navigate(`/admin/body-check/${c.id}`)}
            className="px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition"
          >
            {t('admin.candidates.actionBodyCheck')}
          </button>
          <button
            onClick={() => navigate(`/admin/videos/${c.id}`)}
            className="px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition"
          >
            {t('admin.candidates.actionVideos')}
          </button>
        </div>
      </div>

      {/* Photos */}
      {(c.closeupUrl || c.fullbodyUrl) && (
        <Section title={lang === 'ja' ? '写真' : 'Foto'}>
          <div className="flex gap-4">
            {c.closeupUrl && (
              <AuthImage
                src={c.closeupUrl}
                alt="Closeup"
                className="w-28 h-28 rounded-lg object-cover border border-gray-100"
                fallback={<div className="w-28 h-28 bg-gray-100 rounded-lg" />}
              />
            )}
            {c.fullbodyUrl && (
              <AuthImage
                src={c.fullbodyUrl}
                alt="Fullbody"
                className="w-24 h-40 rounded-lg object-cover border border-gray-100"
                fallback={<div className="w-24 h-40 bg-gray-100 rounded-lg" />}
              />
            )}
          </div>
        </Section>
      )}

      {/* Personal */}
      <Section title={lang === 'ja' ? '個人情報' : 'Data Pribadi'}>
        <Field label={lang === 'ja' ? '性別' : 'Jenis Kelamin'} value={c.gender === 'M' ? (lang === 'ja' ? '男性' : 'Laki-laki') : c.gender === 'F' ? (lang === 'ja' ? '女性' : 'Perempuan') : null} />
        <Field label={lang === 'ja' ? '生年月日' : 'Tgl Lahir'} value={c.dateOfBirth} />
        <Field label={lang === 'ja' ? '電話' : 'Telepon'} value={c.phone} />
        <Field label="Email" value={c.email} />
        <Field label={lang === 'ja' ? '住所' : 'Alamat'} value={c.address} />
      </Section>

      {/* SSW */}
      <Section title={lang === 'ja' ? 'SSW情報' : 'Info SSW'}>
        <Field label={lang === 'ja' ? 'SSW区分' : 'Tipe SSW'} value={c.sswKubun} />
        <Field label={lang === 'ja' ? '分野' : 'Bidang'} value={lang === 'ja' ? c.sswSectorJa : c.sswSectorId} />
        <Field label={lang === 'ja' ? '職種' : 'Jenis Pekerjaan'} value={lang === 'ja' ? c.sswFieldJa : c.sswFieldId} />
        <Field label={lang === 'ja' ? '日本語学習期間' : 'Durasi Belajar'} value={c.jpStudyDuration} />
      </Section>

      {/* Education */}
      <Section title={lang === 'ja' ? '学歴' : 'Pendidikan'}>
        <Field label={lang === 'ja' ? '学歴' : 'Jenjang'} value={c.eduLevel} />
        <Field label={lang === 'ja' ? '学校名' : 'Institusi'} value={c.eduLabel} />
        <Field label={lang === 'ja' ? '専攻' : 'Jurusan'} value={c.eduMajor} />
      </Section>

      {/* Career */}
      {c.career.length > 0 && (
        <Section title={lang === 'ja' ? '職歴' : 'Riwayat Kerja'}>
          <div className="space-y-2">
            {c.career.map((entry, i) => (
              <div key={entry.id ?? i} className="text-sm border-b border-gray-50 pb-2">
                <p className="font-medium text-gray-800">{entry.companyName ?? '—'}</p>
                <p className="text-xs text-gray-400">{entry.division} · {entry.period}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Japanese tests */}
      {c.tests.length > 0 && (
        <Section title={lang === 'ja' ? '語学テスト' : 'Tes Bahasa Jepang'}>
          <div className="space-y-1">
            {c.tests.map((test, i) => (
              <div key={test.id ?? i} className="flex justify-between text-sm py-1">
                <span>{test.testName ?? '—'}</span>
                <span className={`font-medium ${test.pass ? 'text-green-600' : 'text-red-500'}`}>
                  {test.score} {test.pass != null ? (test.pass ? '✓' : '✗') : ''}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Workplan */}
      <Section title={lang === 'ja' ? '就労計画' : 'Rencana Kerja'}>
        <Field label={lang === 'ja' ? '期間' : 'Durasi'} value={c.workplanDuration} />
        <Field label={lang === 'ja' ? '目標' : 'Tujuan'} value={c.workplanGoal} />
        <Field label={lang === 'ja' ? '帰国後' : 'Setelah Kembali'} value={c.workplanAfter} />
        <Field label={lang === 'ja' ? '期待' : 'Harapan'} value={c.workplanExpectation} />
        <Field
          label={lang === 'ja' ? '婚姻状況' : 'Status Nikah'}
          value={c.maritalStatus}
        />
        {c.maritalStatus === 'married' && (
          <Field label={lang === 'ja' ? '配偶者' : 'Pasangan'} value={c.spouseInfo} />
        )}
        <Field label={lang === 'ja' ? '子ども' : 'Anak'} value={String(c.childrenCount)} />
        <Field label={lang === 'ja' ? '家族帯同' : 'Bawa Keluarga'} value={c.accompany === 'yes' ? (lang === 'ja' ? 'あり' : 'Ya') : (lang === 'ja' ? 'なし' : 'Tidak')} />
      </Section>

      {/* Body check */}
      {c.bodyCheck && (
        <Section title={t('admin.bodyCheck.title')}>
          <Field label={t('admin.bodyCheck.height')} value={c.bodyCheck.verifiedHeight ? `${c.bodyCheck.verifiedHeight} cm` : null} />
          <Field label={t('admin.bodyCheck.weight')} value={c.bodyCheck.verifiedWeight ? `${c.bodyCheck.verifiedWeight} kg` : null} />
          <Field label={t('admin.bodyCheck.carry')} value={c.bodyCheck.carrySeconds ? `${c.bodyCheck.carrySeconds}s` : null} />
          <Field
            label={t('admin.bodyCheck.result')}
            value={
              <span className={`font-semibold ${c.bodyCheck.overallResult === 'pass' ? 'text-green-600' : c.bodyCheck.overallResult === 'fail' ? 'text-red-500' : 'text-amber-600'}`}>
                {c.bodyCheck.overallResult ?? '—'}
              </span>
            }
          />
          <Field label={lang === 'ja' ? '受験日' : 'Tgl Periksa'} value={c.bodyCheck.checkedDate} />
        </Section>
      )}

      {/* Internal notes */}
      <Section title={t('admin.notes.label')}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('admin.notes.placeholder')}
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300 resize-none"
        />
        <button
          onClick={() => saveNotesMutation.mutate()}
          disabled={saveNotesMutation.isPending}
          className="mt-2 bg-navy-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-navy-900 transition disabled:opacity-50"
        >
          {saveNotesMutation.isPending ? '…' : t('admin.notes.save')}
        </button>
      </Section>

      {/* Timeline */}
      <Section title={lang === 'ja' ? 'ステータス履歴' : 'Riwayat Status'}>
        <CandidateTimeline
          endpoint={`/admin/candidates/${id}/timeline`}
          queryKey={['admin-timeline', id!]}
        />
      </Section>

      {/* Audit trail */}
      {(auditData?.logs ?? []).length > 0 && (
        <Section title={lang === 'ja' ? '監査ログ' : 'Audit Trail'}>
          <ul className="space-y-2">
            {auditData!.logs.map((log) => (
              <li key={log.id} className="flex items-start gap-3 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1 shrink-0" />
                <div className="flex-1">
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{log.action}</span>
                  {log.user && (
                    <span className="text-gray-400 ml-2">{log.user.name ?? log.user.email}</span>
                  )}
                </div>
                <span className="text-gray-300 shrink-0">{formatDate(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
