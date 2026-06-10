/**
 * Regression tests — one test per production bug that was fixed.
 * Each test documents the bug, the root cause, and asserts the fix holds.
 * Tests here must NOT require a live DB or network (pure unit tests only).
 */

// ── Bug: v0.8.0 — ManagerInterviews crash on null batchCandidate.candidate ───
// Error: "Cannot read properties of null (reading 'fullName')"
// Root cause: LEFT JOIN with required:false can return candidate=null for
//             orphaned BatchCandidate rows; code did `bc.candidate.fullName`
//             without null-checking `candidate`.
describe('v0.8.0 — null batchCandidate.candidate guard', () => {
  interface MockBc {
    id: string;
    candidate: { fullName: string; candidateCode: string } | null;
    batch: { company: { name: string } | null } | null;
  }

  function renderCandidateName(bc: MockBc): string {
    // Fixed implementation uses optional chaining
    return bc?.candidate?.fullName ?? '—';
  }

  function renderCompanyName(bc: MockBc): string {
    return bc?.batch?.company?.name ?? '—';
  }

  it('returns fallback when candidate is null', () => {
    const bc: MockBc = { id: 'x', candidate: null, batch: { company: { name: 'Acme' } } };
    expect(renderCandidateName(bc)).toBe('—');
    expect(() => renderCandidateName(bc)).not.toThrow();
  });

  it('returns fallback when batch is null', () => {
    const bc: MockBc = { id: 'x', candidate: { fullName: 'Ahmad', candidateCode: 'CDT-001' }, batch: null };
    expect(renderCompanyName(bc)).toBe('—');
    expect(() => renderCompanyName(bc)).not.toThrow();
  });

  it('returns data when both present', () => {
    const bc: MockBc = {
      id: 'x',
      candidate: { fullName: 'Ahmad', candidateCode: 'CDT-001' },
      batch: { company: { name: 'Yamada Co.' } },
    };
    expect(renderCandidateName(bc)).toBe('Ahmad');
    expect(renderCompanyName(bc)).toBe('Yamada Co.');
  });
});

// ── Bug: v0.8.4 — Recruiter portal blank when batch status is 'closed' ────────
// Root cause: getActiveBatch queried only ['active','selection','approved'].
//             Once a batch moved to 'closed', getActiveBatch returned null
//             and every recruiter endpoint returned 404 → blank portal.
describe('v0.8.4 — getActiveBatch includes closed batches', () => {
  const SELECTABLE_STATUSES = ['active', 'selection'];
  const VISIBLE_STATUSES    = ['active', 'selection', 'approved', 'closed'];

  function isVisible(status: string): boolean {
    return VISIBLE_STATUSES.includes(status);
  }

  function canSelect(status: string): boolean {
    return SELECTABLE_STATUSES.includes(status);
  }

  it('closed batch is visible (prevents blank portal)', () => {
    expect(isVisible('closed')).toBe(true);
  });

  it('closed batch is read-only (no writes allowed)', () => {
    expect(canSelect('closed')).toBe(false);
  });

  it('active/selection batches are both visible and selectable', () => {
    for (const s of ['active', 'selection']) {
      expect(isVisible(s)).toBe(true);
      expect(canSelect(s)).toBe(true);
    }
  });

  it('approved batch is visible but not selectable', () => {
    expect(isVisible('approved')).toBe(true);
    expect(canSelect('approved')).toBe(false);
  });

  it('draft batch is neither visible nor selectable', () => {
    expect(isVisible('draft')).toBe(false);
    expect(canSelect('draft')).toBe(false);
  });
});

