const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const config = require('../../config');

// Stricter rate limit for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Zod Schemas ──────────────────────────────────────────
const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').regex(/^[0-9+]+$/, 'Invalid phone format'),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['CLIENT', 'WORKER'], { message: 'Role must be CLIENT or WORKER' }),
  skills: z.array(z.string()).optional().default([]),
});

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Routes ───────────────────────────────────────────────
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
