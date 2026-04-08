const { prisma } = require('../../services/prisma');
const { sendOtp, generateOtpCode, normalizePhone } = require('../../services/twilio');
const { generateToken } = require('../../services/jwt');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_OTPS_PER_WINDOW = 3;

async function requestOtp(phone) {
  const normalized = normalizePhone(phone);

  // Rate limit check
  const recentOtps = await prisma.otp.count({
    where: { phone: normalized, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
  });
  if (recentOtps >= MAX_OTPS_PER_WINDOW) {
    throw new AppError('Too many OTP requests. Try again later.', 429);
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otp.create({ data: { phone: normalized, code, expiresAt } });
  await sendOtp(normalized, code);

  logger.info({ phone: normalized.slice(-4) }, 'OTP requested');
  return { message: 'OTP sent', expiresInSeconds: OTP_EXPIRY_MINUTES * 60 };
}

async function verifyOtp(phone, code) {
  const normalized = normalizePhone(phone);

  const otp = await prisma.otp.findFirst({
    where: { phone: normalized, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) throw new AppError('No valid OTP found. Request a new one.', 400);
  if (otp.attempts >= MAX_ATTEMPTS) throw new AppError('Max attempts exceeded. Request a new OTP.', 400);

  await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });

  if (otp.code !== code) throw new AppError('Invalid OTP', 401);

  // Clean up used OTPs
  await prisma.otp.deleteMany({ where: { phone: normalized } });

  // Find or create user
  let user = await prisma.user.findUnique({ where: { phone: normalized } });
  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({
      data: { phone: normalized, firstName: '', lastName: '', password: '' },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, skills: true },
    });
  }

  const token = generateToken({ id: user.id });
  logger.info({ userId: user.id, isNewUser }, 'OTP verified');
  return { user: { id: user.id, firstName: user.firstName, lastName: user.lastName, phone: user.phone }, token, isNewUser };
}

module.exports = { requestOtp, verifyOtp };
