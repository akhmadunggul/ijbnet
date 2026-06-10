import { QueryTypes, Sequelize } from 'sequelize';

/**
 * Critical columns that have caused production outages when missing.
 * Each entry maps a table name to the columns that must exist.
 * Add an entry here every time a new column bug is fixed.
 *
 * Regression coverage:
 *  v0.8.4 — meetingLink missing from interview_proposals (wrong snake_case name in migration)
 *  v0.7.26 — recruiterDecision, decisionDeadline (migration 000046)
 *  v0.7.14 — addressStructured (migration 000043)
 */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  interview_proposals: [
    'id', 'batchCandidateId', 'proposedDates', 'candidatePreferredDate',
    'finalDate', 'status', 'meetingLink',
    'recruiterDecision', 'recruiterDecisionAt', 'decisionDeadline',
  ],
  candidates: [
    'id', 'userId', 'profileStatus', 'consentGiven', 'lpkId',
    'closeupUrl', 'fullbodyUrl',
    'selfReportedHeight', 'selfReportedWeight',
    'addressStructured',
    'nikEncrypted',
  ],
  batch_candidates: ['id', 'batchId', 'candidateId', 'isSelected', 'isConfirmed'],
  batches: ['id', 'companyId', 'status', 'quotaTotal', 'interviewCandidateLimit'],
  users: ['id', 'role', 'email', 'isActive', 'lpkId', 'companyId'],
  audit_logs: ['id', 'userId', 'action', 'entityType', 'entityId', 'targetCandidateId'],
  global_settings: ['id', 'key', 'value'],
};

interface ColumnRow { Field: string }

export async function checkDbSchema(sequelize: Sequelize): Promise<void> {
  const errors: string[] = [];

  for (const [table, expectedCols] of Object.entries(REQUIRED_COLUMNS)) {
    let actualCols: string[];
    try {
      const rows = await sequelize.query<ColumnRow>(
        `SHOW COLUMNS FROM \`${table}\``,
        { type: QueryTypes.SELECT },
      );
      actualCols = rows.map((r) => r.Field);
    } catch {
      errors.push(`[schemaCheck] Table '${table}' not found in DB.`);
      continue;
    }

    for (const col of expectedCols) {
      if (!actualCols.includes(col)) {
        errors.push(`[schemaCheck] Missing column: ${table}.${col}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n╔══════════════════════════════════════════════════════╗');
    console.error('║   DB SCHEMA CHECK FAILED — migrations not applied?  ║');
    console.error('╚══════════════════════════════════════════════════════╝');
    errors.forEach((e) => console.error('  ✗', e));
    console.error('\nRun: docker compose exec backend npx sequelize-cli db:migrate\n');
    process.exit(1);
  }

  console.log('[schemaCheck] ✓ DB schema OK');
}
