const express = require('express');
const { authenticate } = require('../../middleware/auth');
const matchingController = require('./matching.controller');

const router = express.Router();

// GET /matching/nearby?latitude=X&longitude=Y&radiusKm=10&limit=5
router.get('/nearby', authenticate, matchingController.findNearby);

module.exports = router;
