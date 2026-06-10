import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { signAccessToken } from '../../utils/jwt';
import { sequelize } from '../../db/connection';
import {
  User, Lpk, Company, Candidate, Batch, BatchCandidate, Notification,
  InterviewProposal, AuditLog, CandidateTimeline,
} from '../../db/models/index';

// ── Token factory ─────────────────────────────────────────────────────────────
export function makeToken(userId: string, role: string): string {
  return signAccessToken({ sub: userId, role, email: `${role}@test.ijbnet`, mfaVerified: true });
}

// ── Seed helpers ──────────────────────────────────────────────────────────────
export async function seedLpk(overrides: Partial<{ id: string; name: string }> = {}) {
  return Lpk.create({ id: uuidv4(), name: 'Test LPK', address: 'Jakarta', isActive: true, ...overrides });
}

export async function seedCompany(overrides: Partial<{ id: string; name: string }> = {}) {
  return Company.create({ id: uuidv4(), name: 'Test Co', nameJa: 'テスト', isActive: true, ...overrides });
}

export async function seedUser(role: string, extra: Record<string, unknown> = {}) {
  const hash = await bcrypt.hash('Test1234!', 1); // low rounds for speed
  return User.create({
    id: uuidv4(),
    email: `${role}-${uuidv4().slice(0, 8)}@test.ijbnet`,
    name: `Test ${role}`,
    passwordHash: hash,
    role,
    isActive: true,
    googleId: null,
    avatarUrl: null,
    mfaSecret: null,
    companyId: null,
    lpkId: null,
    lastLoginAt: null,
    deactivatedAt: null,
    ...extra,
  });
}

export async function seedCandidate(userId: string, lpkId: string, overrides: Record<string, unknown> = {}) {
  return Candidate.create({
    id: uuidv4(),
    userId,
    lpkId,
    fullName: 'Test Candidate',
    candidateCode: `TC-${Date.now()}`,
    profileStatus: 'approved',
    consentGiven: true,
    consentTimestamp: new Date(),
    ...overrides,
  });
}

export async function seedBatch(companyId: string, lpkId: string, overrides: Record<string, unknown> = {}) {
  return Batch.create({
    id: uuidv4(),
    companyId,
    lpkId,
    status: 'selection',
    quota: 5,
    name: 'Test Batch',
    sswFieldId: null,
    ...overrides,
  });
}

export async function seedBatchCandidate(
  batchId: string,
  candidateId: string,
  overrides: Record<string, unknown> = {},
) {
  return BatchCandidate.create({
    id: uuidv4(),
    batchId,
    candidateId,
    isSelected: true,
    isConfirmed: true,
    selectedAt: new Date(),
    confirmedAt: new Date(),
    ...overrides,
  });
}

// ── Full base seed ─────────────────────────────────────────────────────────────
// Returns everything needed for interview flow tests.
export async function seedBase() {
  const lpk      = await seedLpk();
  const company  = await seedCompany();
  const recruiterUser = await seedUser('recruiter', { companyId: company.id });
  const managerUser   = await seedUser('manager');
  const adminUser     = await seedUser('admin', { lpkId: lpk.id });
  const candidateUser = await seedUser('candidate');
  const candidate     = await seedCandidate(candidateUser.id, lpk.id);
  const batch         = await seedBatch(company.id, lpk.id);
  const bc            = await seedBatchCandidate(batch.id, candidate.id);

  return { lpk, company, recruiterUser, managerUser, adminUser, candidateUser, candidate, batch, bc };
}

// ── Table cleanup ─────────────────────────────────────────────────────────────
// Truncates all test-sensitive tables in correct FK order.
export async function truncateTables(): Promise<void> {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of [
    'interview_proposals', 'notifications', 'audit_logs', 'candidate_timelines',
    'batch_candidates', 'batches', 'candidates', 'users', 'lpks', 'companies',
  ]) {
    await sequelize.query(`TRUNCATE TABLE \`${table}\``);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

// ── Notification query helper ─────────────────────────────────────────────────
export async function getNotifRecipients(referenceId: string): Promise<string[]> {
  const notifs = await Notification.findAll({ where: { referenceId } });
  return notifs.map((n) => (n.toJSON() as Record<string, unknown>)['userId'] as string);
}
