import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CandidateMe } from '../../types/candidate';
import ShokumuCV from '../../components/ShokumuCV';

export default function ShokumuCVPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language === 'ja' ? 'ja' : 'id';

  const { data, isLoading, isError } = useQuery<CandidateMe>({
    queryKey: ['my-candidate'],
    queryFn: () => api.get('/candidates/me').then(r => r.data),
  });

  async function handleDownload() {
    if (!data?.candidate?.candidateCode) return;
    try {
      const resp = await api.get('/candidates/me/shokumu-pdf', { responseType: 'blob' });
      const blob = new Blob([resp.data as BlobPart], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${data.candidate.candidateCode}-shokumu.pdf`;
      a.click();
      URL.revokeObjectURL(href);
    } catch { /* network error shown by browser */ }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        {lang === 'ja' ? '職務経歴書を読み込み中...' : 'Memuat Resume...'}
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
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">
            {lang === 'ja' ? '職務経歴書' : 'Resume / 職務経歴書'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {data.candidate.candidateCode}
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
            className="text-sm px-4 py-2 border border-navy-700 text-navy-700 rounded-lg hover:bg-navy-50 transition"
          >
            {lang === 'ja' ? '印刷' : 'Cetak / 印刷'}
          </button>
          <button
            onClick={() => { void handleDownload(); }}
            className="text-sm px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition"
          >
            {t('shokumu.downloadShokumu')}
          </button>
        </div>
      </div>

      <ShokumuCV candidate={data.candidate} />
    </div>
  );
}
