const jobsService = require('./jobs.service');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');

const createJob = asyncHandler(async (req, res) => {
  const data = { ...req.body, userId: req.user.id };
  const job = await jobsService.createJob(data);
  res.status(201).json({ success: true, data: job });
});

const listJobs = asyncHandler(async (req, res) => {
  const { status, category, page = 1, limit = 20 } = req.query;
  const result = await jobsService.listJobs({
    status, category,
    page: parseInt(page), limit: Math.min(parseInt(limit) || 20, 50),
  });
  res.json({ success: true, ...result });
});

// NEW: Location-aware feed endpoint
const getNearbyJobs = asyncHandler(async (req, res) => {
  const { latitude, longitude, radiusKm, category, page = 1, limit = 20 } = req.query;
  const result = await jobsService.getNearbyJobs({
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null,
    radiusKm: radiusKm ? parseFloat(radiusKm) : 25,
    category,
    page: parseInt(page),
    limit: Math.min(parseInt(limit) || 20, 50),
  });
  res.json({ success: true, ...result });
});

const getJobById = asyncHandler(async (req, res) => {
  const job = await jobsService.getJobById(req.params.id);
  if (!job) throw new AppError('Job not found', 404);
  res.json({ success: true, data: job });
});

const startJob = asyncHandler(async (req, res) => {
  const job = await jobsService.startJob(req.params.id, req.user.id);
  res.json({ success: true, data: job });
});

const completeJob = asyncHandler(async (req, res) => {
  const job = await jobsService.completeJob(req.params.id, req.user.id);
  res.json({ success: true, data: job });
});

const cancelJob = asyncHandler(async (req, res) => {
  const job = await jobsService.cancelJob(req.params.id, req.user.id);
  res.json({ success: true, data: job });
});

const applyToJob = asyncHandler(async (req, res) => {
  const application = await jobsService.applyToJob({
    jobId: req.params.id, applicantId: req.user.id, message: req.body.message,
  });
  res.status(201).json({ success: true, data: application });
});

const getApplications = asyncHandler(async (req, res) => {
  const applications = await jobsService.getApplications(req.params.id, req.user.id);
  res.json({ success: true, data: applications });
});

const updateApplication = asyncHandler(async (req, res) => {
  const application = await jobsService.updateApplication({
    applicationId: req.params.appId,
    jobId: req.params.id,
    userId: req.user.id,
    status: req.body.status,
  });
  res.json({ success: true, data: application });
});

module.exports = {
  createJob, listJobs, getNearbyJobs, getJobById, startJob, completeJob, cancelJob,
  applyToJob, getApplications, updateApplication,
};
