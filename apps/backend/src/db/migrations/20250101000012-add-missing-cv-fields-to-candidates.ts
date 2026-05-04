import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('candidates', 'nameKatakana', {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'bloodType', {
    type: DataTypes.ENUM('A', 'B', 'AB', 'O', 'A+', 'B+', 'AB+', 'O+', 'Unknown'),
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'religion', {
    type: DataTypes.ENUM('Islam', 'Kristen', 'Katolik', 'Budha', 'Hindu', 'Lainnya'),
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'hasVisitedJapan', {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  });
  await queryInterface.addColumn('candidates', 'hasPassport', {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  });
  await queryInterface.addColumn('candidates', 'hobbies', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'selfPrId', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'selfPrJa', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'motivationId', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'motivationJa', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'applyReasonId', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'applyReasonJa', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'selfIntroId', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'selfIntroJa', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'selfReportedHeight', {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true,
    defaultValue: null,
  });
  await queryInterface.addColumn('candidates', 'selfReportedWeight', {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true,
    defaultValue: null,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('candidates', 'selfReportedWeight');
  await queryInterface.removeColumn('candidates', 'selfReportedHeight');
  await queryInterface.removeColumn('candidates', 'selfIntroJa');
  await queryInterface.removeColumn('candidates', 'selfIntroId');
  await queryInterface.removeColumn('candidates', 'applyReasonJa');
  await queryInterface.removeColumn('candidates', 'applyReasonId');
  await queryInterface.removeColumn('candidates', 'motivationJa');
  await queryInterface.removeColumn('candidates', 'motivationId');
  await queryInterface.removeColumn('candidates', 'selfPrJa');
  await queryInterface.removeColumn('candidates', 'selfPrId');
  await queryInterface.removeColumn('candidates', 'hobbies');
  await queryInterface.removeColumn('candidates', 'hasPassport');
  await queryInterface.removeColumn('candidates', 'hasVisitedJapan');
  await queryInterface.removeColumn('candidates', 'religion');
  await queryInterface.removeColumn('candidates', 'bloodType');
  await queryInterface.removeColumn('candidates', 'nameKatakana');
}
