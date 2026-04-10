const { prisma } = require('../../services/prisma');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const USER_SELECT = {
  id: true, firstName: true, lastName: true, phone: true, email: true,
  skills: true, location: true, bio: true, latitude: true, longitude: true,
  isOnline: true, lastLocationUpdateAt: true, averageRating: true,
  userLevel: true, completedJobs: true, createdAt: true,
};

async function listUsers({ page, limit }) {
  const where = { deletedAt: null };
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, select: USER_SELECT, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);
  return { users, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
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

async function updateLocation(userId, { latitude, longitude }) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { latitude, longitude, lastLocationUpdateAt: new Date(), isOnline: true },
    select: USER_SELECT,
  });
  logger.info({ userId, latitude, longitude }, 'User location updated');
  return updated;
}

async function setOnlineStatus(userId, isOnline) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isOnline,
      ...(!isOnline && { lastLocationUpdateAt: null, latitude: null, longitude: null }),
    },
    select: USER_SELECT,
  });
}

async function updateFcmToken(userId, fcmToken) {
  return prisma.user.update({
    where: { id: userId },
    data: { fcmToken },
    select: { id: true, fcmToken: true },
  });
}

async function getMyApplications(userId, { status, page = 1, limit = 20 } = {}) {
  const where = { applicantId: userId };
  if (status) where.status = status;
  const skip = (page - 1) * limit;
  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where, skip, take: limit,
      include: {
        job: {
          select: {
            id: true, title: true, location: true, budget: true, status: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.application.count({ where }),
  ]);
  return { applications, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

async function deleteAccount(userId) {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isOnline: false, fcmToken: null,
        latitude: null, longitude: null, lastLocationUpdateAt: null,
      },
    }),
  ]);
  logger.info({ userId }, 'Account soft-deleted (POPIA)');
  return { message: 'Account deleted successfully' };
}

module.exports = { listUsers, getUserById, updateProfile, updateLocation, setOnlineStatus, updateFcmToken, getMyApplications, deleteAccount };
