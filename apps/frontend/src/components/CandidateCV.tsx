import CandidateCVv1 from './CandidateCVv1';
import CandidateCVv2 from './CandidateCVv2';
import { useExperiment } from '../hooks/useExperiment';
import { useAbStore } from '../store/abStore';

export type { CandidateCVProps } from './CandidateCVv1';
export { calculateAge, formatPeriod } from './CandidateCVv1';

import type { CandidateCVProps } from './CandidateCVv1';

export default function CandidateCV(props: CandidateCVProps) {
  // Viewer-level assignment (used when viewer has an LPK themselves, e.g. admin role)
  const { variant: userVariant } = useExperiment('cv-layout');
  // LPK→variant map lets any viewer resolve the correct layout from the candidate's LPK
  const cvLpkVariants = useAbStore(s => s.lpkVariants['cv-layout']);

  // Candidate's LPK takes priority: a manager or recruiter viewing a candidate
  // from LPK IJBNet should see v2 even though they have no LPK themselves
  const candidateLpkId = props.candidate?.lpkId as string | null | undefined;
  const variant = (candidateLpkId && cvLpkVariants?.[candidateLpkId]) ?? userVariant;

  if (variant === 'v2') return <CandidateCVv2 {...props} />;
  return <CandidateCVv1 {...props} />;
}
