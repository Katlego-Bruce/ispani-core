const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/services/prisma');
describe('Users Module', () => {
  let token, userId;
  beforeEach(async () => {
    await prisma.application.deleteMany(); await prisma.job.deleteMany();
    await prisma.refreshToken.deleteMany(); await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
    const r = await request(app).post('/api/v1/auth/register').send({ firstName:'Test',lastName:'User',phone:'0712345678',password:'Password123!',skills:['carpentry'],consent:true });
    token = r.body.data.accessToken; userId = r.body.data.user.id;
  });
  it('should list users', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization',`Bearer ${token}`);
    expect(res.status).toBe(200); expect(res.body.data.users).toHaveLength(1);
  });
  it('should get user by id', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}`).set('Authorization',`Bearer ${token}`);
    expect(res.status).toBe(200);
  });
  it('should update profile', async () => {
    const res = await request(app).patch('/api/v1/users/me').set('Authorization',`Bearer ${token}`).send({bio:'Hello'});
    expect(res.status).toBe(200); expect(res.body.data.bio).toBe('Hello');
  });
  it('should update location', async () => {
    const res = await request(app).patch('/api/v1/users/location').set('Authorization',`Bearer ${token}`).send({latitude:-26.2,longitude:28.0});
    expect(res.status).toBe(200); expect(res.body.data.isOnline).toBe(true);
  });
  it('should set online/offline', async () => {
    const res = await request(app).patch('/api/v1/users/status').set('Authorization',`Bearer ${token}`).send({isOnline:false});
    expect(res.status).toBe(200); expect(res.body.data.isOnline).toBe(false);
  });
});
