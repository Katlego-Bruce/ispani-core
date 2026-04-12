const { prisma } = require('../../services/prisma');
const { acquireJobLock, releaseJobLock } = require('../../services/redis');
const { haversineDistance } = require('../../services/geo');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

async function createJob(data) {
  return prisma.job.create({
    data: {
      title: data.title, description: data.description, budget: data.budget,
      location: data.location, category: data.category, latitude: data.latitude,
      longitude: data.longitude, userId: data.userId,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
}

async function listJobs({ status, category, page, limit }) {
  const where = { deletedAt: null };
  // FIX: Default to OPEN if no status provided
  where.status = status || 'OPEN';
  if (category) where.category = category;
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where, skip, take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * Location-aware job feed - returns OPEN jobs sorted by distance then recency.
 */
async function getNearbyJobs({ latitude, longitude, radiusKm = 25, category, page = 1, limit = 20 }) {
  if (!latitude || !longitude) {
    throw new AppError('Latitude and longitude are required for nearby search', 400);
  }

  const where = {
    deletedAt: null,
    status: 'OPEN',
    latitude: { not: null },
    longitude: { not: null },
  };
  if (category) where.category = category;

  const allJobs = await prisma.job.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const nearbyJobs = allJobs
    .map((job) => ({
      ...job,
      distanceKm: haversineDistance(latitude, longitude, job.latitude, job.longitude),
    }))
    .filter((j) => j.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || new Date(b.createdAt) - new Date(a.createdAt))
    .map((j) => ({ ...j, distanceKm: Math.round(j.distanceKm * 100) / 100 }));

  const total = nearbyJobs.length;
  const skip = (page - 1) * limit;
  const paginatedJobs = nearbyJobs.slice(skip, skip + limit);

  return {
    jobs: paginatedJobs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

async function getJobById(id) {
  return prisma.job.findUnique({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { applications: true } },
    },
  });
}

async function startJob(jobId, userId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.assignedToId !== userId) throw new AppError('Only the assigned user can start this job', 403);
  if (job.status !== 'ASSIGNED') throw new AppError('Only assigned jobs can be started', 400);

  const updated = await prisma.job.update({ where: { id: jobId }, data: { status: 'IN_PROGRESS' } });
  logger.info({ jobId, userId }, 'Job started');
  return updated;
}

async function completeJob(jobId, userId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.userId !== userId) throw new AppError('Only the job owner can complete this job', 403);
  if (job.status !== 'IN_PROGRESS' && job.status !== 'ASSIGNED') {
    throw new AppError('Only in-progress or assigned jobs can be completed', 400);
  }

  // FIX: Wrap in transaction so job status + user counter are atomic
  const updated = await prisma.$transaction(async (tx) => {
    const updatedJob = await tx.job.update({ where: { id: jobId }, data: { status: 'COMPLETED' } });
    if (job.assignedToId) {
      await tx.user.update({
        where: { id: job.assignedToId },
        data: { completedJobs: { increment: 1 } },
      });
    }
    return updatedJob;
  });

  logger.info({ jobId, assignedToId: job.assignedToId }, 'Job completed');
  return updated;
}

async function cancelJob(jobId, userId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.userId !== userId) throw new AppError('Only the job owner can cancel this job', 403);
  if (job.status === 'COMPLETED') throw new AppError('Completed jobs cannot be cancelled', 400);

  // FIX: Wrap in transaction + auto-reject pending applications
  const updated = await prisma.$transaction(async (tx) => {
    const updatedJob = await tx.job.update({ where: { id: jobId }, data: { status: 'CANCELLED' } });
    await tx.application.updateMany({
      where: { jobId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    await tx.user.update({
      where: { id: userId },
      data: { cancelledJobs: { increment: 1 } },
    });
    return updatedJob;
  });

  logger.info({ jobId }, 'Job cancelled, pending applications rejected');
  return updated;
}

async function applyToJob({ jobId, applicantId, message }) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.status !== 'OPEN') throw new AppError('This job is no longer accepting applications', 400);
  if (job.userId === applicantId) throw new AppError('You cannot apply to your own job', 400);

  // FIX: Catch Prisma unique constraint error for friendly message
  try {
    return await prisma.application.create({
      data: { jobId, applicantId, message },
      include: { job: { select: { id: true, title: true } } },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError('You have already applied to this job', 409);
    }
    throw err;
  }
}

async function getApplications(jobId, userId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== userId) {
    throw new AppError('Not authorized to view these applications', 403);
  }

  return prisma.application.findMany({
    where: { jobId },
    include: {
      applicant: { select: { id: true, firstName: true, lastName: true, phone: true, skills: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Accept/reject application with Redis distributed lock + Prisma transaction.
 * FIX: Added status guard in transaction + proper Redis fallback.
 */
async function updateApplication({ applicationId, jobId, userId, status }) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== userId) {
    throw new AppError('Not authorized', 403);
  }

  if (status === 'ACCEPTED') {
    let lockAcquired = false;
    try {
      lockAcquired = await acquireJobLock(jobId, userId);
    } catch (err) {
      logger.warn({ jobId, error: err.message }, 'Redis lock unavailable, relying on DB transaction guard');
      lockAcquired = true;
    }

    if (!lockAcquired) {
      throw new AppError('This job is already being assigned. Try again shortly.', 409);
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // FIX: Re-check job status INSIDE transaction to prevent race conditions
      if (status === 'ACCEPTED') {
        const freshJob = await tx.job.findUnique({ where: { id: jobId } });
        if (!freshJob || freshJob.status !== 'OPEN') {
          throw new AppError('This job has already been assigned to someone else', 409);
        }
      }

      const application = await tx.application.update({
        where: { id: applicationId },
        data: { status },
        include: { applicant: { select: { id: true, firstName: true, lastName: true } } },
      });

      if (status === 'ACCEPTED') {
        await tx.job.update({
          where: { id: jobId },
          data: { status: 'ASSIGNED', assignedToId: application.applicantId },
        });
        await tx.application.updateMany({
          where: { jobId, id: { not: applicationId }, status: 'PENDING' },
          data: { status: 'REJECTED' },
        });
        await tx.user.update({
          where: { id: application.applicantId },
          data: { totalJobsAccepted: { increment: 1 } },
        });
        logger.info({ jobId, applicationId, applicantId: application.applicantId }, 'Application accepted, others rejected');
      }

      return application;
    });

    return result;
  } finally {
    if (status === 'ACCEPTED') {
      try { await releaseJobLock(jobId); } catch (err) {
        logger.warn({ jobId, error: err.message }, 'Failed to release Redis lock');
      }
    }
  }
}

module.exports = {
  createJob, listJobs, getNearbyJobs, getJobById, startJob, completeJob, cancelJob,
  applyToJob, getApplications, updateApplication,
};
