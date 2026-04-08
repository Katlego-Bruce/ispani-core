const { prisma } = require('../../services/prisma');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  role: true,
  skills: true,
  location: true,
  bio: true,
  latitude: true,
  longitude: true,
  isOnline: true,
  lastLocationUpdateAt: true,
  createdAt: true,
};

async function listUsers({ role, page, limit }) {
  const where = { deletedAt: null };
  if (role) where.role = role;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, select: USER_SELECT, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

async function getUserById(id) {
  return prisma.user.findUnique({ where: { id, deletedAt: null }, select: USER_SELECT });
}

async function updateProfile(userId, data) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.skills && { skills: data.skills }),
    },
    select: USER_SELECT,
  });
}

/**
 * Update worker's GPS location and mark as online.
 * Called by mobile app on open, every 60s heartbeat, and on job accept.
 */
async function updateLocation(userId, { latitude, longitude }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new AppError('User not found', 404);
  if (user.role !== 'WORKER') {
    throw new AppError('Only workers can update location', 403);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      latitude,
      longitude,
      lastLocationUpdateAt: new Date(),
      isOnline: true,
    },
    select: USER_SELECT,
  });

  logger.info({ userId, latitude, longitude }, 'Worker location updated');
  return updated;
}

/**
 * Set worker online/offline status.
 */
async function setOnlineStatus(userId, isOnline) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isOnline,
      ...(!isOnline && { lastLocationUpdateAt: null }),
    },
    select: USER_SELECT,
  });
}

module.exports = { listUsers, getUserById, updateProfile, updateLocation, setOnlineStatus };
