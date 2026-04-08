const express = require('express');
const { z } = require('zod');
const router = express.Router();
const reviewsController = require('./reviews.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const reviewSchema = z.object({
  revieweeId: z.string().uuid(),
  jobId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

router.post('/', authenticate, validate(reviewSchema), reviewsController.submitReview);
router.get('/user/:id', authenticate, reviewsController.getUserReviews);
router.get('/user/:id/stats', authenticate, reviewsController.getUserStats);

module.exports = router;
