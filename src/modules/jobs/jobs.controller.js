const jobsService = require('./jobs.service');
const asyncHandler = require('../../utils/asyncHandler');

const MAX_PAGE_LIMIT = 100;

const createJob = asyncHandler(async (req, res) => {
  const { title, description, budget, location, category } = req.body;

  const job = await jobsService.createJob({
    title, description, budget, location, category,
    userId: req.user.id,
  });

  res.status(201).json({ message: 'Job created successfully', data: job });
});

const listJobs = asyncHandler(async (req, res) => {
  const { status, category } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), MAX_PAGE_LIMIT);

  const result = await jobsService.listJobs({ status, category, page, limit });
  res.json({ data: result });
});

const getJobById = asyncHandler(async (req, res) => {
  const job = await jobsService.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ data: job });
});

const completeJob = asyncHandler(async (req, res) => {
  const job = await jobsService.completeJob(req.params.id, req.user.id);
  res.json({ message: 'Job marked as completed', data: job });
});

const cancelJob = asyncHandler(async (req, res) => {
  const job = await jobsService.cancelJob(req.params.id, req.user.id);
  res.json({ message: 'Job cancelled', data: job });
});

const applyToJob = asyncHandler(async (req, res) => {
  const application = await jobsService.applyToJob({
    jobId: req.params.id,
    workerId: req.user.id,
    message: req.body.message,
  });
  res.status(201).json({ message: 'Application submitted', data: application });
});

const getApplications = asyncHandler(async (req, res) => {
  const applications = await jobsService.getApplications(req.params.id, req.user.id);
  res.json({ data: applications });
});

const updateApplication = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['ACCEPTED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be ACCEPTED or REJECTED' });
  }

  const application = await jobsService.updateApplication({
    applicationId: req.params.appId,
    jobId: req.params.id,
    userId: req.user.id,
    status,
  });

  res.json({ message: `Application ${status.toLowerCase()}`, data: application });
});

module.exports = {
  createJob, listJobs, getJobById, completeJob, cancelJob,
  applyToJob, getApplications, updateApplication,
};
