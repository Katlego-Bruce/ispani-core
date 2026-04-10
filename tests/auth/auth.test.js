const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Auth Module', () => {
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    phone: '0712345678',
    password: 'Test@1234',
    skills: ['plumbing'],
    consent: true, // POPIA consent required
  };

  beforeEach(async () => {
    await prisma.passwordResetToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.review.deleteMany();
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register and return both tokens', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);
      expect(res.status).toBe(201);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject duplicate phone', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/register').send(testUser);
      expect(res.status).toBe(409);
    });

    it('should reject short password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ ...testUser, password: 'short' });
      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ ...testUser, password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid SA phone', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ ...testUser, phone: '1234567890' });
      expect(res.status).toBe(400);
    });

    it('should reject missing POPIA consent', async () => {
      const { consent, ...noConsent } = testUser;
      const res = await request(app).post('/api/v1/auth/register').send(noConsent);
      expect(res.status).toBe(400);
    });

    it('should reject consent: false', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ ...testUser, consent: false });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should login and return both tokens', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: 'Wrong@1234' });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent phone', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ phone: '0789999999', password: 'Test@1234' });
      expect(res.status).toBe(401);
    });

    it('should block banned user login', async () => {
      // Ban the user directly in DB
      const user = await prisma.user.findUnique({ where: { phone: testUser.phone } });
      await prisma.user.update({ where: { id: user.id }, data: { isBanned: true } });
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/banned/i);
    });

    it('should block suspended user login', async () => {
      const user = await prisma.user.findUnique({ where: { phone: testUser.phone } });
      await prisma.user.update({ where: { id: user.id }, data: { isSuspended: true } });
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/suspended/i);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return profile with valid token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('firstName', testUser.firstName);
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer fake.jwt.token');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new token pair (rotation)', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.data.refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      // New refresh token should be different (rotation)
      expect(res.body.data.refreshToken).not.toBe(reg.body.data.refreshToken);
    });

    it('should reject reuse of rotated token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const oldToken = reg.body.data.refreshToken;
      // First refresh succeeds and rotates
      await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldToken });
      // Second refresh with OLD token should fail
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldToken });
      expect(res.status).toBe(401);
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'fake-token' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should change password and return new tokens', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: testUser.password, newPassword: 'NewPass@5678' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should reject wrong current password', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: 'Wrong@1234', newPassword: 'NewPass@5678' });
      expect(res.status).toBe(401);
    });

    it('should invalidate old refresh token after password change', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const oldRefresh = reg.body.data.refreshToken;
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: testUser.password, newPassword: 'NewPass@5678' });
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });
      expect(res.status).toBe(401);
    });
  });

  describe('Password Reset Flow', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should generate reset token for valid phone', async () => {
      const res = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('resetToken');
    });

    it('should return generic message for unknown phone (no enumeration)', async () => {
      const res = await request(app).post('/api/v1/auth/request-reset').send({ phone: '0789999999' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if this phone/i);
    });

    it('should reset password with valid token', async () => {
      const reqRes = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      const resetToken = reqRes.body.data.resetToken;
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        token: resetToken,
        newPassword: 'Reset@9999',
      });
      expect(res.status).toBe(200);
      // Login with new password should work
      const loginRes = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: 'Reset@9999' });
      expect(loginRes.status).toBe(200);
    });

    it('should reject reuse of reset token', async () => {
      const reqRes = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      const resetToken = reqRes.body.data.resetToken;
      // First use
      await request(app).post('/api/v1/auth/reset-password').send({ token: resetToken, newPassword: 'Reset@9999' });
      // Second use should fail
      const res = await request(app).post('/api/v1/auth/reset-password').send({ token: resetToken, newPassword: 'Another@1111' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid reset token', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({ token: 'fake-token', newPassword: 'Reset@9999' });
      expect(res.status).toBe(400);
    });

    it('should invalidate all sessions after password reset', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      const oldRefresh = loginRes.body.data.refreshToken;
      const reqRes = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      await request(app).post('/api/v1/auth/reset-password').send({ token: reqRes.body.data.resetToken, newPassword: 'Reset@9999' });
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should invalidate refresh token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const { accessToken, refreshToken } = reg.body.data;
      const logoutRes = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`).send({ refreshToken });
      expect(logoutRes.status).toBe(200);
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('should invalidate all sessions', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      // Login again to create second session
      const login = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      // Logout all
      await request(app).post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      // Both refresh tokens should be invalid
      const r1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.data.refreshToken });
      const r2 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.data.refreshToken });
      expect(r1.status).toBe(401);
      expect(r2.status).toBe(401);
    });
  });
});
