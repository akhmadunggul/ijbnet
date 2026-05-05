import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import CandidateCV from '../../components/CandidateCV';

export default function RecruiterCandidateCVPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['recruiter-candidate-cv', id],
    queryFn: () => api.get(`/recruiter/candidates/${id}`).then((r) => r.data),
    enabled: !!id,
    retry: false,
  });

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
