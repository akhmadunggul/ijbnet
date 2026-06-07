import { z } from 'zod';
import type { Response } from 'express';

// ── Shared primitives ─────────────────────────────────────────────────────────
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
const shortStr = (max: number) => z.string().max(max);
const longStr  = (max: number) => z.string().max(max);
// Trim + uppercase for roman (Indonesian) text fields stored in the DB
const upperStr = (max: number) => z.string().max(max).transform(s => s.trim().toUpperCase());

// ── PATCH /candidates/me ──────────────────────────────────────────────────────
// Explicit allowlist — .strict() rejects any key not listed here.
// Replaces the BLOCKED_FIELDS denylist which allowed unknown sub-keys to pass.
export const patchMeSchema = z.object({
  // Identity
  fullName:            z.string().min(1).max(200).transform(s => s.trim().toUpperCase()),
  nameKatakana:        shortStr(200).nullable(),
  gender:              z.enum(['M', 'F']).nullable(),
  dateOfBirth:         isoDate.nullable(),
  birthPlace:          upperStr(100).nullable(),
  religion:            z.enum(['Islam', 'Kristen', 'Katolik', 'Budha', 'Hindu', 'Lainnya']).nullable(),
  bloodType:           z.enum(['A', 'B', 'AB', 'O', 'A+', 'B+', 'AB+', 'O+', 'Unknown']).nullable(),
  maritalStatus:       z.enum(['single', 'married', 'divorced', 'widowed']).nullable(),
  spouseInfo:          upperStr(200).nullable(),
  childrenCount:       z.number().int().min(0).max(20),
  accompany:           z.enum(['none', 'yes']),
  phone:               shortStr(30).nullable(),
  address:             upperStr(500).nullable(),
  addressStructured: z.object({
    provinsiId:    shortStr(10),
    provinsiName:  shortStr(100),
    kotaId:        shortStr(10),
    kotaName:      shortStr(100),
    kecamatanId:   shortStr(10),
    kecamatanName: shortStr(100),
    kelurahanId:   shortStr(10),
    kelurahanName: shortStr(100),
    jalan:         shortStr(500),
    rtRw:          shortStr(50),
    kodePos:       shortStr(10),
  }).nullable(),
  hobbies:             upperStr(500).nullable(),
  bankName:            upperStr(100).nullable(),
  hasPassport:         z.boolean().nullable(),
  hasVisitedJapan:     z.boolean().nullable(),
  hasPoliceRecord:     z.boolean().nullable(),
  // Physical
  heightCm:            z.number().int().min(0).max(300).nullable(),
  weightKg:            z.number().int().min(0).max(500).nullable(),
  selfReportedHeight:  z.number().int().min(0).max(300).nullable(),
  selfReportedWeight:  z.number().int().min(0).max(500).nullable(),
  // SSW/Program
  sswKubun:            z.enum(['SSW1', 'SSW2', 'Trainee']).nullable(),
  sswSectorId:         shortStr(100).nullable(),
  sswSectorJa:         shortStr(100).nullable(),
  sswFieldId:          shortStr(100).nullable(),
  sswFieldJa:          shortStr(100).nullable(),
  jpStudyDuration:     upperStr(100).nullable(),
  jobCategory:         upperStr(100).nullable(),
  // Education (top-level summary only; history uses /education-history)
  eduLevel:            upperStr(50).nullable(),
  eduLabel:            upperStr(200).nullable(),
  eduMajor:            upperStr(200).nullable(),
  // PR & Motivation
  selfIntroId:         longStr(3000).nullable(),
  selfIntroJa:         longStr(3000).nullable(),
  motivationId:        longStr(3000).nullable(),
  motivationJa:        longStr(3000).nullable(),
  selfPrId:            longStr(3000).nullable(),
  selfPrJa:            longStr(3000).nullable(),
  applyReasonId:       longStr(3000).nullable(),
  applyReasonJa:       longStr(3000).nullable(),
  // Workplan
  workplanDuration:    shortStr(100).nullable(),
  workplanGoal:        longStr(3000).nullable(),
  workplanAfter:       longStr(3000).nullable(),
  workplanExpectation: longStr(3000).nullable(),
  // LPK assignment — allowed once (enforced in route logic)
  lpkId:               z.string().uuid().nullable(),
}).partial().strict();

export type PatchMeBody = z.infer<typeof patchMeSchema>;

// ── PUT /candidates/me/career ─────────────────────────────────────────────────
const careerEntrySchema = z.object({
  companyName:               upperStr(200).nullable(),
  companyBusinessActivity:   longStr(2000).nullable(),
  companyBusinessActivityJa: longStr(2000).nullable(),
  division:                  upperStr(200).nullable(),
  divisionJa:   shortStr(200).nullable(),
  skillGroup:   upperStr(200).nullable(),
  skillGroupJa: shortStr(200).nullable(),
  period:       upperStr(50).nullable(),
  startDate:    isoDate.nullable(),
  endDate:      isoDate.nullable(),
  sortOrder:    z.number().int().min(0).max(9999),
}).partial().strict();

