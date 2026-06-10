import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import HiringLetter, { type HiringLetterData } from '../components/HiringLetter';

function letterDataEndpoint(role: string | undefined, proposalId: string): string {
  if (role === 'manager')   return `/manager/interviews/${proposalId}/letter/data`;
  if (role === 'recruiter') return `/recruiter/interviews/${proposalId}/letter/data`;
  return `/candidates/me/letter/${proposalId}/data`;
}

function letterPdfEndpoint(role: string | undefined, proposalId: string): string {
  if (role === 'manager')   return `/manager/interviews/${proposalId}/letter`;
  if (role === 'recruiter') return `/recruiter/interviews/${proposalId}/letter`;
  return `/candidates/me/letter/${proposalId}`;
}

export default function HiringLetterPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const [zoom, setZoom] = useState(100);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError } = useQuery<HiringLetterData>({
    queryKey: ['hiring-letter', proposalId],
    queryFn: () => api.get(letterDataEndpoint(user?.role, proposalId!)).then((r) => r.data),
    enabled: !!proposalId,
  });

  async function handleDownload() {
    if (!data || !proposalId || downloading) return;
    setDownloading(true);
    const url = `/api${letterPdfEndpoint(user?.role, proposalId)}`;
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken ?? ''}` } });
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const isAccepted = data.decision === 'accepted';
      a.download = `${isAccepted ? '内定通知書' : '不採用通知書'}_${data.candidateName}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        読み込み中...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-red-500">
        データの読み込みに失敗しました
      </div>
    );
  }

  const title = data.decision === 'accepted' ? '内定通知書' : '不採用通知書';

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">{title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{data.candidateName}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-navy-700 text-sm"
            >
              −
            </button>
            <span className="text-xs text-gray-500 w-10 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-navy-700 text-sm"
            >
              ＋
            </button>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            ← 戻る
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm px-4 py-2 border border-navy-700 text-navy-700 rounded-lg hover:bg-navy-50 transition"
          >
            印刷
          </button>
          <button
            onClick={() => { void handleDownload(); }}
            disabled={downloading}
            className="text-sm px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition disabled:opacity-50"
          >
            {downloading ? '...' : 'PDF 保存'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <HiringLetter data={data} zoom={zoom} />
      </div>
    </div>
  );
}
