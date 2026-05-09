import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('candidate_timeline_events', 'durationHours', {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      defaultValue: null,
      comment: 'Hours spent in this stage (null = still current stage)',
    });

    // Backfill: for each event, set durationHours = hours until the next event for that candidate
    await queryInterface.sequelize.query(`
      UPDATE candidate_timeline_events e1
      INNER JOIN (
        SELECT
          e.id,
          TIMESTAMPDIFF(SECOND, e.occurredAt,
            (SELECT MIN(e2.occurredAt)
             FROM candidate_timeline_events e2
             WHERE e2.candidateId = e.candidateId
               AND e2.occurredAt > e.occurredAt)
          ) / 3600.0 AS durationHours
        FROM candidate_timeline_events e
        WHERE EXISTS (
          SELECT 1 FROM candidate_timeline_events e3
          WHERE e3.candidateId = e.candidateId
            AND e3.occurredAt > e.occurredAt
        )
      ) calc ON e1.id = calc.id
      SET e1.durationHours = calc.durationHours
    `);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('candidate_timeline_events', 'durationHours');
  },
};
