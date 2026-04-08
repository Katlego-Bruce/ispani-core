const { prisma } = require('../src/services/prisma');

beforeAll(async () => {
  // Clean database before test suite
  await prisma.application.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Clean up and disconnect
  await prisma.application.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
