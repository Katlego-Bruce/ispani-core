const { prisma } = require('../src/services/prisma');
beforeAll(async () => {
  await prisma.application.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => {
  await prisma.application.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
