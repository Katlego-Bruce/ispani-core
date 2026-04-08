const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');
describe('Jobs Module', () => {
  let token, userId;
  const user = { firstName: 'Job', lastName: 'Creator', phone: '0711111111', password: 'password123', skills: [] };
  const job = { title: 'Fix Kitchen Sink', description: 'Need a plumber to fix a leaking kitchen sink urgently', budget: 500, location: 'Johannesburg', category: 'plumbing' };
  beforeEach(async () => {
    await prisma.application.deleteMany(); await prisma.job.deleteMany(); await prisma.user.deleteMany();
    const res = await request(app).post('/api/v1/auth/register').send(user);
    token = res.body.data.token; userId = res.body.data.user.id;
  });
  describe('POST /api/v1/jobs', () => {
    it('should create a job', async () => {
      const res = await request(app).post('/api/v1/jobs').set('Authorization', `Bearer ${token}`).send(job);
      expect(res.status).toBe(201); expect(res.body.data.status).toBe('OPEN');
    });
    it('should reject without auth', async () => {
      const res = await request(app).post('/api/v1/jobs').send(job);
      expect(res.status).toBe(401);
    });
  });
  describe('GET /api/v1/jobs', () => {
    it('should list with pagination', async () => {
      await request(app).post('/api/v1/jobs').set('Authorization', `Bearer ${token}`).send(job);
      const res = await request(app).get('/api/v1/jobs?page=1&limit=10');
      expect(res.status).toBe(200); expect(res.body.data.jobs).toHaveLength(1);
    });
  });
  describe('Status transitions', () => {
    it('should cancel open job (owner)', async () => {
      const cr = await request(app).post('/api/v1/jobs').set('Authorization', `Bearer ${token}`).send(job);
      const res = await request(app).patch(`/api/v1/jobs/${cr.body.data.id}/cancel`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200); expect(res.body.data.status).toBe('CANCELLED');
    });
    it('should reject non-owner cancel', async () => {
      const cr = await request(app).post('/api/v1/jobs').set('Authorization', `Bearer ${token}`).send(job);
      const other = await request(app).post('/api/v1/auth/register').send({ firstName: 'O', lastName: 'U', phone: '0722222222', password: 'password123', skills: [] });
      const res = await request(app).patch(`/api/v1/jobs/${cr.body.data.id}/cancel`).set('Authorization', `Bearer ${other.body.data.token}`);
      expect(res.status).toBe(403);
    });
  });
});
