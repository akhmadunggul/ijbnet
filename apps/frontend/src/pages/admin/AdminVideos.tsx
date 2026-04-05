import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AdminVideo } from '../../types/admin';

interface VideosResponse {
  videos: AdminVideo[];
}

function isShorts(url: string | null): boolean {
  return !!url && url.includes('/shorts/');
}

function VideoCard({
  video,
  onDelete,
  lang,
}: {
  video: AdminVideo;
  onDelete: () => void;
  lang: string;
}) {
  const shorts = isShorts(video.youtubeUrl);
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      {video.youtubeId && (
        <div className={shorts ? 'aspect-[9/16] max-h-80' : 'aspect-video'}>
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeId}`}
            className="w-full h-full"
            allowFullScreen
            title={video.label ?? video.youtubeId}
          />
        </div>
      )}
      <div className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">{video.label ?? '—'}</p>
          {video.videoDate && <p className="text-xs text-gray-400 mt-0.5">{video.videoDate}</p>}
          {shorts && (
            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded mt-1 inline-block">Shorts</span>
          )}
        </div>
        <button
          onClick={() => {
            if (window.confirm(lang === 'ja' ? 'この動画を削除しますか？' : 'Hapus video ini?')) {
              onDelete();
            }
          }}
          className="text-xs text-red-500 hover:underline shrink-0"
        >
          {lang === 'ja' ? '削除' : 'Hapus'}
        </button>
      </div>
    </div>
  );
}

export default function AdminVideos() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [urlInput, setUrlInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [urlError, setUrlError] = useState('');

  const { data, isLoading } = useQuery<VideosResponse>({
    queryKey: ['admin-videos', id],
    queryFn: () => api.get(`/admin/candidates/${id}/videos`).then((r) => r.data),
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: (payload: { youtubeUrl: string; label?: string; videoDate?: string }) =>
      api.post(`/admin/candidates/${id}/videos`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-videos', id] });
      setUrlInput('');
      setLabelInput('');
      setDateInput('');
      setUrlError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg === 'INVALID_YOUTUBE_URL') {
        setUrlError(t('admin.videos.invalidUrl'));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) =>
      api.delete(`/admin/candidates/${id}/videos/${videoId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos', id] }),
  });

  function handleAdd() {
    setUrlError('');
    if (!urlInput.trim()) {
      setUrlError(t('errorRequired'));
      return;
    }
    addMutation.mutate({
      youtubeUrl: urlInput.trim(),
      label: labelInput.trim() || undefined,
      videoDate: dateInput.trim() || undefined,
    });
  }

  const videos = data?.videos ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/admin/candidates/${id}`)} className="text-sm text-gray-400 hover:text-gray-600">
          ←
        </button>
        <h1 className="text-2xl font-semibold text-navy-900">{t('admin.videos.title')}</h1>
      </div>

      {/* Add form */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-gray-700">{t('admin.videos.addVideo')}</p>
        <div>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
            placeholder={t('admin.videos.urlPlaceholder')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
          {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder={t('admin.videos.labelField')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
          <input
            type="text"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            placeholder={t('admin.videos.videoDate')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={addMutation.isPending}
          className="bg-navy-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-900 transition disabled:opacity-50"
        >
          {addMutation.isPending ? '…' : (lang === 'ja' ? '追加' : 'Tambah')}
        </button>
      </div>

      {/* Video list */}
      {isLoading ? (
        <div className="text-sm text-gray-400">{t('loading')}</div>
      ) : videos.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">{t('noData')}</div>
      ) : (
        <div className="grid gap-4">
          {videos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              lang={lang}
              onDelete={() => deleteMutation.mutate(v.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
