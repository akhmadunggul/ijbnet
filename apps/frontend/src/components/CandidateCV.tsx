import { useQuery } from '@tanstack/react-query';
import CandidateCVv1 from './CandidateCVv1';
import CandidateCVv2 from './CandidateCVv2';
import CandidateCVv3 from './CandidateCVv3';
import { api } from '../lib/api';

export type { CandidateCVProps } from './CandidateCVv1';
export { calculateAge, formatPeriod } from './CandidateCVv1';

import type { CandidateCVProps } from './CandidateCVv1';

export default function CandidateCV(props: CandidateCVProps) {
  const { data } = useQuery<{ v2LpkIds: string[]; v3LpkIds: string[] }>({
    queryKey: ['cv-version-config'],
    queryFn: () => api.get('/superadmin/cv-version-config').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const candidateLpkId = props.candidate?.lpkId as string | null | undefined;
  const useV3 = candidateLpkId ? (data?.v3LpkIds ?? []).includes(candidateLpkId) : false;
  const useV2 = candidateLpkId ? (data?.v2LpkIds ?? []).includes(candidateLpkId) : false;

  if (useV3) return <CandidateCVv3 {...props} />;
  if (useV2) return <CandidateCVv2 {...props} />;
  return <CandidateCVv1 {...props} />;
}
