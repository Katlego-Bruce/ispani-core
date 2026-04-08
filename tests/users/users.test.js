const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Users Module', () => {
  let userToken;
  let userId;

  beforeEach(async () => {
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    const res = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Test', lastName: 'User', phone: '0712345678',
      password: 'password123', skills: ['carpentry'],
    });
    userToken = res.body.data.token;
    userId = res.body.data.user.id;
  });

  describe('GET /api/v1/users', () => {
    it('should list users with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.pagination).toHaveProperty('total', 1);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Test');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update profile', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: 'Experienced carpenter' });

      expect(res.status).toBe(200);
      expect(res.body.data.bio).toBe('Experienced carpenter');
    });
  });

  describe('PATCH /api/v1/users/location', () => {
    it('should update location (any authenticated user)', async () => {
      const res = await request(app)
        .patch('/api/v1/users/location')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ latitude: -26.2041, longitude: 28.0473 });

      expect(res.status).toBe(200);
      expect(res.body.data.latitude).toBeCloseTo(-26.2041);
      expect(res.body.data.isOnline).toBe(true);
    });
  });

  describe('PATCH /api/v1/users/status', () => {
    it('should set online status', async () => {
      const res = await request(app)
        .patch('/api/v1/users/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isOnline: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isOnline).toBe(true);
    });

    it('should set offline status', async () => {
      const res = await request(app)
        .patch('/api/v1/users/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isOnline: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isOnline).toBe(false);
    });
  });
});
