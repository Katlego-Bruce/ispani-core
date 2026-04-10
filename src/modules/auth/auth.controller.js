const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json({ message: 'User registered successfully', data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({ message: 'Login successful', data: result });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ data: req.user });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  res.json({ message: 'Token refreshed', data: result });
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  res.json({ message: 'Password changed successfully', data: result });
});

const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(req.body.refreshToken);
  res.json(result);
});

const logoutAll = asyncHandler(async (req, res) => {
  const result = await authService.logoutAll(req.user.id);
  res.json(result);
});

module.exports = { register, login, getMe, refresh, changePassword, logout, logoutAll };
