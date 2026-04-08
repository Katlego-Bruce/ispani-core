const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');
describe('Applications', () => {
  let ownerToken, appToken, app2Token, jobId;
  beforeEach(async () => {
    await prisma.application.deleteMany(); await prisma.job.deleteMany(); await prisma.user.deleteMany();
    const o = await request(app).post('/api/v1/auth/register').send({ firstName:'O',lastName:'U',phone:'0711111111',password:'password123',skills:[] });
    ownerToken = o.body.data.token;
    const a1 = await request(app).post('/api/v1/auth/register').send({ firstName:'A',lastName:'1',phone:'0722222222',password:'password123',skills:['plumbing'] });
    appToken = a1.body.data.token;
    const a2 = await request(app).post('/api/v1/auth/register').send({ firstName:'A',lastName:'2',phone:'0733333333',password:'password123',skills:[] });
    app2Token = a2.body.data.token;
    const j = await request(app).post('/api/v1/jobs').set('Authorization',`Bearer ${ownerToken}`).send({ title:'Fix',description:'Fix the broken pipe please',budget:300,location:'CT',category:'plumbing' });
    jobId = j.body.data.id;
  });
  it('should apply to job', async () => {
    const res = await request(app).post(`/api/v1/jobs/${jobId}/apply`).set('Authorization',`Bearer ${appToken}`).send({message:'I can!'});
    expect(res.status).toBe(201);
  });
  it('should not apply to own job', async () => {
    const res = await request(app).post(`/api/v1/jobs/${jobId}/apply`).set('Authorization',`Bearer ${ownerToken}`).send({message:'Me'});
    expect(res.status).toBe(400);
  });
  it('should accept and reject others atomically', async () => {
    await request(app).post(`/api/v1/jobs/${jobId}/apply`).set('Authorization',`Bearer ${appToken}`).send({message:'A'});
    await request(app).post(`/api/v1/jobs/${jobId}/apply`).set('Authorization',`Bearer ${app2Token}`).send({message:'B'});
    const apps = await request(app).get(`/api/v1/jobs/${jobId}/applications`).set('Authorization',`Bearer ${ownerToken}`);
    const firstId = apps.body.data[0].id;
    await request(app).patch(`/api/v1/jobs/${jobId}/applications/${firstId}`).set('Authorization',`Bearer ${ownerToken}`).send({status:'ACCEPTED'});
    const jobRes = await request(app).get(`/api/v1/jobs/${jobId}`);
    expect(jobRes.body.data.status).toBe('ASSIGNED');
  });
});
