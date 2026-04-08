const bcrypt = require('bcryptjs');
const { prisma } = require('../../services/prisma');
const { generateToken } = require('../../services/jwt');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const SALT_ROUNDS = 12;

async function register(data) {
  const existing = await prisma.user.findUnique({
    where: { phone: data.phone },
  });

  if (existing) {
    throw new AppError('Phone number already registered', 409);
  }

  // Check email uniqueness if provided
  if (data.email) {
    const emailExists = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailExists) {
      throw new AppError('Email already registered', 409);
    }
  }

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      password: hashedPassword,
      role: data.role,
      skills: data.skills || [],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true,
      skills: true,
      createdAt: true,
    },
  });

  const token = generateToken({ id: user.id, role: user.role });

  logger.info({ userId: user.id, role: user.role }, 'User registered');
  return { user, token };
}

async function login({ phone, password }) {
  const user = await prisma.user.findUnique({
    where: { phone, deletedAt: null },
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = generateToken({ id: user.id, role: user.role });

  logger.info({ userId: user.id }, 'User logged in');
  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      skills: user.skills,
    },
    token,
  };
}

module.exports = { register, login };
