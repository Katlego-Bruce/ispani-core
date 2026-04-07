const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { authenticate } = require('../../middleware/auth');

router.get('/', authenticate, usersController.listUsers);
router.get('/:id', authenticate, usersController.getUserById);

module.exports = router;
