const { prisma } = require('../../services/prisma');
const { haversineDistance } = require('../../services/geo');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const DEFAULT_RADIUS_KM = 10;
const DEFAULT_MAX_WORKERS = 5;
const STALE_THRESHOLD_MINUTES = 5;

/**
 * Finds online workers within a given radius of a GPS coordinate.
 * Filters out ghost workers (stale location > 5 min).
 * Sorts by distance ascending, returns top N.
 */
async function findNearbyWorkers({
  latitude,
  longitude,
  radiusKm = DEFAULT_RADIUS_KM,
  limit = DEFAULT_MAX_WORKERS,
}) {
  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000
  );

  const workers = await prisma.user.findMany({
    where: {
      role: 'WORKER',
      isOnline: true,
      deletedAt: null,
      latitude: { not: null },
      longitude: { not: null },
      lastLocationUpdateAt: { gte: staleThreshold },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      skills: true,
      latitude: true,
      longitude: true,
      lastLocationUpdateAt: true,
    },
  });

  const nearbyWorkers = workers
    .map((worker) => ({
      ...worker,
      distanceKm: haversineDistance(
        latitude,
        longitude,
        worker.latitude,
        worker.longitude
      ),
    }))
    .filter((w) => w.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((w) => ({
      ...w,
      distanceKm: Math.round(w.distanceKm * 100) / 100,
    }));

  logger.info(
    { count: nearbyWorkers.length, radiusKm, latitude, longitude },
    'Nearby workers found'
  );

  return nearbyWorkers;
}

/**
 * Broadcast a job to the nearest available workers.
 * Validates job exists, is OPEN, has coordinates, and belongs to the requesting user.
 */
async function broadcastJob(jobId, userId, { radiusKm, limit } = {}) {
  const job = await prisma.job.findUnique({
    where: { id: jobId, deletedAt: null },
  });

  if (!job) throw new AppError('Job not found', 404);
  if (job.userId !== userId) {
    throw new AppError('Only the job owner can broadcast this job', 403);
  }
  if (job.status !== 'OPEN')
    throw new AppError('Job is not open for matching', 400);
  if (!job.latitude || !job.longitude) {
    throw new AppError(
      'Job has no coordinates — set latitude/longitude to match workers',
      400
    );
  }

  const workers = await findNearbyWorkers({
    latitude: job.latitude,
    longitude: job.longitude,
    radiusKm,
    limit,
  });

  logger.info(
    { jobId, matched: workers.length },
    'Job broadcast to nearby workers'
  );

  return {
    job: {
      id: job.id,
      title: job.title,
      location: job.location,
      budget: job.budget,
      latitude: job.latitude,
      longitude: job.longitude,
    },
    matchedWorkers: workers,
    totalMatched: workers.length,
    radiusKm: radiusKm || DEFAULT_RADIUS_KM,
  };
}

module.exports = { findNearbyWorkers, broadcastJob };
