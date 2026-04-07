const jobsService = require('./jobs.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.createJob = asyncHandler(async (req, res) => {
  const { title, description, budget, location, category } = req.body;

  const job = await jobsService.createJob({
    title,
    description,
    budget,
    location,
    category,
    userId: req.user.id,
  });

  res.status(201).json({
    message: 'Job created successfully',
    data: job,
  });
});

exports.listJobs = asyncHandler(async (req, res) => {
  const { status, category, page = 1, limit = 20 } = req.query;

  const result = await jobsService.listJobs({
    status,
    category,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({ data: result });
});

exports.getJobById = asyncHandler(async (req, res) => {
  const job = await jobsService.getJobById(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({ data: job });
});

exports.applyToJob = asyncHandler(async (req, res) => {
  const { message } = req.body;

  const application = await jobsService.applyToJob({
    jobId: req.params.id,
    workerId: req.user.id,
    message,
  });

  res.status(201).json({
    message: 'Application submitted',
    data: application,
  });
});

exports.getApplications = asyncHandler(async (req, res) => {
  const applications = await jobsService.getApplications(req.params.id, req.user.id);

  res.json({ data: applications });
});

exports.updateApplication = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be accepted or rejected' });
  }

  const application = await jobsService.updateApplication({
    applicationId: req.params.appId,
    jobId: req.params.id,
    userId: req.user.id,
    status,
  });

  res.json({
    message: `Application ${status}`,
    data: application,
  });
});
