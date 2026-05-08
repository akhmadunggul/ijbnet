export type UserRole = 'candidate' | 'admin' | 'manager' | 'recruiter' | 'super_admin';

export type ProfileStatus =
  | 'incomplete'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'confirmed'
  | 'rejected';

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
