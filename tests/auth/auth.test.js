const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Auth Module', () => {
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    phone: '0712345678',
    password: 'password123',
    skills: ['plumbing'],
  };

  beforeEach(async () => {
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.firstName).toBe('Test');
      expect(res.body.data.user.phone).toBe('0712345678');
      expect(res.body.data).toHaveProperty('token');
      // No role field in response
      expect(res.body.data.user).not.toHaveProperty('role');
    });

    it('should reject duplicate phone number', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/register').send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');
    });

    it('should reject invalid phone format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUser, phone: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should reject password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUser, password: 'short' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: testUser.phone, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.phone).toBe(testUser.phone);
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: testUser.phone, password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent phone', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '0000000000', password: 'anything' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      const token = registerRes.body.data.token;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Test');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });
  });
});
