const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Auth Module', () => {
  const testUser = { firstName: 'Test', lastName: 'User', phone: '0712345678', password: 'Test@1234', skills: ['plumbing'] };

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
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
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => { await request(app).post('/api/v1/auth/register').send(testUser); });

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
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return profile with valid token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new access token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.data.refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
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
});
