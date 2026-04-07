const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    });
}

module.exports = {
  development: {
    username: process.env.DB_USER || 'ijbnet',
    password: process.env.DB_PASS || 'changeme',
    database: process.env.DB_NAME || 'ijbnet_db',
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    dialect:  'mysql',
    migrationStorageTableName: 'sequelize_meta',
    seederStorageTableName:    'sequelize_data',
    seederStorage: 'sequelize',
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '3306'),
    dialect:  'mysql',
    migrationStorageTableName: 'sequelize_meta',
    seederStorageTableName:    'sequelize_data',
    seederStorage: 'sequelize',
  },
};