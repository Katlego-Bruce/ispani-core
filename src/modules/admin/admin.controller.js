const adminService = require('./admin.service');
const asyncHandler = require('../../utils/asyncHandler');

const listUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const result = await adminService.listUsers({ page, limit, search: req.query.search });
  res.json({ data: result });
});
const suspendUser = asyncHandler(async (req, res) => {
  const user = await adminService.suspendUser(req.params.id);
  res.json({ message: 'User suspended', data: { id: user.id } });
});
const banUser = asyncHandler(async (req, res) => {
  const user = await adminService.banUser(req.params.id);
  res.json({ message: 'User banned', data: { id: user.id } });
});
const restoreUser = asyncHandler(async (req, res) => {
  const user = await adminService.restoreUser(req.params.id);
  res.json({ message: 'User restored', data: { id: user.id } });
});
const getStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getStats();
  res.json({ data: stats });
});
module.exports = { listUsers, suspendUser, banUser, restoreUser, getStats };
