import { QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      ALTER TABLE candidate_timeline_events
      MODIFY COLUMN event ENUM(
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
        'provisional_acceptance'
      ) NOT NULL
    `);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      ALTER TABLE candidate_timeline_events
      MODIFY COLUMN event ENUM(
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
        'recruiter_accepted'
      ) NOT NULL
    `);
  },
};
