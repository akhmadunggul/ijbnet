export interface CompletenessResult {
  score: number;
  total: number;
  pct: number;
}

export function calcCompleteness(candidate: Record<string, unknown>): CompletenessResult {
  const career = candidate['career'] as unknown[];
  const tests = candidate['tests'] as unknown[];

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
  ];

  const score = checks.filter(Boolean).length;
  const total = checks.length; // 23
  return { score, total, pct: Math.round((score / total) * 100) };
}
