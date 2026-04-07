const jwt = require('jsonwebtoken');
const config = require('../config');

function generateToken(payload) {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
