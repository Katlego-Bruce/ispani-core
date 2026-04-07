const { prisma } = require('../../services/prisma');

exports.listUsers = async ({ role, page, limit }) => {
  const where = role ? { role } : {};
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        skills: true,
        location: true,
        bio: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      skills: true,
      location: true,
      bio: true,
      createdAt: true,
    },
  });
};
