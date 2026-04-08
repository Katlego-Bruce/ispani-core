const bcrypt = require('bcryptjs');
const { prisma } = require('../../services/prisma');
const { generateToken } = require('../../services/jwt');

exports.register = async (data) => {
  const existing = await prisma.user.findUnique({
    where: { phone: data.phone },
  });

  if (existing) {
    const error = new Error('Phone number already registered');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      password: hashedPassword,
      skills: data.skills || [],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      skills: true,
      createdAt: true,
    },
  });

  const token = generateToken({ id: user.id });
  return { user, token };
};

exports.login = async ({ phone, password }) => {
  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken({ id: user.id });
  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      skills: user.skills,
    },
    token,
  };
};
