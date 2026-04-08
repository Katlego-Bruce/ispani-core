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

// Job CRUD
router.post('/', authenticate, validate(createJobSchema), jobsController.createJob);
router.get('/', jobsController.listJobs);
router.get('/:id', jobsController.getJobById);

// Job status management
router.patch('/:id/start', authenticate, jobsController.startJob);
router.patch('/:id/complete', authenticate, jobsController.completeJob);
router.patch('/:id/cancel', authenticate, jobsController.cancelJob);

// Applications
router.post('/:id/apply', authenticate, jobsController.applyToJob);
router.get('/:id/applications', authenticate, jobsController.getApplications);
router.patch('/:id/applications/:appId', authenticate, jobsController.updateApplication);

module.exports = router;
