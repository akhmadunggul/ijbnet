export interface ManagerStats {
  candidatesByStatus: Record<string, number>;
  activeBatches: number;
  pendingApprovals: number;
  interviewsThisWeek: number;
}

export interface ManagerBatch {
  id: string;
  batchCode: string | null;
  name: string | null;
  status: 'draft' | 'active' | 'selection' | 'approved' | 'closed';
  quotaTotal: number | null;
  interviewCandidateLimit: number | null;
  sswFieldFilter: string | null;
  expiryDate: string | null;
  createdAt: string;
  company: { id: string; name: string; nameJa: string | null } | null;
  selectedCount?: number;
  confirmedCount?: number;
  allocations?: ManagerBatchCandidate[];
}

export interface ManagerCandidate {
  id: string;
  candidateCode: string;
  fullName: string;
  gender: 'M' | 'F' | null;
  dateOfBirth: string | null;
  profileStatus: string;
  sswKubun: 'SSW1' | 'SSW2' | null;
  sswFieldJa: string | null;
  sswFieldId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  internalNotes: string | null;
  completeness?: { score: number; total: number; pct: number };
  bodyCheck?: { overallResult: 'pass' | 'hold' | 'fail' | null } | null;
  lpk?: { id: string; name: string } | null;
}

export interface ManagerBatchCandidate {
  id: string;
  candidateId: string;
  isSelected: boolean;
  isConfirmed: boolean;
  selectedAt: string | null;
  confirmedAt: string | null;
  candidate: ManagerCandidate;
  proposal?: {
    id: string;
    status: string;
    proposedDates: string[] | null;
    finalDate: string | null;
  } | null;
}

export interface ManagerInterview {
  id: string;
  status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  proposedDates: string[] | null;
  candidatePreferredDate: string | null;
  finalDate: string | null;
  createdAt: string;
  batchCandidate?: {
    id: string;
    candidate: { id: string; candidateCode: string; fullName: string; email: string | null };
    batch: { id: string; batchCode: string | null; company: { name: string; nameJa: string | null } | null };
  };
}
