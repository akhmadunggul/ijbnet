import { QueryInterface, DataTypes } from 'sequelize';

// Removes two dead ENUM values that were never meaningfully used:
// - candidates.profileStatus 'confirmed': was set by manager batch-confirm but never
//   filtered on; isLocked + batch_candidates.isConfirmed carry this state.
//   Existing rows are migrated to 'approved' before the ENUM is shrunk.
// - candidate_timeline_events.event 'recruiter_selected': removed from recording
//   in v0.5.2 but the ENUM value was never cleaned up.
export async function up(queryInterface: QueryInterface): Promise<void> {
  // Migrate any existing 'confirmed' candidates to 'approved'
  await queryInterface.sequelize.query(
    `UPDATE candidates SET profileStatus = 'approved' WHERE profileStatus = 'confirmed'`,
  );

  await queryInterface.changeColumn('candidates', 'profileStatus', {
    type: DataTypes.ENUM('incomplete', 'submitted', 'under_review', 'approved', 'rejected', 'hired'),
    defaultValue: 'incomplete',
    allowNull: false,
  });

  await queryInterface.changeColumn('candidate_timeline_events', 'event', {
    type: DataTypes.ENUM(
      'registered',
      'consent_given',
      'profile_submitted',
      'profile_under_review',
      'profile_approved',
      'profile_rejected',
      'batch_allocated',
      'interview_proposed',
      'interview_date_confirmed',
      'interview_scheduled',
      'manager_confirmed',
      'interview_passed',
      'interview_failed',
      'recruiter_accepted',
      'provisional_acceptance',
      'hired',
      'recruiter_rejected',
      'returned_to_pool',
    ),
    allowNull: false,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.changeColumn('candidates', 'profileStatus', {
    type: DataTypes.ENUM('incomplete', 'submitted', 'under_review', 'approved', 'confirmed', 'rejected', 'hired'),
    defaultValue: 'incomplete',
    allowNull: false,
  });

  await queryInterface.changeColumn('candidate_timeline_events', 'event', {
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
      'provisional_acceptance',
      'hired',
      'recruiter_rejected',
      'returned_to_pool',
    ),
    allowNull: false,
  });
}
