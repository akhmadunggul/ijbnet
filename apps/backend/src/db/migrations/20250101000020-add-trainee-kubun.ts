import type { QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface): Promise<void> {
  // Extend sswKubun ENUM on candidates
  await qi.sequelize.query(
    "ALTER TABLE candidates MODIFY COLUMN sswKubun ENUM('SSW1', 'SSW2', 'Trainee') NULL;"
  );

  // Extend kubun ENUM on ssw_sector_fields
  await qi.sequelize.query(
    "ALTER TABLE ssw_sector_fields MODIFY COLUMN kubun ENUM('SSW1', 'SSW2', 'Trainee') NOT NULL;"
  );
}

export async function down(qi: QueryInterface): Promise<void> {
  // Remove Trainee candidates' kubun before reverting (can't shrink ENUM with data)
  await qi.sequelize.query(
    "UPDATE candidates SET sswKubun = NULL WHERE sswKubun = 'Trainee';"
  );
  await qi.sequelize.query(
    "DELETE FROM ssw_sector_fields WHERE kubun = 'Trainee';"
  );

  await qi.sequelize.query(
    "ALTER TABLE candidates MODIFY COLUMN sswKubun ENUM('SSW1', 'SSW2') NULL;"
  );
  await qi.sequelize.query(
    "ALTER TABLE ssw_sector_fields MODIFY COLUMN kubun ENUM('SSW1', 'SSW2') NOT NULL;"
  );
}
