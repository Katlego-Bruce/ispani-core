const usersService = require('./users.service');
const asyncHandler = require('../../utils/asyncHandler');

const MAX_PAGE_LIMIT = 100;

const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), MAX_PAGE_LIMIT);
  const result = await usersService.listUsers({ page, limit });
  res.json({ data: result });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ data: user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await usersService.updateProfile(req.user.id, req.body);
  res.json({ message: 'Profile updated', data: user });
});

const updateLocation = asyncHandler(async (req, res) => {
  const user = await usersService.updateLocation(req.user.id, req.body);
  res.json({ data: user });
});

const setOnlineStatus = asyncHandler(async (req, res) => {
  const user = await usersService.setOnlineStatus(req.user.id, req.body.isOnline);
  res.json({ data: user });
});

const updateFcmToken = asyncHandler(async (req, res) => {
  const result = await usersService.updateFcmToken(req.user.id, req.body.fcmToken);
  res.json({ data: result });
});

const getMyApplications = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), MAX_PAGE_LIMIT);
  const result = await usersService.getMyApplications(req.user.id, { status, page, limit });
  res.json({ data: result });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const result = await usersService.deleteAccount(req.user.id);
  res.json(result);
});

module.exports = { listUsers, getUserById, updateProfile, updateLocation, setOnlineStatus, updateFcmToken, getMyApplications, deleteAccount };