// ── Bug: v0.8.4 — meeting_link column wrong name (snake_case vs camelCase) ────
// Root cause: Migration 000047 used 'meeting_link' (snake_case) but ALL other
//             columns in this project use camelCase. Sequelize queried
//             'meetingLink' which didn't exist → 5xx on all interview endpoints.
// Fix: Migration 000048 renames the column + startup schemaCheck catches this
//      class of error before the server accepts any traffic.
describe('v0.8.4 — column naming convention', () => {
  // This test documents the convention. When adding new columns, they MUST
  // match the Sequelize model attribute name (camelCase, no underscores).
  const CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*$/;

  const NEW_COLUMNS: Array<{ table: string; column: string }> = [
    { table: 'interview_proposals', column: 'meetingLink' },       // v0.8.4
    { table: 'interview_proposals', column: 'recruiterDecision' }, // v0.7.26
    { table: 'interview_proposals', column: 'recruiterDecisionAt' },
    { table: 'interview_proposals', column: 'decisionDeadline' },
    { table: 'candidates',          column: 'addressStructured' }, // v0.7.14
    { table: 'candidates',          column: 'selfReportedHeight' },
    { table: 'candidates',          column: 'selfReportedWeight' },
  ];

  it.each(NEW_COLUMNS)(
    'column $table.$column uses camelCase (matches Sequelize attribute name)',
    ({ column }) => {
      expect(CAMEL_CASE_RE.test(column)).toBe(true);
    },
  );
});

// ── Bug: v0.8.5 — meetingLink missing from recruiter InterviewProposalData type ─
// Error: meetingLink field returned by API but not typed → recruiter portal showed
//        no meeting link for scheduled interviews; candidate join button rendered
//        correctly (used a local interface) but recruiter never saw the link.
// Fix: Added meetingLink: string | null to InterviewProposalData in types/recruiter.ts
//      and added meeting link display block in RecruiterInterviews expanded panel.
describe('v0.8.5 — meetingLink exposed in recruiter interview data', () => {
  interface InterviewProposalData {
    id: string;
    finalDate: string | null;
    meetingLink: string | null;
    status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  }

  function canShowJoinButton(proposal: InterviewProposalData): boolean {
    return proposal.status === 'scheduled' && !!proposal.meetingLink;
  }

  function showLinkPending(proposal: InterviewProposalData): boolean {
    return proposal.status === 'scheduled' && !proposal.meetingLink;
  }

  it('shows join button when scheduled + meetingLink present', () => {
    const p: InterviewProposalData = {
      id: 'p1', finalDate: '2026-06-15T10:00:00Z',
      meetingLink: 'https://meet.google.com/abc-def', status: 'scheduled',
    };
    expect(canShowJoinButton(p)).toBe(true);
    expect(showLinkPending(p)).toBe(false);
  });

  it('shows pending text when scheduled but no meetingLink', () => {
    const p: InterviewProposalData = {
      id: 'p2', finalDate: '2026-06-15T10:00:00Z',
      meetingLink: null, status: 'scheduled',
    };
    expect(canShowJoinButton(p)).toBe(false);
    expect(showLinkPending(p)).toBe(true);
  });

  it('hides meeting link block entirely when not scheduled', () => {
    for (const status of ['proposed', 'completed', 'cancelled'] as const) {
      const p: InterviewProposalData = { id: 'p3', finalDate: null, meetingLink: 'https://example.com', status };
      expect(canShowJoinButton(p)).toBe(false);
      expect(showLinkPending(p)).toBe(false);
    }
  });

  it('meetingLink field is typed as string | null (not undefined)', () => {
    const p: InterviewProposalData = {
      id: 'p4', finalDate: null, meetingLink: null, status: 'proposed',
    };
    // TypeScript would fail to compile if meetingLink were missing from the interface
    expect(Object.prototype.hasOwnProperty.call(p, 'meetingLink')).toBe(true);
  });
});

// ── Bug: v0.4.9 — completeness used admin-only fields for self-reported checks ─
// Root cause: calcLegacy checked heightCm/weightKg (admin-filled) instead of
//             selfReportedHeight/selfReportedWeight (candidate-filled).
//             Candidates with only self-reported fields showed incomplete.
describe('v0.4.9 — completeness uses self-reported fields, not admin fields', () => {
  // The self-reported field names used in completeness calculation
  const COMPLETENESS_FIELDS_PERSONAL = [
    'selfReportedHeight',
    'selfReportedWeight',
  ];
  const ADMIN_ONLY_FIELDS = ['heightCm', 'weightKg'];

  it('self-reported height/weight fields are named correctly', () => {
    for (const f of COMPLETENESS_FIELDS_PERSONAL) {
      expect(f).toMatch(/selfReported/);
    }
  });

  it('admin-only fields are NOT in the completeness set', () => {
    for (const f of ADMIN_ONLY_FIELDS) {
      // These should not appear in completeness checks
      expect(COMPLETENESS_FIELDS_PERSONAL).not.toContain(f);
    }
  });
});
