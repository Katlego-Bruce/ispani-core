const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Auth Stress Tests', () => {
  const testUser = {
    firstName: 'Stress', lastName: 'Test',
    phone: '0712345678', password: 'Test@1234',
    skills: ['testing'], consent: true,
  };

  beforeEach(async () => {
    await prisma.passwordResetToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.review.deleteMany();
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Session Limits', () => {
    it('should allow max 5 concurrent sessions', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const tokens = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
        expect(res.status).toBe(200);
        tokens.push(res.body.data.refreshToken);
      }
      const count = await prisma.refreshToken.count();
      expect(count).toBeLessThanOrEqual(5);
    });

    it('should evict oldest session when 6th login occurs', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const tokens = [];
      for (let i = 0; i < 6; i++) {
        const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
        tokens.push(res.body.data.refreshToken);
      }
      // First token should be evicted
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokens[0] });
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('Token Rotation', () => {
    it('should rotate refresh token on refresh', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const oldRefresh = reg.body.data.refreshToken;
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });
      expect(res.status).toBe(200);
      expect(res.body.data.refreshToken).not.toBe(oldRefresh);
    });

    it('should reject old refresh token after rotation', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const oldRefresh = reg.body.data.refreshToken;
      await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });
      expect(res.status).toBe(401);
    });

    it('should issue new access token on refresh', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.data.refreshToken });
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.accessToken).toBeTruthy();
    });
  });

  describe('Account Status Enforcement', () => {
    it('should reject login for banned user', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      await prisma.user.update({ where: { id: reg.body.data.user.id }, data: { isBanned: true } });
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/banned/i);
    });

    it('should reject login for suspended user', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      await prisma.user.update({ where: { id: reg.body.data.user.id }, data: { isSuspended: true } });
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/suspended/i);
    });

    it('should reject refresh for banned user and revoke all sessions', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      await prisma.user.update({ where: { id: reg.body.data.user.id }, data: { isBanned: true } });
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.data.refreshToken });
      expect(res.status).toBe(403);
      const count = await prisma.refreshToken.count({ where: { userId: reg.body.data.user.id } });
      expect(count).toBe(0);
    });

    it('should reject login for soft-deleted user', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      await prisma.user.update({ where: { id: reg.body.data.user.id }, data: { deletedAt: new Date() } });
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      expect(res.status).toBe(401);
    });
  });

  describe('Password Reset Flow', () => {
    it('should generate reset token', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('resetToken');
    });

    it('should not leak user existence on invalid phone', async () => {
      const res = await request(app).post('/api/v1/auth/request-reset').send({ phone: '0799999999' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if this phone/i);
    });

    it('should reset password with valid token', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const resetRes = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      const token = resetRes.body.data.resetToken;
      const res = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'NewPass@123' });
      expect(res.status).toBe(200);
      // Login with new password
      const loginRes = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: 'NewPass@123' });
      expect(loginRes.status).toBe(200);
    });

    it('should reject reused reset token', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const resetRes = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      const token = resetRes.body.data.resetToken;
      await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'NewPass@123' });
      const res = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'AnotherPass@123' });
      expect(res.status).toBe(400);
    });

    it('should invalidate old reset tokens when new one requested', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const first = await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      const firstToken = first.body.data.resetToken;
      await request(app).post('/api/v1/auth/request-reset').send({ phone: testUser.phone });
      // First token should now be marked as used
      const res = await request(app).post('/api/v1/auth/reset-password').send({ token: firstToken, newPassword: 'NewPass@123' });
      expect(res.status).toBe(400);
    });
  });

  describe('Logout & Session Management', () => {
    it('should logout and invalidate refresh token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const { accessToken, refreshToken } = reg.body.data;
      const res = await request(app).post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      expect(res.status).toBe(200);
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(refreshRes.status).toBe(401);
    });

    it('should logout all sessions', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      // Create additional sessions
      await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      const res = await request(app).post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      expect(res.status).toBe(200);
      const count = await prisma.refreshToken.count({ where: { userId: reg.body.data.user.id } });
      expect(count).toBe(0);
    });

    it('should clear presence data on logout', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      await prisma.user.update({ where: { id: reg.body.data.user.id }, data: { isOnline: true, fcmToken: 'test-token' } });
      await request(app).post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ refreshToken: reg.body.data.refreshToken });
      const user = await prisma.user.findUnique({ where: { id: reg.body.data.user.id } });
      expect(user.isOnline).toBe(false);
      expect(user.fcmToken).toBeNull();
    });
  });

  describe('Change Password', () => {
    it('should change password and invalidate all sessions', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: testUser.password, newPassword: 'NewStrong@456' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      // Old refresh token should be invalid
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.data.refreshToken });
      expect(refreshRes.status).toBe(401);
    });

    it('should reject wrong current password', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: 'WrongPass@123', newPassword: 'NewStrong@456' });
      expect(res.status).toBe(401);
    });
  });

  describe('Auth Middleware', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('should return user data with valid token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.firstName).toBe(testUser.firstName);
    });
  });
});
