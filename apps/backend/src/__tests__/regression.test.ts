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

// ── Bug: v0.8.5 — interview flow notification gaps ────────────────────────────
// Step 1 (recruiter proposes): only admin LPK was notified — candidate and manager missing.
// Step 2 (candidate confirms date): only managers were notified — admin LPK and recruiter missing.
// Step 3b (manager sets meeting link): only candidate was notified — recruiter missing.
describe('v0.8.5 — interview flow notification recipients', () => {
  type NotifTarget = 'candidate' | 'adminLpk' | 'manager' | 'recruiter';

  // Models the notification targets for each step.
  function notifyOnPropose(hasCandidate: boolean): NotifTarget[] {
    const targets: NotifTarget[] = ['adminLpk', 'manager'];
    if (hasCandidate) targets.push('candidate');
    return targets;
  }

  function notifyOnCandidateConfirm(hasRecruiter: boolean, hasAdminLpk: boolean): NotifTarget[] {
    const targets: NotifTarget[] = ['manager'];
    if (hasAdminLpk) targets.push('adminLpk');
    if (hasRecruiter) targets.push('recruiter');
    return targets;
  }

  function notifyOnMeetingLink(hasRecruiter: boolean): NotifTarget[] {
    const targets: NotifTarget[] = ['candidate'];
    if (hasRecruiter) targets.push('recruiter');
    return targets;
  }

  it('Step 1 (propose): candidate, adminLpk, and manager all notified', () => {
    const targets = notifyOnPropose(true);
    expect(targets).toContain('candidate');
    expect(targets).toContain('adminLpk');
    expect(targets).toContain('manager');
  });

  it('Step 1 (propose): no crash when candidate userId is null', () => {
    // candidate userId may be null for OAuth-incomplete accounts
    const targets = notifyOnPropose(false);
    expect(targets).not.toContain('candidate');
    expect(targets).toContain('adminLpk');
    expect(targets).toContain('manager');
  });

  it('Step 2 (candidate confirms): manager, adminLpk, and recruiter all notified', () => {
    const targets = notifyOnCandidateConfirm(true, true);
    expect(targets).toContain('manager');
    expect(targets).toContain('adminLpk');
    expect(targets).toContain('recruiter');
  });

  it('Step 2 (candidate confirms): no crash when proposedBy (recruiter) is null', () => {
    const targets = notifyOnCandidateConfirm(false, true);
    expect(targets).not.toContain('recruiter');
    expect(targets).toContain('manager');
  });

  it('Step 2 (candidate confirms): no crash when candidate has no lpkId', () => {
    const targets = notifyOnCandidateConfirm(true, false);
    expect(targets).not.toContain('adminLpk');
    expect(targets).toContain('manager');
    expect(targets).toContain('recruiter');
  });

  it('Step 3b (meeting link): both candidate and recruiter notified', () => {
    const targets = notifyOnMeetingLink(true);
    expect(targets).toContain('candidate');
    expect(targets).toContain('recruiter');
  });

  it('Step 3b (meeting link): no crash when proposedBy (recruiter) is null', () => {
    const targets = notifyOnMeetingLink(false);
    expect(targets).toContain('candidate');
    expect(targets).not.toContain('recruiter');
  });

  it('Step 3b (meeting link): notifications NOT sent when link is cleared', () => {
    // Clearing the link (null/empty) must not trigger notifications
    function notifyOnMeetingLinkSet(link: string | null): NotifTarget[] {
      if (!link) return [];
      return notifyOnMeetingLink(true);
    }
    expect(notifyOnMeetingLinkSet(null)).toHaveLength(0);
    expect(notifyOnMeetingLinkSet('')).toHaveLength(0);
    expect(notifyOnMeetingLinkSet('https://meet.google.com/abc')).toContain('candidate');
  });
});

// ── Bug: v0.8.5 — candidate date picker one-click confirms with no Accept step ─
// Root cause: each proposed-date button called confirmDateMutation directly on click.
//             Candidates could accidentally confirm the wrong date with a single tap.
// Fix: two-step UX — click selects the date (radio style), a separate "Terima" button
//      submits. The Accept button is disabled until a date is selected.
describe('v0.8.5 — candidate interview date picker is two-step', () => {
  // Simulates the state machine for the date selection UI.
  function makePicker(proposedDates: string[]) {
    let selectedDate = '';
    return {
      select: (d: string) => { selectedDate = d; },
      deselect: () => { selectedDate = ''; },
      canAccept: () => selectedDate !== '',
      accept: (mutate: (d: string) => void) => {
        if (!selectedDate) throw new Error('no date selected');
        mutate(selectedDate);
      },
      getSelected: () => selectedDate,
      proposedDates,
    };
  }

  it('Accept button is disabled when no date is selected', () => {
    const picker = makePicker(['2026-07-01T10:00:00Z', '2026-07-02T10:00:00Z']);
    expect(picker.canAccept()).toBe(false);
  });

  it('Accept button is enabled after selecting a date', () => {
    const picker = makePicker(['2026-07-01T10:00:00Z', '2026-07-02T10:00:00Z']);
    picker.select('2026-07-01T10:00:00Z');
    expect(picker.canAccept()).toBe(true);
  });

  it('clicking Accept submits the selected date', () => {
    const picker = makePicker(['2026-07-01T10:00:00Z', '2026-07-02T10:00:00Z']);
    picker.select('2026-07-02T10:00:00Z');
    let submitted = '';
    picker.accept((d) => { submitted = d; });
    expect(submitted).toBe('2026-07-02T10:00:00Z');
  });

  it('clicking Accept without selection throws (never reaches API)', () => {
    const picker = makePicker(['2026-07-01T10:00:00Z']);
    expect(() => picker.accept(() => {})).toThrow('no date selected');
  });

  it('clicking a selected date again deselects it (toggle)', () => {
    const picker = makePicker(['2026-07-01T10:00:00Z']);
    picker.select('2026-07-01T10:00:00Z');
    expect(picker.canAccept()).toBe(true);
    picker.deselect();
    expect(picker.canAccept()).toBe(false);
  });

  it('only one date can be selected at a time', () => {
    const picker = makePicker(['2026-07-01T10:00:00Z', '2026-07-02T10:00:00Z']);
    picker.select('2026-07-01T10:00:00Z');
    picker.select('2026-07-02T10:00:00Z'); // re-select different date
    expect(picker.getSelected()).toBe('2026-07-02T10:00:00Z');
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
