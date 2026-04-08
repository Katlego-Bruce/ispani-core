const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate } = require('../../middleware/auth');
const { requireAdmin } = require('./admin.service');

router.use(authenticate, requireAdmin);

router.get('/users', adminController.listUsers);
router.patch('/users/:id/suspend', adminController.suspendUser);
router.patch('/users/:id/ban', adminController.banUser);
router.patch('/users/:id/restore', adminController.restoreUser);
router.get('/stats', adminController.getStats);

module.exports = router;
