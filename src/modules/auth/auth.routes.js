const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('./auth.controller');
const otpService = require('./otp.service');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const config = require('../../config');

const authLimiter = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').regex(/^[0-9+]+$/, 'Invalid phone format'),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  skills: z.array(z.string()).optional().default([]),
});

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

const sendOtpSchema = z.object({ phone: z.string().min(10) });
const verifyOtpSchema = z.object({ phone: z.string().min(10), code: z.string().length(6) });

// Password auth
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getMe);

// OTP auth
router.post('/send-otp', authLimiter, validate(sendOtpSchema), asyncHandler(async (req, res) => {
  const result = await otpService.requestOtp(req.body.phone);
  res.json({ message: result.message, data: { expiresInSeconds: result.expiresInSeconds } });
}));
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), asyncHandler(async (req, res) => {
  const result = await otpService.verifyOtp(req.body.phone, req.body.code);
  res.json({ message: 'OTP verified', data: result });
}));

module.exports = router;
