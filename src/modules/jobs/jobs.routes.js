const express = require('express');
const router = express.Router();
const jobsController = require('./jobs.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const createJobSchema = {
  title: { required: true, type: 'string', minLength: 3 },
  description: { required: true, type: 'string', minLength: 10 },
  budget: { required: true, type: 'number' },
  location: { required: true, type: 'string' },
};

router.post('/', authenticate, authorize('client'), validate(createJobSchema), jobsController.createJob);
router.get('/', jobsController.listJobs);
router.get('/:id', jobsController.getJobById);
router.post('/:id/apply', authenticate, authorize('worker'), jobsController.applyToJob);
router.get('/:id/applications', authenticate, jobsController.getApplications);
router.patch('/:id/applications/:appId', authenticate, jobsController.updateApplication);

module.exports = router;
