const express = require('express');
const { z } = require('zod');
const router = express.Router();
const jobsController = require('./jobs.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const createJobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  budget: z.number().positive('Budget must be a positive number'),
  location: z.string().min(1, 'Location is required'),
  category: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const updateJobSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  budget: z.number().positive().optional(),
  location: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

// My jobs (must be BEFORE /:id to avoid matching "me" as an ID)
router.get('/me', authenticate, jobsController.getMyJobs);

// Job CRUD
router.post('/', authenticate, validate(createJobSchema), jobsController.createJob);
router.get('/', jobsController.listJobs);
router.get('/:id', jobsController.getJobById);
router.patch('/:id', authenticate, validate(updateJobSchema), jobsController.updateJob);
router.delete('/:id', authenticate, jobsController.deleteJob);

// Job status management
router.patch('/:id/start', authenticate, jobsController.startJob);
router.patch('/:id/complete', authenticate, jobsController.completeJob);
router.patch('/:id/cancel', authenticate, jobsController.cancelJob);

// Applications
router.post('/:id/apply', authenticate, jobsController.applyToJob);
router.get('/:id/applications', authenticate, jobsController.getApplications);
router.patch('/:id/applications/:appId', authenticate, jobsController.updateApplication);

module.exports = router;
