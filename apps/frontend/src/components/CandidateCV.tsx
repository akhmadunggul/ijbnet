import CandidateCVv1 from './CandidateCVv1';
import CandidateCVv2 from './CandidateCVv2';
import { useExperiment } from '../hooks/useExperiment';

export type { CandidateCVProps } from './CandidateCVv1';
export { calculateAge, formatPeriod } from './CandidateCVv1';

import type { CandidateCVProps } from './CandidateCVv1';

export default function CandidateCV(props: CandidateCVProps) {
  const { variant } = useExperiment('cv-layout');
  if (variant === 'v2') return <CandidateCVv2 {...props} />;
  return <CandidateCVv1 {...props} />;
}
