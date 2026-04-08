const { verifyToken } = require('../services/jwt');
const { prisma } = require('../services/prisma');
const logger = require('../services/logger');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        skills: true,
        location: true,
        isAdmin: true,
        isSuspended: true,
        isBanned: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn({ requestId: req.id, error: error.message }, 'Authentication failed');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
