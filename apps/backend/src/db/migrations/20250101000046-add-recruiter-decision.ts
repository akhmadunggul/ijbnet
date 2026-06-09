import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add recruiter decision fields to interview_proposals
  await queryInterface.addColumn('interview_proposals', 'recruiterDecision', {
    type: DataTypes.ENUM('accepted', 'rejected'),
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('interview_proposals', 'recruiterDecisionAt', {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await queryInterface.addColumn('interview_proposals', 'decisionDeadline', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  // Add 'hired' to candidates.profileStatus ENUM
  await queryInterface.sequelize.query(
    `ALTER TABLE candidates MODIFY COLUMN profileStatus ENUM('incomplete','submitted','under_review','approved','confirmed','rejected','hired') NOT NULL DEFAULT 'incomplete'`,
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('interview_proposals', 'recruiterDecision');
  await queryInterface.removeColumn('interview_proposals', 'recruiterDecisionAt');
  await queryInterface.removeColumn('interview_proposals', 'decisionDeadline');

  await queryInterface.sequelize.query(
    `ALTER TABLE candidates MODIFY COLUMN profileStatus ENUM('incomplete','submitted','under_review','approved','confirmed','rejected') NOT NULL DEFAULT 'incomplete'`,
  );
}
