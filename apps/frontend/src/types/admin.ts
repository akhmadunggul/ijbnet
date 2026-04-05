import type { Completeness } from './candidate';

export interface AdminBodyCheck {
  id: string;
  candidateId: string;
  verifiedHeight: number | null;
  verifiedWeight: number | null;
  carrySeconds: number | null;
  overallResult: 'pass' | 'hold' | 'fail' | null;
  checkedDate: string | null;
  checkedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVideo {
  id: string;
  candidateId: string;
  label: string | null;
  youtubeUrl: string | null;
  youtubeId: string | null;
  videoDate: string | null;
  uploadedBy: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface AdminCandidate {
  id: string;
  candidateCode: string;
  fullName: string;
  gender: 'M' | 'F' | null;
  dateOfBirth: string | null;
  profileStatus: string;
  isLocked: boolean;
  sswKubun: 'SSW1' | 'SSW2' | null;
  sswSectorJa: string | null;
  sswFieldJa: string | null;
  sswSectorId: string | null;
  sswFieldId: string | null;
  eduLevel: string | null;
  eduLabel: string | null;
  eduMajor: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  jpStudyDuration: string | null;
  maritalStatus: string | null;
  spouseInfo: string | null;
  childrenCount: number;
  accompany: 'none' | 'yes';
  workplanDuration: string | null;
  workplanGoal: string | null;
  workplanAfter: string | null;
  workplanExpectation: string | null;
  closeupUrl: string | null;
  fullbodyUrl: string | null;
  internalNotes: string | null;
  interviewStatus: string | null;
  consentGiven: boolean;
  completeness: Completeness;
  bodyCheck: AdminBodyCheck | null;
  videos: AdminVideo[];
  tests: Array<{
    id: string;
    testName: string | null;
    score: number | null;
    pass: boolean | null;
    testDate: string | null;
  }>;
  career: Array<{
    id: string;
    companyName: string | null;
    division: string | null;
    skillGroup: string | null;
    period: string | null;
    sortOrder: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  targetCandidateId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
}

export interface DashboardStats {
  total: number;
  statusBreakdown: Record<string, number>;
  pendingReview: number;
  bodyCheckCompleted: number;
  bodyCheckPending: number;
  videosLinked: number;
}

export interface AdminDashboardData {
  lpk: { id: string; name: string } | null;
  stats: DashboardStats;
  recentLogs: AuditLogEntry[];
}
