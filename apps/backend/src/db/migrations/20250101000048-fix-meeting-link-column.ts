import { QueryInterface, DataTypes } from 'sequelize';

// Migration 000047 incorrectly used snake_case 'meeting_link'.
// All other columns in this project use camelCase. Fix it.
export async function up(queryInterface: QueryInterface): Promise<void> {
  const cols = await queryInterface.describeTable('interview_proposals');

  if (cols['meetingLink']) {
    // Already correct — nothing to do (idempotent)
    return;
  }

  if (cols['meeting_link']) {
    // Wrong name from buggy migration 000047 — rename to camelCase
    await queryInterface.renameColumn('interview_proposals', 'meeting_link', 'meetingLink');
  } else {
    // Column was never created — add it directly with the correct name
    await queryInterface.addColumn('interview_proposals', 'meetingLink', {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('interview_proposals', 'meetingLink');
}
