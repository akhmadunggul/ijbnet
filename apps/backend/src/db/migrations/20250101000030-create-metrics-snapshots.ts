import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('metrics_snapshots', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    ts: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    active_users: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    db_requests_per_min: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    http_requests_per_min: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    p95_response_ms: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    cpu_pct: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    error_rate_pct: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await queryInterface.addIndex('metrics_snapshots', ['ts'], { name: 'idx_metrics_ts' });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('metrics_snapshots');
}
