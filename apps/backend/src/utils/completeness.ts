export type CompletenessMode = 'legacy' | 'cv';

let _mode: CompletenessMode = 'legacy';

export function setCompletenessMode(mode: CompletenessMode): void {
  _mode = mode;
}

export function getCompletenessMode(): CompletenessMode {
  return _mode;
}

export interface CompletenessResult {
  score: number;
  total: number;
  pct: number;
}

function calcLegacy(candidate: Record<string, unknown>): CompletenessResult {
  const career = candidate['career'] as unknown[];
  const tests  = candidate['tests']  as unknown[];

  const checks = [
    // Personal (8)
    !!candidate['fullName'],
    !!candidate['gender'],
    !!candidate['dateOfBirth'],
    !!candidate['heightCm'],
    !!candidate['weightKg'],
    !!candidate['email'],
    !!candidate['phone'],
    !!candidate['address'],
    // SSW (4)
    !!candidate['jobCategory'],
    !!candidate['sswKubun'],
    !!candidate['sswFieldId'],
    !!candidate['jpStudyDuration'],
    // Education (2)
    !!candidate['eduLevel'],
    !!candidate['eduMajor'],
    // Career (1)
    (career?.length ?? 0) > 0,
    // Japanese test (1)
    (tests?.length ?? 0) > 0,
    // Work plan (4)
    !!candidate['workplanDuration'],
    !!candidate['workplanGoal'],
    !!candidate['workplanAfter'],
    !!candidate['workplanExpectation'],
    // Photos (2)
    !!candidate['closeupUrl'],
    !!candidate['fullbodyUrl'],
    // Consent (1)
    !!candidate['consentGiven'],
    // LPK assignment (1)
    !!candidate['lpkId'],
  ];

  const score = checks.filter(Boolean).length;
  const total = checks.length; // 24
  return { score, total, pct: Math.round((score / total) * 100) };
}

function calcCV(candidate: Record<string, unknown>): CompletenessResult {
  const career    = candidate['career']           as unknown[];
  const tests     = candidate['tests']            as unknown[];
  const education = candidate['educationHistory'] as unknown[];

  const checks = [
    // Personal visible on CV (14)
    !!candidate['fullName'],
    !!candidate['nameKatakana'],
    !!candidate['gender'],
    !!candidate['dateOfBirth'],
    !!candidate['birthPlace'],
    !!candidate['religion'],
    !!candidate['bloodType'],
    !!candidate['maritalStatus'],
    !!(candidate['selfReportedHeight'] ?? candidate['heightCm']),
    !!(candidate['selfReportedWeight'] ?? candidate['weightKg']),
    !!candidate['address'],
    candidate['hasVisitedJapan'] != null,
    candidate['hasPassport'] != null,
    !!candidate['hobbies'],
    // Education history (1)
    (education?.length ?? 0) > 0,
    // Career (1)
    (career?.length ?? 0) > 0,
    // Japanese test (1)
    (tests?.length ?? 0) > 0,
    // CV text fields (3)
    !!candidate['selfPrId'],
    !!candidate['motivationId'],
    !!candidate['selfIntroId'],
    // Photos (2)
    !!candidate['closeupUrl'],
    !!candidate['fullbodyUrl'],
    // Consent (1)
    !!candidate['consentGiven'],
    // LPK assignment (1)
    !!candidate['lpkId'],
  ];

  const score = checks.filter(Boolean).length;
  const total = checks.length; // 24
  return { score, total, pct: Math.round((score / total) * 100) };
}

export function calcCompleteness(candidate: Record<string, unknown>): CompletenessResult {
  return _mode === 'cv' ? calcCV(candidate) : calcLegacy(candidate);
}
