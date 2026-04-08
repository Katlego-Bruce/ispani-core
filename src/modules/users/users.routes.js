const express = require('express');
const { z } = require('zod');
const router = express.Router();
const usersController = require('./users.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  location: z.string().nullable().optional(),
  skills: z.array(z.string()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const setStatusSchema = z.object({
  isOnline: z.boolean(),
});

router.get('/', authenticate, usersController.listUsers);
router.get('/:id', authenticate, usersController.getUserById);
router.patch('/me', authenticate, validate(updateProfileSchema), usersController.updateProfile);

// Location & status endpoints — any authenticated user
router.patch('/location', authenticate, validate(updateLocationSchema), usersController.updateLocation);
router.patch('/status', authenticate, validate(setStatusSchema), usersController.setOnlineStatus);

module.exports = router;
