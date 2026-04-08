const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./services/logger');
const { prisma } = require('./services/prisma');
const { errorHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');

const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const jobRoutes = require('./modules/jobs/jobs.routes');
const matchingRoutes = require('./modules/matching/matching.routes');
const { authenticate } = require('./middleware/auth');
const matchingController = require('./modules/matching/matching.controller');

const app = express();

// ─── Security ──────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Parsing ───────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request ID & Logging ──────────────────────────────
app.use(requestId);
app.use(morgan(':method :url :status :response-time ms - :req[x-request-id]', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── Rate Limiting ─────────────────────────────────────
app.use(rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Health Check (includes DB) ────────────────────────
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: require('../package.json').version,
    });
  } catch (error) {
    logger.error({ err: error }, 'Health check failed — database unreachable');
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// ─── API Routes (versioned) ────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/matching', matchingRoutes);

// Broadcast endpoint — ownership enforced at service layer
app.post('/api/v1/jobs/:id/broadcast', authenticate, matchingController.broadcastJob);

// Backward-compatible non-versioned routes (remove when frontend migrates)
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/jobs', jobRoutes);
app.use('/matching', matchingRoutes);

// ─── 404 ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
