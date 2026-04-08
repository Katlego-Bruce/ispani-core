const { prisma } = require('../../services/prisma');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

async function createJob(data) {
  return prisma.job.create({
    data: {
      title: data.title,
      description: data.description,
      budget: data.budget,
      location: data.location,
      category: data.category,
      userId: data.userId,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function listJobs({ status, category, page, limit }) {
  const where = { deletedAt: null };
  if (status) where.status = status;
  if (category) where.category = category;

  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

async function getJobById(id) {
  return prisma.job.findUnique({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      _count: { select: { applications: true } },
    },
  });
}

async function completeJob(jobId, userId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) throw new AppError('Job not found', 404);
  if (job.userId !== userId) throw new AppError('Only the job owner can complete this job', 403);
  if (job.status !== 'ASSIGNED') throw new AppError('Only assigned jobs can be completed', 400);

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'COMPLETED' },
  });

  logger.info({ jobId }, 'Job completed');
  return updated;
}

async function cancelJob(jobId, userId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) throw new AppError('Job not found', 404);
  if (job.userId !== userId) throw new AppError('Only the job owner can cancel this job', 403);
  if (job.status === 'COMPLETED') throw new AppError('Completed jobs cannot be cancelled', 400);

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
  });

  logger.info({ jobId }, 'Job cancelled');
  return updated;
}

async function applyToJob({ jobId, workerId, message }) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) throw new AppError('Job not found', 404);
  if (job.status !== 'OPEN') throw new AppError('This job is no longer accepting applications', 400);
  if (job.userId === workerId) throw new AppError('You cannot apply to your own job', 400);

  return prisma.application.create({
    data: { jobId, workerId, message },
    include: {
      job: { select: { id: true, title: true } },
    },
  });
}

async function getApplications(jobId, userId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job || job.userId !== userId) {
    throw new AppError('Not authorized to view these applications', 403);
  }

  return prisma.application.findMany({
    where: { jobId },
    include: {
      worker: {
        select: { id: true, firstName: true, lastName: true, phone: true, skills: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * FIXED: Uses a Prisma transaction to prevent race conditions.
 * When accepting an application:
 *  1. Updates the application status
 *  2. Updates the job status to ASSIGNED
 *  3. Rejects all other pending applications
 * All three happen atomically — no two accepts can succeed.
 */
async function updateApplication({ applicationId, jobId, userId, status }) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job || job.userId !== userId) {
    throw new AppError('Not authorized', 403);
  }

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.update({
      where: { id: applicationId },
      data: { status },
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (status === 'ACCEPTED') {
      // Set job to assigned
      await tx.job.update({
        where: { id: jobId },
        data: { status: 'ASSIGNED' },
      });

      // Reject all other pending applications atomically
      await tx.application.updateMany({
        where: {
          jobId,
          id: { not: applicationId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });

      logger.info({ jobId, applicationId, workerId: application.workerId }, 'Application accepted, others rejected');
    }

    return application;
  });

  return result;
}

module.exports = {
  createJob,
  listJobs,
  getJobById,
  completeJob,
  cancelJob,
  applyToJob,
  getApplications,
  updateApplication,
};
