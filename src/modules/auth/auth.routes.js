const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const registerSchema = {
  firstName: { required: true, type: 'string', minLength: 2 },
  lastName: { required: true, type: 'string', minLength: 2 },
  phone: { required: true, type: 'string', minLength: 10 },
  password: { required: true, type: 'string', minLength: 6 },
  role: { required: true, type: 'string', enum: ['client', 'worker'] },
};

const loginSchema = {
  phone: { required: true, type: 'string' },
  password: { required: true, type: 'string' },
};

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
