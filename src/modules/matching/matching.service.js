const { prisma } = require('../../services/prisma');
const { haversineDistance } = require('../../services/geo');
const { broadcastToUsers } = require('../../services/firebase');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const DEFAULT_RADIUS_KM = 10;
const DEFAULT_MAX_USERS = 5;
const STALE_THRESHOLD_MINUTES = 5;

/**
 * Finds online users within a given radius of a GPS coordinate.
 * Behavior-based: no role filter — any online user with location is eligible.
 * Supports excluding specific users (job owner, existing applicants).
 * Filters out ghost users (stale location > 5 min).
 * Sorts by distance ascending, returns top N.
 */
async function findNearbyUsers({
  latitude, longitude,
  radiusKm = DEFAULT_RADIUS_KM,
  limit = DEFAULT_MAX_USERS,
  excludeUserId = null,
  excludeUserIds = [],
}) {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const allExcluded = [...excludeUserIds];
  if (excludeUserId) allExcluded.push(excludeUserId);

  const whereClause = {
    isOnline: true,
    deletedAt: null,
    latitude: { not: null },
    longitude: { not: null },
    lastLocationUpdateAt: { gte: staleThreshold },
  };
  if (allExcluded.length > 0) {
    whereClause.id = { notIn: allExcluded };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      skills: true,
      latitude: true,
      longitude: true,
      lastLocationUpdateAt: true,
      fcmToken: true,
    },
  });

  const nearbyUsers = users
    .map((user) => ({
      ...user,
      distanceKm: haversineDistance(latitude, longitude, user.latitude, user.longitude),
    }))
    .filter((u) => u.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((u) => ({ ...u, distanceKm: Math.round(u.distanceKm * 100) / 100 }));

  logger.info({ count: nearbyUsers.length, radiusKm, latitude, longitude }, 'Nearby users found');
  return nearbyUsers;
}

/**
 * Broadcast a job to the nearest available users.
 * Validates job, finds nearby users, and sends FCM push notifications.
 */
async function broadcastJob(jobId, userId, { radiusKm, limit } = {}) {
  const job = await prisma.job.findUnique({
    where: { id: jobId, deletedAt: null },
    include: { applications: { select: { applicantId: true } } },
  });

  if (!job) throw new AppError('Job not found', 404);
  if (job.userId !== userId) throw new AppError('Only the job owner can broadcast this job', 403);
  if (job.status !== 'OPEN') throw new AppError('Job is not open for matching', 400);
  if (!job.latitude || !job.longitude) {
    throw new AppError('Job has no coordinates — set latitude/longitude to match users', 400);
  }

  const existingApplicantIds = job.applications.map((a) => a.applicantId);

  const users = await findNearbyUsers({
    latitude: job.latitude, longitude: job.longitude,
    radiusKm, limit,
    excludeUserId: userId,
    excludeUserIds: existingApplicantIds,
  });

  // Send FCM push notifications to matched users
  let notificationResult = { sent: 0, total: users.length };
  try {
    notificationResult = await broadcastToUsers(users, job);
  } catch (err) {
    logger.warn({ jobId, error: err.message }, 'FCM broadcast failed, continuing without notifications');
  }

  logger.info({ jobId, matched: users.length, notified: notificationResult.sent }, 'Job broadcast to nearby users');

  return {
    job: { id: job.id, title: job.title, location: job.location, budget: job.budget, latitude: job.latitude, longitude: job.longitude },
    matchedUsers: users,
    totalMatched: users.length,
    notificationsSent: notificationResult.sent,
    radiusKm: radiusKm || DEFAULT_RADIUS_KM,
  };
}

module.exports = { findNearbyUsers, broadcastJob };
