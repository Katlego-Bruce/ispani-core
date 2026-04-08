const { prisma } = require('../../services/prisma');

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

module.exports = { listUsers, getUserById, updateProfile };
