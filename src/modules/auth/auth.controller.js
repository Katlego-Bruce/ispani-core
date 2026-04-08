const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    message: 'User registered successfully',
    data: result,
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.json({
    message: 'Login successful',
    data: result,
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ data: req.user });
});

module.exports = { register, login, getMe };
