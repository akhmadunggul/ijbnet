/**
 * Integration tests — interview flow end-to-end.
 * Hits real Express routes against a real MySQL test DB (ijbnet_test).
 * Redis is mocked (no blacklist); email is skipped (SMTP_HOST='').
 */

// ── Mocks (hoisted before any import) ────────────────────────────────────────
jest.mock('../../utils/redis', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  blacklistToken:     jest.fn().mockResolvedValue(undefined),
  cacheGet:           jest.fn().mockResolvedValue(null),
  cacheSet:           jest.fn().mockResolvedValue(undefined),
  cacheDel:           jest.fn().mockResolvedValue(undefined),
  auditDebounced:     jest.fn().mockResolvedValue(false),
  connectRedis:       jest.fn().mockResolvedValue(undefined),
  redisClient:        { connect: jest.fn(), on: jest.fn() },
}));

// Telegram alerting — no real HTTP calls in tests
jest.mock('../../utils/alert', () => ({
  sendAlert: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

// ── Imports ───────────────────────────────────────────────────────────────────
import request from 'supertest';
import app from '../../app';
import { sequelize } from '../../db/connection';
import { Notification, InterviewProposal } from '../../db/models/index';
import {
  seedBase, truncateTables, makeToken, getNotifRecipients,
} from './helpers';

// ── Suite setup ───────────────────────────────────────────────────────────────
beforeAll(async () => { await sequelize.authenticate(); });
afterAll(async  () => { await sequelize.close(); });
beforeEach(async () => { await truncateTables(); });

// ─────────────────────────────────────────────────────────────────────────────
// Sequential flow: one shared context carries state across steps
// ─────────────────────────────────────────────────────────────────────────────
describe('Interview flow — happy path (steps 1 → 4)', () => {
  let ctx: Awaited<ReturnType<typeof seedBase>>;
  let proposalId: string;

  beforeEach(async () => {
    ctx = await seedBase();
  });

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  it('Step 1: recruiter proposes dates → 201 + candidate, manager, adminLPK notified', async () => {
    const token = makeToken(ctx.recruiterUser.id, 'recruiter');
    const dates = ['2026-09-01T10:00:00.000Z', '2026-09-02T10:00:00.000Z'];

    const res = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposedDates: dates });

    expect(res.status).toBe(201);
    expect(res.body.proposal.status).toBe('proposed');

    proposalId = res.body.proposal.id;

    const recipients = await getNotifRecipients(proposalId);
    expect(recipients).toContain(ctx.candidateUser.id);   // candidate notified
    expect(recipients).toContain(ctx.managerUser.id);     // manager notified
    expect(recipients).toContain(ctx.adminUser.id);       // admin LPK notified
  });

  // ── Step 2 ──────────────────────────────────────────────────────────────────
  it('Step 2: candidate confirms date → 200 + manager, adminLPK, recruiter notified', async () => {
    // First: propose
    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    const propRes = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z', '2026-09-02T10:00:00.000Z'] });
    expect(propRes.status).toBe(201);
    const pid = propRes.body.proposal.id;

    // Clear notifications from Step 1
    await Notification.destroy({ where: {} });

    // Now: candidate confirms
    const candidateToken = makeToken(ctx.candidateUser.id, 'candidate');
    const res = await request(app)
      .patch(`/api/candidates/me/interviews/${pid}/confirm-date`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ date: '2026-09-01T10:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(res.body.candidatePreferredDate).toBe('2026-09-01T10:00:00.000Z');

    const recipients = await getNotifRecipients(pid);
    expect(recipients).toContain(ctx.managerUser.id);     // manager notified
    expect(recipients).toContain(ctx.adminUser.id);       // admin LPK notified
    expect(recipients).toContain(ctx.recruiterUser.id);   // recruiter notified
  });

  // ── Step 3 ──────────────────────────────────────────────────────────────────
  it('Step 3: manager finalizes → 200 + status=scheduled + candidate, recruiter notified', async () => {
    // Propose
    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    const propRes = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });
    expect(propRes.status).toBe(201);
    const pid = propRes.body.proposal.id;

    await Notification.destroy({ where: {} });

    // Finalize
    const managerToken = makeToken(ctx.managerUser.id, 'manager');
    const res = await request(app)
      .patch(`/api/manager/interviews/${pid}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ finalDate: '2026-09-01T10:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('scheduled');

    const proposal = await InterviewProposal.findByPk(pid);
    expect(proposal?.status).toBe('scheduled');

    const recipients = await getNotifRecipients(pid);
    expect(recipients).toContain(ctx.candidateUser.id);   // candidate notified
    expect(recipients).toContain(ctx.recruiterUser.id);   // recruiter notified
  });

  // ── Step 4 ──────────────────────────────────────────────────────────────────
  it('Step 4: manager sets meeting link → 200 + meetingLink saved + candidate, recruiter notified', async () => {
    // Propose + finalize
    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    const propRes = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });
    expect(propRes.status).toBe(201);
    const pid = propRes.body.proposal.id;

    const managerToken = makeToken(ctx.managerUser.id, 'manager');
    await request(app)
      .patch(`/api/manager/interviews/${pid}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ finalDate: '2026-09-01T10:00:00.000Z' });

    await Notification.destroy({ where: {} });

    // Set meeting link
    const res = await request(app)
      .patch(`/api/manager/interviews/${pid}/meeting-link`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ meetingLink: 'https://meet.google.com/test-abc-xyz' });

    expect(res.status).toBe(200);
    expect(res.body.proposal.meetingLink).toBe('https://meet.google.com/test-abc-xyz');

    const proposal = await InterviewProposal.findByPk(pid);
    expect(proposal?.meetingLink).toBe('https://meet.google.com/test-abc-xyz');

    const recipients = await getNotifRecipients(pid);
    expect(recipients).toContain(ctx.candidateUser.id);   // candidate notified
    expect(recipients).toContain(ctx.recruiterUser.id);   // recruiter notified
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases + guard rails
// ─────────────────────────────────────────────────────────────────────────────
describe('Interview flow — edge cases', () => {
  let ctx: Awaited<ReturnType<typeof seedBase>>;

  beforeEach(async () => { ctx = await seedBase(); });

  it('clearing meeting link sends no notifications', async () => {
    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    const propRes = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });
    const pid = propRes.body.proposal.id;

    const managerToken = makeToken(ctx.managerUser.id, 'manager');
    await request(app)
      .patch(`/api/manager/interviews/${pid}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ finalDate: '2026-09-01T10:00:00.000Z' });
    await request(app)
      .patch(`/api/manager/interviews/${pid}/meeting-link`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ meetingLink: 'https://meet.google.com/test-abc-xyz' });

    await Notification.destroy({ where: {} });

    // Clear the link
    const res = await request(app)
      .patch(`/api/manager/interviews/${pid}/meeting-link`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ meetingLink: null });

    expect(res.status).toBe(200);
    expect(res.body.proposal.meetingLink).toBeNull();

    // No new notifications should have been sent
    const count = await Notification.count();
    expect(count).toBe(0);
  });

  it('candidate role cannot call recruiter propose endpoint → 403', async () => {
    const candidateToken = makeToken(ctx.candidateUser.id, 'candidate');
    const res = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });

    expect(res.status).toBe(403);
  });

  it('proposing more than 3 dates → 422', async () => {
    const token = makeToken(ctx.recruiterUser.id, 'recruiter');
    const res = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        proposedDates: [
          '2026-09-01T10:00:00.000Z',
          '2026-09-02T10:00:00.000Z',
          '2026-09-03T10:00:00.000Z',
          '2026-09-04T10:00:00.000Z',
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('TOO_MANY_DATES');
  });

  it('candidate confirming a date not in proposedDates → 400', async () => {
    // Propose
    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    const propRes = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });
    const pid = propRes.body.proposal.id;

    const candidateToken = makeToken(ctx.candidateUser.id, 'candidate');
    const res = await request(app)
      .patch(`/api/candidates/me/interviews/${pid}/confirm-date`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ date: '2026-10-15T10:00:00.000Z' }); // not in proposedDates

    expect(res.status).toBe(400);
  });

  it('setting non-HTTPS meeting link → 422', async () => {
    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    const propRes = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });
    const pid = propRes.body.proposal.id;

    const managerToken = makeToken(ctx.managerUser.id, 'manager');
    await request(app)
      .patch(`/api/manager/interviews/${pid}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ finalDate: '2026-09-01T10:00:00.000Z' });

    const res = await request(app)
      .patch(`/api/manager/interviews/${pid}/meeting-link`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ meetingLink: 'http://meet.google.com/not-https' }); // http not https

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INVALID_URL');
  });

  it('GET /api/recruiter/interviews returns proposals for a closed batch', async () => {
    // Set batch to closed
    await ctx.batch.update({ status: 'closed' });

    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    const res = await request(app)
      .get('/api/recruiter/interviews')
      .set('Authorization', `Bearer ${recruiterToken}`);

    // Should return 200 (not 404) even when batch is closed
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.proposals)).toBe(true);
  });

  it('GET /api/manager/interviews returns proposals including meetingLink field', async () => {
    // Propose + finalize + set link
    const recruiterToken = makeToken(ctx.recruiterUser.id, 'recruiter');
    await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });

    const propRes = await request(app)
      .post(`/api/recruiter/interviews/${ctx.bc.id}/propose`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ proposedDates: ['2026-09-01T10:00:00.000Z'] });

    // There may already be a proposal, re-fetch
    const managerToken = makeToken(ctx.managerUser.id, 'manager');
    const listRes = await request(app)
      .get('/api/manager/interviews')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.proposals)).toBe(true);
    // All proposals must have meetingLink key (may be null)
    for (const p of listRes.body.proposals) {
      expect(Object.prototype.hasOwnProperty.call(p, 'meetingLink')).toBe(true);
    }
  });
});
