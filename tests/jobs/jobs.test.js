const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Jobs Module', () => {
  let userToken;
  let userId;

  const testUser = {
    firstName: 'Job',
    lastName: 'Creator',
    phone: '0711111111',
    password: 'password123',
    skills: [],
  };

  const testJob = {
    title: 'Fix Kitchen Sink',
    description: 'Need a plumber to fix a leaking kitchen sink urgently',
    budget: 500,
    location: 'Johannesburg, Sandton',
    category: 'plumbing',
    latitude: -26.1076,
    longitude: 28.0567,
  };

  beforeEach(async () => {
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    const res = await request(app).post('/api/v1/auth/register').send(testUser);
    userToken = res.body.data.token;
    userId = res.body.data.user.id;
  });

  describe('POST /api/v1/jobs', () => {
    it('should create a job (any authenticated user)', async () => {
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testJob);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Fix Kitchen Sink');
      expect(res.body.data.status).toBe('OPEN');
    });

    it('should reject job creation without auth', async () => {
      const res = await request(app).post('/api/v1/jobs').send(testJob);
      expect(res.status).toBe(401);
    });

    it('should reject job with missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'No' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/jobs', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testJob);
    });

    it('should list jobs with pagination', async () => {
      const res = await request(app).get('/api/v1/jobs?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data.jobs).toHaveLength(1);
      expect(res.body.data.pagination).toHaveProperty('total', 1);
    });

    it('should filter jobs by status', async () => {
      const res = await request(app).get('/api/v1/jobs?status=OPEN');
      expect(res.status).toBe(200);
      expect(res.body.data.jobs.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/jobs/:id', () => {
    it('should get job by ID', async () => {
      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testJob);

      const jobId = createRes.body.data.id;
      const res = await request(app).get(`/api/v1/jobs/${jobId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(jobId);
    });

    it('should return 404 for non-existent job', async () => {
      const res = await request(app).get('/api/v1/jobs/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('Job Status Transitions', () => {
    it('should cancel an open job (owner only)', async () => {
      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testJob);

      const jobId = createRes.body.data.id;
      const res = await request(app)
        .patch(`/api/v1/jobs/${jobId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('should not allow non-owner to cancel', async () => {
      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testJob);

      const otherUser = await request(app).post('/api/v1/auth/register').send({
        firstName: 'Other', lastName: 'User', phone: '0722222222', password: 'password123', skills: [],
      });

      const res = await request(app)
        .patch(`/api/v1/jobs/${createRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${otherUser.body.data.token}`);

      expect(res.status).toBe(403);
    });
  });
});
