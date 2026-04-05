import type { Completeness } from './candidate';

export interface MaskedField {
  masked: true;
  label: { id: string; ja: string };
}

export interface RecruiterBodyCheck {
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

export interface RecruiterVideo {
  id: string;
  candidateId: string;
  label: string | null;
  youtubeUrl: string | null;
  youtubeId: string | null;
  videoDate: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface RecruiterTest {
  id: string;
  testName: string | null;
  score: number | null;
  pass: boolean | null;
  testDate: string | null;
}

export interface RecruiterWeeklyTest {
  id: string;
  courseName: string | null;
  weekNumber: number | null;
  score: number | null;
  testDate: string | null;
}

export interface RecruiterCareerEntry {
  id: string;
  companyName: string | null;
  division: string | null;
  skillGroup: string | null;
  period: string | null;
  sortOrder: number;
}

export interface RecruiterCandidate {
  id: string;
  candidateCode: string;
  fullName: string;
  gender: 'M' | 'F' | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  eduLevel: string | null;
  eduLabel: string | null;
  eduMajor: string | null;
  sswKubun: 'SSW1' | 'SSW2' | null;
  sswSectorJa: string | null;
  sswFieldJa: string | null;
  sswSectorId: string | null;
  sswFieldId: string | null;
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
  interviewStatus: string | null;
  profileStatus: string;
  isLocked: boolean;
  consentGiven: boolean;
  completeness: Completeness;
  // Masked
  email: MaskedField;
  phone: MaskedField;
  address: MaskedField;
  // Relations
  bodyCheck: RecruiterBodyCheck | null;
  videos: RecruiterVideo[];
  tests: RecruiterTest[];
  weeklyTests: RecruiterWeeklyTest[];
  career: RecruiterCareerEntry[];
  tools: Array<{ id: string; name: string | null; nameJa: string | null }>;
}

export interface InterviewProposalData {
  id: string;
  batchCandidateId: string;
  proposedBy: string | null;
  proposedDates: string[] | null;
  finalDate: string | null;
  status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface RecruiterBatchCandidate {
  id: string;
  batchId: string;
  candidateId: string;
  isSelected: boolean;
  isConfirmed: boolean;
  selectedAt: string | null;
  confirmedAt: string | null;
  candidate: RecruiterCandidate;
  proposal: InterviewProposalData | null;
}

export interface RecruiterBatch {
  id: string;
  batchCode: string | null;
  name: string | null;
  quotaTotal: number | null;
  interviewCandidateLimit: number | null;
  status: string;
  expiryDate: string | null;
  company: { id: string; name: string; nameJa: string | null };
  selectedCount: number;
  confirmedCount: number;
}

export interface RecruiterBatchResponse {
  batch: RecruiterBatch;
  candidates: RecruiterBatchCandidate[];
}
