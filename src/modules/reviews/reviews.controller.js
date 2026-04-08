const reviewsService = require('./reviews.service');
const asyncHandler = require('../../utils/asyncHandler');

const submitReview = asyncHandler(async (req, res) => {
  const { revieweeId, jobId, rating, comment } = req.body;
  const review = await reviewsService.submitReview({ reviewerId: req.user.id, revieweeId, jobId, rating, comment });
  res.status(201).json({ message: 'Review submitted', data: review });
});

const getUserReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const result = await reviewsService.getUserReviews(req.params.id, { page, limit });
  res.json({ data: result });
});

const getUserStats = asyncHandler(async (req, res) => {
  const stats = await reviewsService.getUserStats(req.params.id);
  res.json({ data: stats });
});

module.exports = { submitReview, getUserReviews, getUserStats };
