const express = require('express');
const router = express.Router();
const jobsController = require('./jobs.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const createJobSchema = {
  title: { required: true, type: 'string', minLength: 3 },
  description: { required: true, type: 'string', minLength: 10 },
  budget: { required: true, type: 'number' },
  location: { required: true, type: 'string' },
};

// Any authenticated user can create jobs
router.post('/', authenticate, validate(createJobSchema), jobsController.createJob);
router.get('/', jobsController.listJobs);
router.get('/:id', jobsController.getJobById);

// Job status management
router.patch('/:id/complete', authenticate, jobsController.completeJob);
router.patch('/:id/cancel', authenticate, jobsController.cancelJob);

// Any authenticated user can apply (except to their own jobs)
router.post('/:id/apply', authenticate, jobsController.applyToJob);
router.get('/:id/applications', authenticate, jobsController.getApplications);
router.patch('/:id/applications/:appId', authenticate, jobsController.updateApplication);

module.exports = router;
