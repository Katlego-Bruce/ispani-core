const { prisma } = require('../../services/prisma');
const AppError = require('../../utils/AppError');
const logger = require('../../services/logger');

const SERVICE_FEE_PERCENT = 10;

async function createPayment(jobId, clientId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.userId !== clientId) throw new AppError('Only the job owner can create a payment', 403);

  const amount = parseFloat(job.budget);
  const serviceFee = Math.round((amount * SERVICE_FEE_PERCENT / 100) * 100) / 100;
  const workerPayout = Math.round((amount - serviceFee) * 100) / 100;

  const payment = await prisma.payment.create({
    data: { amount, serviceFee, workerPayout, jobId, clientId, status: 'HELD', heldAt: new Date() },
  });

  logger.info({ jobId, amount, serviceFee, workerPayout }, 'Payment created and held in escrow');
  return payment;
}

async function releasePayment(paymentId, clientId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { job: true } });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.clientId !== clientId) throw new AppError('Not authorized', 403);
  if (payment.status !== 'HELD') throw new AppError('Payment not in escrow', 400);
  if (payment.job.status !== 'COMPLETED') throw new AppError('Job must be completed first', 400);

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'RELEASED', releasedAt: new Date(), workerId: payment.job.assignedToId },
  });

  logger.info({ paymentId, workerId: payment.job.assignedToId }, 'Payment released');
  return updated;
}

async function refundPayment(paymentId, clientId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.clientId !== clientId) throw new AppError('Not authorized', 403);
  if (payment.status !== 'HELD') throw new AppError('Can only refund held payments', 400);

  const updated = await prisma.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
  logger.info({ paymentId }, 'Payment refunded');
  return updated;
}

async function disputePayment(paymentId, userId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.clientId !== userId && payment.workerId !== userId) throw new AppError('Not authorized', 403);

  const updated = await prisma.payment.update({ where: { id: paymentId }, data: { status: 'DISPUTED' } });
  logger.info({ paymentId, userId }, 'Payment disputed');
  return updated;
}

module.exports = { createPayment, releasePayment, refundPayment, disputePayment };
