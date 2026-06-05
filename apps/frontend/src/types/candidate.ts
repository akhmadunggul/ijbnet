export interface Completeness {
  score: number;
  total: number;
  pct: number;
}

export interface JapaneseTest {
  id: string;
  testName: string | null;
  score: number | null;
  pass: boolean | null;
  testDate: string | null;
}

export interface WeeklyTest {
  id: string;
  courseName: string | null;
  weekNumber: number | null;
  score: number | null;
  testDate: string | null;
}

export interface CareerEntry {
  id?: string;
  companyName: string | null;
  companyBusinessActivity?: string | null;
  companyBusinessActivityJa?: string | null;
  division: string | null;
  divisionJa?: string | null;
  skillGroup: string | null;
  skillGroupJa?: string | null;
  period: string | null;
  startDate: string | null;
  sortOrder: number;
  companyType?: string | null;
  employeeCount?: number | null;
  annualSales?: string | null;
  capitalAmount?: string | null;
  dutiesId?: string | null;
  dutiesJa?: string | null;
  achievementsId?: string | null;
  achievementsJa?: string | null;
  productId?: string | null;
  productJa?: string | null;
  jobTitleId?: string | null;
  jobTitleJa?: string | null;
  memberRoleId?: string | null;
  memberRoleJa?: string | null;
}

export interface GakkenResume {
  id?: string;
  candidateId?: string;
  careerSummary: string | null;
  careerSummaryJa: string | null;
  currentCompanyName: string | null;
  currentBusinessActivity: string | null;
  currentCapital: string | null;
  currentRevenue: string | null;
  currentEmployeeCount: number | null;
  skills: string | null;
  skillsJa: string | null;
  selfPr: string | null;
  selfPrJa: string | null;
}

export interface GakkenCompanyEntry {
  period: string | null;
  productId: string | null;
  productJa: string | null;
  dutiesId: string | null;
  dutiesJa: string | null;
  memberRoleId: string | null;
  memberRoleJa: string | null;
  sortOrder: number;
}

export interface CertificationEntry {
  id?: string;
  certName: string;
  certLevel: string | null;
  issuedDate: string | null;
  issuedBy: string | null;
}

export interface EducationHistoryEntry {
  id?: string;
  schoolName: string;
  major: string | null;
  startDate: string | null;
  endDate: string | null;
  status?: string | null;
  sortOrder: number;
}

export interface CandidateData {
  id: string;
  candidateCode: string;
  profileStatus: string;
  isLocked: boolean;
  consentGiven: boolean;
  consentGivenAt: string | null;
  consentUpToDate: boolean;
  activeConsentClauseId: string | null;
  fullName: string;
  nameKatakana: string | null;
  gender: 'M' | 'F' | null;
  dateOfBirth: string | null;
  birthPlace: string | null;
  heightCm: number | null;
  weightKg: number | null;
  selfReportedHeight: number | null;
  selfReportedWeight: number | null;
  bloodType: 'A' | 'B' | 'AB' | 'O' | 'A+' | 'B+' | 'AB+' | 'O+' | 'Unknown' | null;
  religion: 'Islam' | 'Kristen' | 'Katolik' | 'Budha' | 'Hindu' | 'Lainnya' | null;
  hasVisitedJapan: boolean | null;
  hasPassport: boolean | null;
  hobbies: string | null;
  nik: string | null;
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
  selfPrId: string | null;
  selfPrJa: string | null;
  motivationId: string | null;
  motivationJa: string | null;
  applyReasonId: string | null;
  applyReasonJa: string | null;
  selfIntroId: string | null;
  selfIntroJa: string | null;
  careerSummaryId?: string | null;
  careerSummaryJa?: string | null;
  workplanDuration: string | null;
  workplanGoal: string | null;
  workplanAfter: string | null;
  workplanExpectation: string | null;
  lpkId: string | null;
  closeupUrl: string | null;
  fullbodyUrl: string | null;
  interviewStatus: string | null;
  completeness: Completeness;
  tests: JapaneseTest[];
  weeklyTests: WeeklyTest[];
  career: CareerEntry[];
  certifications: CertificationEntry[];
  educationHistory: EducationHistoryEntry[];
  videos: unknown[];
  tools: unknown[];
  bodyCheck: {
    verifiedHeight: number | null;
    verifiedWeight: number | null;
    overallResult: string | null;
    checkedDate: string | null;
  } | null;
}

export interface CandidateMe {
  candidate: CandidateData | null;
  isNewUser?: boolean;
}

export interface NotificationData {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  referenceType: string | null;
  referenceId: string | null;
}
