require('dotenv').config();
const path = require('path');

const config = {
  port: Number(process.env.PORT || 4317),
  host: process.env.HOST || '127.0.0.1',
  mongoUri: process.env.MONGODB_URI,
  mongoDb: process.env.MONGODB_DB,
  password: process.env.MANAGEMENT_PASSWORD,
  timezone: process.env.REPORTING_TIMEZONE || 'Africa/Douala',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 12),
  tempDb: path.resolve(__dirname, '..', 'temp_db'),
};

if (!config.mongoUri || !config.mongoDb || !config.password)
  throw new Error('MONGODB_URI, MONGODB_DB and MANAGEMENT_PASSWORD are required');

module.exports = config;
