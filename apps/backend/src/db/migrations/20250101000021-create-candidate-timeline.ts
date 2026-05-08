import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('candidate_timeline_events', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'candidates', key: 'id' },
        onDelete: 'CASCADE',
      },
      event: {
        type: DataTypes.ENUM(
          'registered',
          'consent_given',
          'profile_submitted',
          'profile_under_review',
          'profile_approved',
          'profile_rejected',
          'batch_allocated',
          'recruiter_selected',
          'interview_proposed',
          'interview_date_confirmed',
          'interview_scheduled',
          'manager_confirmed',
          'interview_passed',
          'interview_failed',
          'recruiter_accepted',
        ),
        allowNull: false,
      },
      actorId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      actorRole: { type: DataTypes.STRING(50), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('candidate_timeline_events', ['candidateId', 'occurredAt'], {
      name: 'idx_timeline_candidate_time',
    });

    // ── Backfill existing data ────────────────────────────────────────────────
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // registered: one event per candidate from createdAt
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), id, 'registered', NULL, NULL, NULL, createdAt, '${now}', '${now}'
      FROM candidates
    `);

    // consent_given: from consentGivenAt
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), id, 'consent_given', NULL, NULL, NULL, consentGivenAt, '${now}', '${now}'
      FROM candidates
      WHERE consentGivenAt IS NOT NULL
    `);

    // batch_allocated: from batch_candidates.allocatedAt
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), bc.candidateId, 'batch_allocated', bc.allocatedBy, 'manager',
        JSON_OBJECT('batchId', bc.batchId), bc.allocatedAt, '${now}', '${now}'
      FROM batch_candidates bc
      WHERE bc.allocatedAt IS NOT NULL
    `);

    // recruiter_selected: from batch_candidates.selectedAt
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), bc.candidateId, 'recruiter_selected', NULL, 'recruiter',
        JSON_OBJECT('batchId', bc.batchId), bc.selectedAt, '${now}', '${now}'
      FROM batch_candidates bc
      WHERE bc.selectedAt IS NOT NULL
    `);

    // interview_proposed: from interview_proposals.createdAt (non-cancelled)
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), bc.candidateId, 'interview_proposed', ip.proposedBy, 'recruiter',
        JSON_OBJECT('proposalId', ip.id), ip.createdAt, '${now}', '${now}'
      FROM interview_proposals ip
      JOIN batch_candidates bc ON bc.id = ip.batchCandidateId
      WHERE ip.status != 'cancelled'
    `);

    // interview_scheduled: from interview_proposals where finalDate is set
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), bc.candidateId, 'interview_scheduled', NULL, 'manager',
        JSON_OBJECT('proposalId', ip.id, 'finalDate', ip.finalDate), ip.finalDate, '${now}', '${now}'
      FROM interview_proposals ip
      JOIN batch_candidates bc ON bc.id = ip.batchCandidateId
      WHERE ip.finalDate IS NOT NULL AND ip.status IN ('scheduled', 'completed', 'cancelled')
    `);

    // manager_confirmed: from batch_candidates.confirmedAt
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), bc.candidateId, 'manager_confirmed', NULL, 'manager',
        JSON_OBJECT('batchId', bc.batchId), bc.confirmedAt, '${now}', '${now}'
      FROM batch_candidates bc
      WHERE bc.confirmedAt IS NOT NULL
    `);

    // interview_passed / interview_failed: from candidates.interviewStatus
    await queryInterface.sequelize.query(`
      INSERT INTO candidate_timeline_events (id, candidateId, event, actorId, actorRole, metadata, occurredAt, createdAt, updatedAt)
      SELECT UUID(), id,
        CASE WHEN interviewStatus = 'pass' THEN 'interview_passed' ELSE 'interview_failed' END,
        NULL, 'manager', NULL, updatedAt, '${now}', '${now}'
      FROM candidates
      WHERE interviewStatus IN ('pass', 'fail')
    `);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('candidate_timeline_events');
  },
};
