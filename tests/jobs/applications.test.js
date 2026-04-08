const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');

describe('Applications Module', () => {
  let ownerToken, applicantToken, applicant2Token;
  let ownerId, applicantId, applicant2Id;
  let jobId;

  beforeEach(async () => {
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    // Create job owner
    const owner = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Owner', lastName: 'User', phone: '0711111111', password: 'password123', skills: [],
    });
    ownerToken = owner.body.data.token;
    ownerId = owner.body.data.user.id;

    // Create applicants
    const app1 = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Applicant', lastName: 'One', phone: '0722222222', password: 'password123', skills: ['plumbing'],
    });
    applicantToken = app1.body.data.token;
    applicantId = app1.body.data.user.id;

    const app2 = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Applicant', lastName: 'Two', phone: '0733333333', password: 'password123', skills: ['electrical'],
    });
    applicant2Token = app2.body.data.token;
    applicant2Id = app2.body.data.user.id;

    // Create job
    const job = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Fix Pipe', description: 'Leaking pipe needs fixing', budget: 300,
        location: 'Cape Town', category: 'plumbing',
      });
    jobId = job.body.data.id;
  });

  describe('POST /api/v1/jobs/:id/apply', () => {
    it('should allow user to apply to a job', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ message: 'I can fix this!' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Application submitted');
    });

    it('should not allow applying to own job', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ message: 'My own job' });

      expect(res.status).toBe(400);
    });

    it('should not allow duplicate application', async () => {
      await request(app)
        .post(`/api/v1/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ message: 'First try' });

      const res = await request(app)
        .post(`/api/v1/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ message: 'Second try' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Application Accept Flow', () => {
    it('should accept application and reject others atomically', async () => {
      // Two applicants apply
      await request(app).post(`/api/v1/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${applicantToken}`).send({ message: 'Me!' });
      await request(app).post(`/api/v1/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${applicant2Token}`).send({ message: 'Me too!' });

      // Get applications
      const appsRes = await request(app)
        .get(`/api/v1/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const firstAppId = appsRes.body.data[0].id;

      // Accept first application
      const res = await request(app)
        .patch(`/api/v1/jobs/${jobId}/applications/${firstAppId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'ACCEPTED' });

      expect(res.status).toBe(200);

      // Verify job is ASSIGNED
      const jobRes = await request(app).get(`/api/v1/jobs/${jobId}`);
      expect(jobRes.body.data.status).toBe('ASSIGNED');

      // Verify other application was rejected
      const updatedApps = await request(app)
        .get(`/api/v1/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const rejected = updatedApps.body.data.filter(a => a.status === 'REJECTED');
      expect(rejected.length).toBe(1);
    });
  });
});
