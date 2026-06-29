import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type CvDisplayMode = 'same_page' | 'new_tab';

export function useCvDisplayMode() {
  const navigate = useNavigate();

  const { data } = useQuery<{ mode: CvDisplayMode }>({
    queryKey: ['cv-display-mode'],
    queryFn: () => api.get('/superadmin/cv-display-mode').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const mode: CvDisplayMode = data?.mode ?? 'same_page';

  function openCv(path: string) {
    if (mode === 'new_tab') {
      window.open(path, '_blank', 'noopener,noreferrer');
    } else {
      navigate(path);
    }
  }

  return { openCv, mode };
}
