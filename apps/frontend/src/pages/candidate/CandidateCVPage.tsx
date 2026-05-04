import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CandidateMe } from '../../types/candidate';
import CandidateCV from '../../components/CandidateCV';

export default function CandidateCVPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language === 'ja' ? 'ja' : 'id';

  const { data, isLoading, isError } = useQuery<CandidateMe>({
    queryKey: ['my-candidate'],
    queryFn: () => api.get('/candidates/me').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        {lang === 'ja' ? 'CV読み込み中...' : 'Memuat CV...'}
      </div>
    );
  }

  if (isError || !data?.candidate) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-red-500">
        {lang === 'ja' ? 'データの読み込みに失敗しました' : 'Gagal memuat data'}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">
            {lang === 'ja' ? '自分のCV' : 'CV Saya'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {lang === 'ja' ? 'CV Saya / 自分のCV' : 'CV Saya / 自分のCV'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            {lang === 'ja' ? '← 戻る' : '← Kembali'}
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition"
          >
            {lang === 'ja' ? '印刷' : 'Cetak / 印刷'}
          </button>
        </div>
      </div>

      <CandidateCV candidate={data.candidate} showSensitiveData={false} lang={lang} />
    </div>
  );
}
