const argon2 = require('argon2');
const crypto = require('crypto');
const { prisma } = require('../../services/prisma');
const { generateAccessToken, generateRefreshToken } = require('../../services/jwt');
const config = require('../../config');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const MAX_SESSIONS_PER_USER = 5;
const PASSWORD_RESET_EXPIRES_HOURS = 1;

async function createTokenPair(user) {
  const accessToken = generateAccessToken({ id: user.id, isAdmin: user.isAdmin });
  const refreshTokenValue = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.REFRESH_TOKEN_EXPIRES_IN_DAYS);
  await prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  const activeCount = await prisma.refreshToken.count({ where: { userId: user.id } });
  if (activeCount >= MAX_SESSIONS_PER_USER) {
    const oldest = await prisma.refreshToken.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    if (oldest) { await prisma.refreshToken.delete({ where: { id: oldest.id } }); logger.info({ userId: user.id }, 'Oldest session removed'); }
  }
  await prisma.refreshToken.create({ data: { token: refreshTokenValue, userId: user.id, expiresAt } });
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
      popiaConsentAt: new Date(),
    },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, skills: true, isAdmin: true, createdAt: true },
  });
  const tokens = await createTokenPair(user);
  logger.info({ userId: user.id }, 'User registered with POPIA consent');
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
  return { user: { id: user.id, firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email, skills: user.skills, isAdmin: user.isAdmin }, ...tokens };
}

async function refreshAccessToken(refreshToken) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: { select: { id: true, isAdmin: true, isBanned: true, isSuspended: true, deletedAt: true } } },
  });
  if (!stored) throw new AppError('Invalid refresh token', 401);
  if (stored.expiresAt < new Date()) { await prisma.refreshToken.delete({ where: { id: stored.id } }); throw new AppError('Refresh token expired', 401); }
  const { user } = stored;
  if (user.deletedAt) { await prisma.refreshToken.delete({ where: { id: stored.id } }); throw new AppError('Account no longer exists', 401); }
  if (user.isBanned) { await prisma.refreshToken.deleteMany({ where: { userId: user.id } }); throw new AppError('Account has been banned', 403); }
  if (user.isSuspended) throw new AppError('Account is suspended', 403);
  const newRefreshTokenValue = generateRefreshToken();
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + config.REFRESH_TOKEN_EXPIRES_IN_DAYS);
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { id: stored.id } }),
    prisma.refreshToken.create({ data: { token: newRefreshTokenValue, userId: user.id, expiresAt: newExpiresAt } }),
  ]);
  const accessToken = generateAccessToken({ id: user.id, isAdmin: user.isAdmin });
  logger.info({ userId: user.id }, 'Token refreshed (rotated)');
  return { accessToken, refreshToken: newRefreshTokenValue };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);
  const isMatch = await argon2.verify(user.password, currentPassword);
  if (!isMatch) throw new AppError('Current password is incorrect', 401);
  const hashedPassword = await argon2.hash(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
  const tokens = await createTokenPair({ id: user.id, isAdmin: user.isAdmin });
  logger.info({ userId }, 'Password changed, all sessions invalidated');
  return tokens;
}

async function requestPasswordReset(phone) {
  const user = await prisma.user.findUnique({ where: { phone, deletedAt: null } });
  if (!user) {
    logger.info({ phone: phone.slice(-4) }, 'Password reset requested (user may not exist)');
    return { message: 'If this phone number is registered, a reset link has been sent.' };
  }
  await prisma.passwordResetToken.updateMany({
    where: { phone, used: false, expiresAt: { gt: new Date() } },
    data: { used: true },
  });
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRES_HOURS);
  await prisma.passwordResetToken.create({ data: { token, phone, expiresAt } });
  logger.info({ phone: phone.slice(-4) }, 'Password reset token generated');
  return { message: 'If this phone number is registered, a reset link has been sent.', resetToken: token };
}

async function resetPassword(token, newPassword) {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken) throw new AppError('Invalid or expired reset token', 400);
  if (resetToken.used) throw new AppError('Reset token has already been used', 400);
  if (resetToken.expiresAt < new Date()) throw new AppError('Reset token has expired', 400);
  const user = await prisma.user.findUnique({ where: { phone: resetToken.phone, deletedAt: null } });
  if (!user) throw new AppError('Account not found', 404);
  const hashedPassword = await argon2.hash(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } }),
  ]);
  logger.info({ userId: user.id }, 'Password reset completed');
  return { message: 'Password has been reset successfully. Please log in with your new password.' };
}

async function logout(refreshToken, userId) {
  const result = await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  if (result.count === 0) throw new AppError('Invalid refresh token', 401);
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: null, latitude: null, longitude: null, lastLocationUpdateAt: null, isOnline: false },
  });
  logger.info({ userId }, 'User logged out, presence cleared');
  return { message: 'Logged out successfully' };
}

async function logoutAll(userId) {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null, latitude: null, longitude: null, lastLocationUpdateAt: null, isOnline: false },
    }),
  ]);
  logger.info({ userId }, 'All sessions logged out, presence cleared');
  return { message: 'All sessions logged out' };
}

module.exports = { register, login, refreshAccessToken, changePassword, requestPasswordReset, resetPassword, logout, logoutAll };
