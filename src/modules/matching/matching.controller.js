const matchingService = require('./matching.service');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * POST /api/v1/jobs/:id/broadcast
 * Find nearby workers for a specific job and broadcast it.
 * Only the job owner (CLIENT) can broadcast.
 */
const broadcastJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { radiusKm, limit } = req.query;

  const result = await matchingService.broadcastJob(id, req.user.id, {
    radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  res.json({ status: 'success', data: result });
});

/**
 * GET /api/v1/matching/nearby
 * Find nearby workers from arbitrary coordinates.
 * Query params: latitude, longitude, radiusKm (optional), limit (optional)
 */
const findNearby = asyncHandler(async (req, res) => {
  const { latitude, longitude, radiusKm, limit } = req.query;

  if (!latitude || !longitude) {
    return res
      .status(400)
      .json({ error: 'latitude and longitude query params are required' });
  }

  const workers = await matchingService.findNearbyWorkers({
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  res.json({ status: 'success', data: { workers, total: workers.length } });
});

module.exports = { broadcastJob, findNearby };
