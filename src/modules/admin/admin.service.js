const { prisma } = require('../../services/prisma');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

async function listUsers({ page = 1, limit = 20, search } = {}) {
  const where = { deletedAt: null };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, select: {
      id: true, firstName: true, lastName: true, phone: true, email: true,
      isAdmin: true, isSuspended: true, isBanned: true, averageRating: true,
      completedJobs: true, userLevel: true, createdAt: true,
    }, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);
  return { users, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

async function suspendUser(userId) {
  const updated = await prisma.user.update({ where: { id: userId }, data: { isSuspended: true } });
  logger.info({ userId }, 'User suspended');
  return updated;
}

async function banUser(userId) {
  const updated = await prisma.user.update({ where: { id: userId }, data: { isBanned: true, isSuspended: true } });
  logger.info({ userId }, 'User banned');
  return updated;
}

async function restoreUser(userId) {
  const updated = await prisma.user.update({ where: { id: userId }, data: { isSuspended: false, isBanned: false } });
  logger.info({ userId }, 'User restored');
  return updated;
}

async function getStats() {
  const [totalUsers, totalJobs, activeUsers, jobsByStatus] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.job.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { isOnline: true, deletedAt: null } }),
    prisma.job.groupBy({ by: ['status'], _count: { status: true } }),
  ]);
  const statusCounts = {};
  jobsByStatus.forEach((s) => { statusCounts[s.status] = s._count.status; });
  return { totalUsers, totalJobs, activeUsersNow: activeUsers, jobsByStatus: statusCounts };
}

module.exports = { requireAdmin, listUsers, suspendUser, banUser, restoreUser, getStats };
