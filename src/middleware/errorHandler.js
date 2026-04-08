const logger = require('../services/logger');
const AppError = require('../utils/AppError');

function errorHandler(err, req, res, next) {
  // Log the error with request context
  const logContext = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode: err.statusCode || 500,
  };

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    logger.warn({ ...logContext, field: err.meta?.target }, 'Unique constraint violation');
    return res.status(409).json({
      error: 'A record with this value already exists',
      field: err.meta?.target,
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  // Prisma invalid ID format
  if (err.code === 'P2023') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Operational errors (AppError)
  if (err instanceof AppError) {
    logger.warn(logContext, err.message);
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unknown / unexpected errors
  logger.error({ ...logContext, err }, 'Unhandled error');
  const status = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