export const putCareerSchema = z.object({
  entries: z.array(careerEntrySchema).max(50),
});

// ── PUT /candidates/me/certifications ─────────────────────────────────────────
const certEntrySchema = z.object({
  certName:   upperStr(200).nullable(),
  certLevel:  upperStr(50).nullable(),
  issuedDate: isoDate.nullable(),
  issuedBy:   upperStr(200).nullable(),
}).partial({ certLevel: true, issuedDate: true, issuedBy: true }).strict();

export const putCertSchema = z.object({
  entries: z.array(certEntrySchema).max(50),
});

// ── PUT /candidates/me/education-history ──────────────────────────────────────
const eduEntrySchema = z.object({
  schoolName: upperStr(200).nullable(),
  major:      upperStr(200).nullable(),
  startDate:  isoDate.nullable(),
  endDate:    isoDate.nullable(),
  status:     shortStr(50).nullable(),
  sortOrder:  z.number().int().min(0).max(9999),
}).partial({ major: true, startDate: true, endDate: true, status: true, sortOrder: true }).strict();

export const putEduSchema = z.object({
  entries: z.array(eduEntrySchema).max(50),
});

// ── PUT /candidates/me/tests ──────────────────────────────────────────────────
const isPastOrToday = (d: string) => d <= new Date().toISOString().slice(0, 10);

const testEntrySchema = z.object({
  testName: shortStr(100).nullable(),
  score:    z.number().int().min(0).max(999).nullable(),
  pass:     z.boolean().nullable(),
  testDate: isoDate.refine(isPastOrToday, { message: 'Test date cannot be in the future' }).nullable(),
}).partial().strict();

export const putTestSchema = z.object({
  entries: z.array(testEntrySchema).max(20),
});

// ── PATCH /candidates/me/shokumu ──────────────────────────────────────────────
const shokumuCareerEntrySchema = z.object({
  id:             z.string().uuid(),
  companyType:    shortStr(100).nullable(),
  employeeCount:  z.number().int().min(0).max(999_999).nullable(),
  annualSales:    shortStr(100).nullable(),
  capitalAmount:  shortStr(100).nullable(),
  dutiesId:       longStr(3000).nullable(),
  dutiesJa:       longStr(3000).nullable(),
  achievementsId: longStr(3000).nullable(),
  achievementsJa: longStr(3000).nullable(),
  productId:      longStr(1000).nullable(),
  productJa:      longStr(1000).nullable(),
  jobTitleId:     shortStr(255).nullable(),
  jobTitleJa:     shortStr(255).nullable(),
  memberRoleId:   longStr(1000).nullable(),
  memberRoleJa:   longStr(1000).nullable(),
}).partial({ companyType: true, employeeCount: true, annualSales: true, capitalAmount: true,
             dutiesId: true, dutiesJa: true, achievementsId: true, achievementsJa: true,
             productId: true, productJa: true, jobTitleId: true, jobTitleJa: true,
             memberRoleId: true, memberRoleJa: true }).strict();

export const patchShokumuSchema = z.object({
  careerSummaryId: longStr(400).nullable(),
  careerSummaryJa: longStr(250).nullable(),
  career:          z.array(shokumuCareerEntrySchema).max(50),
}).partial().strict();

// ── PATCH /candidates/me/gakken-resume ────────────────────────────────────────
const gakkenCompanyEntrySchema = z.object({
  period:       shortStr(50).nullable(),
  productId:    longStr(1000).nullable(),
  productJa:    longStr(1000).nullable(),
  dutiesId:     longStr(3000).nullable(),
  dutiesJa:     longStr(3000).nullable(),
  memberRoleId: longStr(1000).nullable(),
  memberRoleJa: longStr(1000).nullable(),
  sortOrder:    z.number().int().min(0).max(9999),
}).partial().strict();

export const patchGakkenResumeSchema = z.object({
  careerSummary:           longStr(2000).nullable(),
  careerSummaryJa:         longStr(2000).nullable(),
  currentCompanyName:      shortStr(255).nullable(),
  currentBusinessActivity: longStr(2000).nullable(),
  currentCapital:          shortStr(100).nullable(),
  currentRevenue:          shortStr(100).nullable(),
  currentEmployeeCount:    z.number().int().min(0).max(9_999_999).nullable(),
  skills:                  longStr(3000).nullable(),
  skillsJa:                longStr(3000).nullable(),
  selfPr:                  longStr(3000).nullable(),
  selfPrJa:                longStr(3000).nullable(),
  companies:               z.array(gakkenCompanyEntrySchema).max(20),
}).partial().strict();

// ── Validation helper ─────────────────────────────────────────────────────────
/**
 * Parse `body` against `schema`. On failure, writes a 422 response and returns null.
 * The caller should check `if (parsed === null) return;` immediately after.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
  res: Response,
): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(422).json({ error: 'INVALID_INPUT', details: result.error.flatten() });
    return null;
  }
  return result.data;
}
