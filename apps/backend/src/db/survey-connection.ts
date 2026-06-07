import { Sequelize } from 'sequelize';
import { config } from '../config';

export const surveySequelize = new Sequelize(
  config.SURVEY_DB_NAME,
  config.DB_USER,
  config.DB_PASS,
  {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: 'mysql',
    logging: false,
    pool: { max: 10, min: 1, acquire: 30000, idle: 10000 },
    define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  },
);

export async function connectSurveyDB(): Promise<void> {
  // Auto-create the survey database if it doesn't exist
  const bootstrap = new Sequelize('', config.DB_USER, config.DB_PASS, {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: 'mysql',
    logging: false,
  });
  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.SURVEY_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await bootstrap.close();
  }

  await surveySequelize.authenticate();
  console.log(`Survey DB connected: ${config.SURVEY_DB_NAME}`);
}
