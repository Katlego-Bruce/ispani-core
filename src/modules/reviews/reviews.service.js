const { prisma } = require('../../services/prisma');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

async function submitReview({ reviewerId, revieweeId, jobId, rating, comment }) {
  if (rating < 1 || rating > 5) throw new AppError('Rating must be 1-5', 400);
  if (reviewerId === revieweeId) throw new AppError('Cannot review yourself', 400);

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'COMPLETED') throw new AppError('Can only review completed jobs', 400);

  // Verify reviewer was a participant in this job (client or assigned worker)
  if (reviewerId !== job.userId && reviewerId !== job.assignedToId) {
    throw new AppError('Only job participants can submit reviews', 403);
  }

  // Verify reviewee was also a participant
  if (revieweeId !== job.userId && revieweeId !== job.assignedToId) {
    throw new AppError('Can only review other job participants', 400);
  }

  const review = await prisma.review.create({
    data: { reviewerId, revieweeId, jobId, rating, comment },
  });

  // Update reviewee average rating
  const stats = await prisma.review.aggregate({
    where: { revieweeId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const avgRating = Math.round((stats._avg.rating || 0) * 100) / 100;
  const level = calculateLevel(avgRating, stats._count.rating);

  await prisma.user.update({
    where: { id: revieweeId },
    data: { averageRating: avgRating, userLevel: level },
  });

  logger.info({ reviewerId, revieweeId, jobId, rating }, 'Review submitted');
  return review;
}

function calculateLevel(avgRating, completedJobs) {
  if (completedJobs >= 50 && avgRating >= 4.5) return 5;
  if (completedJobs >= 30 && avgRating >= 4.3) return 4;
  if (completedJobs >= 15 && avgRating >= 4.0) return 3;
  if (completedJobs >= 5) return 2;
  return 1;
}

async function getUserReviews(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: userId },
      include: { reviewer: { select: { id: true, firstName: true, lastName: true } }, job: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.review.count({ where: { revieweeId: userId } }),
  ]);
  return { reviews, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

async function getUserStats(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { averageRating: true, completedJobs: true, cancelledJobs: true, totalJobsAccepted: true, userLevel: true },
  });
  if (!user) throw new AppError('User not found', 404);
  const reliability = user.totalJobsAccepted > 0 ? Math.round((user.completedJobs / user.totalJobsAccepted) * 100) : 0;
  return { ...user, reliabilityScore: reliability };
}

module.exports = { submitReview, getUserReviews, getUserStats };
