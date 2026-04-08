const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');
describe('Auth Module', () => {
  const testUser = { firstName: 'Test', lastName: 'User', phone: '0712345678', password: 'password123', skills: ['plumbing'] };
  beforeEach(async () => { await prisma.application.deleteMany(); await prisma.job.deleteMany(); await prisma.user.deleteMany(); });
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);
      expect(res.status).toBe(201);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('token');
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
  });
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => { await request(app).post('/api/v1/auth/register').send(testUser); });
    it('should login with correct creds', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: testUser.password });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
    });
    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ phone: testUser.phone, password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });
  describe('GET /api/v1/auth/me', () => {
    it('should return profile with valid token', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${reg.body.data.token}`);
      expect(res.status).toBe(200);
    });
    it('should reject without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
