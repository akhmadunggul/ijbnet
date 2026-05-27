import { Sequelize } from 'sequelize';
import { config } from '../config';
import { recordDbQuery } from '../utils/monitor';

export const sequelize = new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASS, {
  host: config.DB_HOST,
  port: config.DB_PORT,
  dialect: 'mysql',
  logging: () => recordDbQuery(),
  pool: {
    max: 50,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
});

export async function connectDB(): Promise<void> {
  await sequelize.authenticate();
  console.log('MySQL connected. Pool: max=50, min=2');
}
