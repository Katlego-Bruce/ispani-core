const paymentsService = require('./payments.service');
const asyncHandler = require('../../utils/asyncHandler');

const createPayment = asyncHandler(async (req, res) => {
  const payment = await paymentsService.createPayment(req.body.jobId, req.user.id);
  res.status(201).json({ message: 'Payment held in escrow', data: payment });
});
const releasePayment = asyncHandler(async (req, res) => {
  const payment = await paymentsService.releasePayment(req.params.id, req.user.id);
  res.json({ message: 'Payment released', data: payment });
});
const refundPayment = asyncHandler(async (req, res) => {
  const payment = await paymentsService.refundPayment(req.params.id, req.user.id);
  res.json({ message: 'Payment refunded', data: payment });
});
const disputePayment = asyncHandler(async (req, res) => {
  const payment = await paymentsService.disputePayment(req.params.id, req.user.id);
  res.json({ message: 'Payment disputed', data: payment });
});
module.exports = { createPayment, releasePayment, refundPayment, disputePayment };
