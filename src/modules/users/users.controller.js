const usersService = require('./users.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.listUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;

  const result = await usersService.listUsers({
    role,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({ data: result });
});

exports.getUserById = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ data: user });
});
