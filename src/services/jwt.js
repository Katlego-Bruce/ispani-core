const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

function generateAccessToken(payload) {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

module.exports = { generateAccessToken, verifyToken, generateRefreshToken };
