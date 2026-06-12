export type UserRole = 'candidate' | 'admin' | 'manager' | 'recruiter' | 'super_admin' | 'reviewer';

// ── JRAS (Japan Readiness Assessment System) ─────────────────────────────────

export type JrasDimensionKey =
  | 'language'     // D1 — otomatis dari data JP learning / weekly tests / JLPT
  | 'culture'      // D2 — SJT budaya & etika kerja
  | 'legal'        // D3 — kepatuhan aturan & hukum
  | 'psych'        // D4 — kesiapan psikologis (sensitif)
  | 'finance'      // D5 — literasi keuangan & risiko utang (sensitif)
  | 'motivation'   // D6 — motivasi & dukungan sosial
  | 'observation'; // D7 — observasi LPK

export const JRAS_DIMENSION_KEYS: JrasDimensionKey[] = [
  'language', 'culture', 'legal', 'psych', 'finance', 'motivation', 'observation',
];

export type JrasInstrumentType = 'sjt' | 'likert' | 'quiz' | 'observation';
export type JrasInstrumentStatus = 'draft' | 'in_review' | 'approved' | 'active' | 'retired';
export type JrasItemType = 'sjt' | 'likert' | 'quiz';
export type JrasReviewerType = 'ex_ssw' | 'jp_hr' | 'expert';
export type JrasReviewVerdict = 'approve' | 'request_changes';

export interface JrasItemOption {
  labelId: string;
  labelJa: string;
}

export interface JrasItemScoring {
  scoringType: 'weighted' | 'keyed' | 'likert';
  /** weighted: bobot 0–1 per pilihan, indeks sejajar dengan options */
  weights?: number[];
  /** keyed (quiz): indeks pilihan yang benar */
  correctIndex?: number;
  /** likert: true bila skala dibalik (jawaban tinggi = risiko) */
  reverse?: boolean;
  /** wajib untuk SJT — alasan pembobotan, diverifikasi reviewer */
  rationale?: string;
}

/** Kuota persetujuan review sebelum instrumen bisa diaktifkan */
export interface JrasReviewQuota {
  ex_ssw: number;
  jp_hr: number;
}

export const JRAS_DEFAULT_REVIEW_QUOTA: JrasReviewQuota = { ex_ssw: 2, jp_hr: 1 };

export type ProfileStatus =
  | 'incomplete'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'confirmed'
  | 'rejected'
  | 'hired';

export type BatchStatus = 'draft' | 'active' | 'selection' | 'approved' | 'closed';

export type InterviewStatus = 'scheduled' | 'pass' | 'fail' | 'on_hold' | 'cancelled';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  companyId: string | null;
  lpkId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCandidate {
  id: string;
  candidateCode: string;
  userId: string | null;
  lpkId: string | null;
  profileStatus: ProfileStatus;
  isLocked: boolean;
  consentGiven: boolean;
  consentGivenAt: string | null;
  fullName: string;
  gender: 'M' | 'F' | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  eduLevel: string | null;
  eduLabel: string | null;
  eduMajor: string | null;
  jobCategory: string | null;
  sswKubun: 'SSW1' | 'SSW2' | 'Trainee' | null;
  sswSectorJa: string | null;
  sswFieldJa: string | null;
  sswSectorId: string | null;
  sswFieldId: string | null;
  jpStudyDuration: string | null;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | null;
  spouseInfo: string | null;
  childrenCount: number;
  accompany: 'none' | 'yes';
  workplanDuration: string | null;
  workplanGoal: string | null;
  workplanAfter: string | null;
  workplanExpectation: string | null;
  workplanUpdated: string | null;
  closeupUrl: string | null;
  fullbodyUrl: string | null;
  interviewStatus: InterviewStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface MfaRequiredResponse {
  requiresMfa: true;
}

export interface ApiError {
  error: string;
  message?: string;
}
