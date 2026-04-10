const argon2 = require('argon2');
const { prisma } = require('../../services/prisma');
const { generateAccessToken, generateRefreshToken } = require('../../services/jwt');
const config = require('../../config');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

/**
 * Creates an access + refresh token pair.
 * Refresh token is stored in DB for revocation support.
 */
async function createTokenPair(user) {
  const accessToken = generateAccessToken({ id: user.id, isAdmin: user.isAdmin });
  const refreshTokenValue = generateRefreshToken();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.REFRESH_TOKEN_EXPIRES_IN_DAYS);

  await prisma.refreshToken.create({
    data: { token: refreshTokenValue, userId: user.id, expiresAt },
  });

  return { accessToken, refreshToken: refreshTokenValue };
}

async function register(data) {
  const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
  if (existing) throw new AppError('Phone number already registered', 409);

  if (data.email) {
    const emailExists = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailExists) throw new AppError('Email already registered', 409);
  }

  const hashedPassword = await argon2.hash(data.password);

  const user = await prisma.user.create({
    data: {
      firstName: data.firstName, lastName: data.lastName,
      phone: data.phone, email: data.email || null,
      password: hashedPassword, skills: data.skills || [],
    },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      email: true, skills: true, isAdmin: true, createdAt: true,
    },
  });

  const tokens = await createTokenPair(user);
  logger.info({ userId: user.id }, 'User registered');
  return { user, ...tokens };
}

async function login({ phone, password }) {
  const user = await prisma.user.findUnique({ where: { phone, deletedAt: null } });
  if (!user) throw new AppError('Invalid credentials', 401);

  if (user.isBanned) throw new AppError('Account has been banned. Contact support.', 403);
  if (user.isSuspended) throw new AppError('Account is suspended. Contact support.', 403);

  const isMatch = await argon2.verify(user.password, password);
  if (!isMatch) throw new AppError('Invalid credentials', 401);

  const tokens = await createTokenPair(user);
  logger.info({ userId: user.id }, 'User logged in');

  return {
    user: {
      id: user.id, firstName: user.firstName, lastName: user.lastName,
      phone: user.phone, email: user.email, skills: user.skills, isAdmin: user.isAdmin,
    },
    ...tokens,
  };
}

async function refreshAccessToken(refreshToken) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: {
      user: {
        select: { id: true, isAdmin: true, isBanned: true, isSuspended: true, deletedAt: true },
      },
    },
  });

  if (!stored) throw new AppError('Invalid refresh token', 401);

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError('Refresh token expired', 401);
  }

  const { user } = stored;
  if (user.deletedAt) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError('Account no longer exists', 401);
  }
  if (user.isBanned) {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    throw new AppError('Account has been banned', 403);
  }
  if (user.isSuspended) {
    throw new AppError('Account is suspended', 403);
  }

  const accessToken = generateAccessToken({ id: user.id, isAdmin: user.isAdmin });
  logger.info({ userId: user.id }, 'Token refreshed');
  return { accessToken };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const isMatch = await argon2.verify(user.password, currentPassword);
  if (!isMatch) throw new AppError('Current password is incorrect', 401);

  const hashedPassword = await argon2.hash(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } }),
    // Invalidate ALL refresh tokens (force re-login on all devices)
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);

  // Issue new token pair for current session
  const tokens = await createTokenPair({ id: user.id, isAdmin: user.isAdmin });
  logger.info({ userId }, 'Password changed, all sessions invalidated');
  return tokens;
}

async function logout(refreshToken) {
  const result = await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  if (result.count === 0) throw new AppError('Invalid refresh token', 401);
  logger.info('User logged out');
  return { message: 'Logged out successfully' };
}

async function logoutAll(userId) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
  logger.info({ userId }, 'All sessions logged out');
  return { message: 'All sessions logged out' };
}

module.exports = { register, login, refreshAccessToken, changePassword, logout, logoutAll };
