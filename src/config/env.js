const logger = require('../services/logger');

const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

function validateEnv() {
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    logger.fatal(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // JWT_SECRET should be at least 32 characters
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET should be at least 32 characters for security');
  }

  logger.info('Environment variables validated');
}

module.exports = { validateEnv };
