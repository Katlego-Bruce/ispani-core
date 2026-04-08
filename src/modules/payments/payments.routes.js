const express = require('express');
const { z } = require('zod');
const router = express.Router();
const paymentsController = require('./payments.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const createSchema = z.object({ jobId: z.string().uuid() });

router.post('/create', authenticate, validate(createSchema), paymentsController.createPayment);
router.post('/:id/release', authenticate, paymentsController.releasePayment);
router.post('/:id/refund', authenticate, paymentsController.refundPayment);
router.post('/:id/dispute', authenticate, paymentsController.disputePayment);

module.exports = router;
