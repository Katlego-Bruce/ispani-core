const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, password, role, skills } = req.body;

  const result = await authService.register({
    firstName,
    lastName,
    phone,
    password,
    role,
    skills: skills || [],
  });

  res.status(201).json({
    message: 'User registered successfully',
    data: result,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  const result = await authService.login({ phone, password });

  res.json({
    message: 'Login successful',
    data: result,
  });
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({
    data: req.user,
  });
});
