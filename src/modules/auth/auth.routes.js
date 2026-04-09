const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const config = require('../../config');

const authLimiter = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SA phone number regex: +27XXXXXXXXX or 0XXXXXXXXX (mobile prefixes 06x, 07x, 08x)
const SA_PHONE_REGEX = /^(\+27|0)[6-8]\d{8}$/;

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().regex(SA_PHONE_REGEX, 'Invalid SA phone number. Use +27XXXXXXXXX or 0XXXXXXXXX format'),
  email: z.string().email('Invalid email format').optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=])/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  skills: z.array(z.string()).optional().default([]),
});

const loginSchema = z.object({
  phone: z.string().regex(SA_PHONE_REGEX, 'Invalid SA phone number format'),
  password: z.string().min(1, 'Password is required'),
});

// Password auth
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getMe);

// OTP auth - DEFERRED FOR MVP (Phase 3)
// See issue #35 for re-activation plan
// router.post('/send-otp', ...);
// router.post('/verify-otp', ...);

module.exports = router;
