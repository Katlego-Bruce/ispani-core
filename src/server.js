require('dotenv').config();

const { validateEnv } = require('./config/env');
const config = require('./config');
const app = require('./app');
const logger = require('./services/logger');
const { prisma } = require('./services/prisma');

// Validate environment before anything else
validateEnv();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'ISPANI API started');
  logger.info(`Health: http://localhost:${config.PORT}/health`);
  logger.info(`API v1: http://localhost:${config.PORT}/api/v1`);
});

// ─── Graceful Shutdown ────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing gracefully...');

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error({ err: error }, 'Error disconnecting from database');
    }

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown — timeout exceeded');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED_REJECTION_REASON:', reason);
  console.error('UNHANDLED_REJECTION_STACK:', reason?.stack || 'no stack');
  logger.fatal({ err: reason }, 'Unhandled Rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT_EXCEPTION:', error);
  console.error('UNCAUGHT_EXCEPTION_STACK:', error?.stack || 'no stack');
  logger.fatal({ err: error }, 'Uncaught Exception');
  process.exit(1);
});
