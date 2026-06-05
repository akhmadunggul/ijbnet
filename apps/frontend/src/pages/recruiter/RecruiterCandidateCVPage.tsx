import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import CandidateCV from '../../components/CandidateCV';

export default function RecruiterCandidateCVPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [resumeLoading, setResumeLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['recruiter-candidate-cv', id],
    queryFn: () => api.get(`/recruiter/candidates/${id}`).then((r) => r.data),
    enabled: !!id,
    retry: false,
  });

  const { data: shokumuConfig } = useQuery<{ recruiterEnabled: boolean }>({
    queryKey: ['shokumu-config'],
    queryFn: () => api.get('/superadmin/shokumu-config').then((r) => r.data),
  });
  const recruiterResumeEnabled = shokumuConfig?.recruiterEnabled === true;

  async function downloadResumePdf() {
    if (!id) return;
    setResumeLoading(true);
    try {
      const resp = await fetch(`/api/recruiter/candidates/${id}/shokumu-pdf`, {
        headers: { Authorization: `Bearer ${accessToken ?? ''}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data?.candidate?.candidateCode ?? id}-resume.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setResumeLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Memuat CV...
      </div>
    );
  }

  if (error || !data?.candidate) {
    const status = (error as any)?.response?.status;
    const msg =
      status === 403
        ? 'Kandidat ini tidak ada dalam batch Anda'
        : status === 404
        ? 'Data kandidat tidak ditemukan'
        : 'Gagal memuat data';
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Kembali
        </button>
        <div className="flex items-center justify-center h-64 text-sm text-red-500">
          {msg}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">CV Kandidat</h1>
          <p className="text-xs text-gray-400 mt-0.5">{data.candidate.candidateCode}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            ← Kembali
          </button>
          {recruiterResumeEnabled && (
            <button
              onClick={downloadResumePdf}
              disabled={resumeLoading}
              className="text-sm px-4 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition disabled:opacity-50"
            >
              {resumeLoading ? '…' : t('recruiter.cv.downloadResume', { defaultValue: 'Resume / 職務経歴書' })}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="text-sm px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition"
          >
            Cetak / 印刷
          </button>
        </div>
      </div>

      <CandidateCV candidate={data.candidate} showSensitiveData={false} />
    </div>
  );
}
