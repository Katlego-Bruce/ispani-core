const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Auth Module', () => {
  // Password meets complexity: uppercase, lowercase, number, special char
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    phone: '0712345678',
    password: 'Test@1234',
    skills: ['plumbing'],
  };

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
  });

  // ─── Register ────────────────────────────────────────
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return both tokens', async () => {
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

    it('should reject weak password (no uppercase/special)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ ...testUser, password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid SA phone number', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ ...testUser, phone: '1234567890' });
      expect(res.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      await request(app).post('/api/v1/auth/register').send({ ...testUser, email: 'test@ispani.co.za' });
      const res = await request(app).post('/api/v1/auth/register').send({
        ...testUser, phone: '0712345679', email: 'test@ispani.co.za',
      });
      expect(res.status).toBe(409);
    });
  });

  // ─── Login ───────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should login with correct creds and return both tokens', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        phone: testUser.phone, password: testUser.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        phone: testUser.phone, password: 'Wrong@1234',
      });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent phone', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        phone: '0799999999', password: testUser.password,
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /me ─────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('should return profile with valid token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id');
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject with malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });

  // ─── Refresh Token ───────────────────────────────────
  describe('POST /api/v1/auth/refresh', () => {
    it('should return new access token with valid refresh token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: reg.body.data.refreshToken,
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: 'totally-fake-token',
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── Change Password ─────────────────────────────────
  describe('POST /api/v1/auth/change-password', () => {
    it('should change password and return new tokens', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: testUser.password, newPassword: 'NewPass@5678' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject wrong current password', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: 'Wrong@1234', newPassword: 'NewPass@5678' });
      expect(res.status).toBe(401);
    });

    it('should allow login with new password after change', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
        .send({ currentPassword: testUser.password, newPassword: 'NewPass@5678' });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        phone: testUser.phone, password: 'NewPass@5678',
      });
      expect(loginRes.status).toBe(200);
    });
  });

  // ─── Logout ──────────────────────────────────────────
  describe('POST /api/v1/auth/logout', () => {
    it('should invalidate refresh token on logout', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const { accessToken, refreshToken } = reg.body.data;

      // Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      expect(logoutRes.status).toBe(200);

      // Refresh should now fail
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(refreshRes.status).toBe(401);
    });
  });
});
