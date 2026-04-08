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

/** PATCH /api/v1/users/location — Update GPS coordinates. */
const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const user = await usersService.updateLocation(req.user.id, { latitude, longitude });
  res.json({ message: 'Location updated', data: user });
});

/** PATCH /api/v1/users/status — Set online/offline. */
const setOnlineStatus = asyncHandler(async (req, res) => {
  const { isOnline } = req.body;
  const user = await usersService.setOnlineStatus(req.user.id, isOnline);
  res.json({ message: `Status set to ${isOnline ? 'online' : 'offline'}`, data: user });
});

/** PATCH /api/v1/users/fcm-token — Update FCM push token. */
const updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  const result = await usersService.updateFcmToken(req.user.id, fcmToken);
  res.json({ message: 'FCM token updated', data: result });
});

module.exports = { listUsers, getUserById, updateProfile, updateLocation, setOnlineStatus, updateFcmToken };
