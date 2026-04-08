const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const user1 = await prisma.user.upsert({
    where: { phone: '0712345678' },
    update: {},
    create: {
      firstName: 'Thabo',
      lastName: 'Mokoena',
      phone: '0712345678',
      password: hashedPassword,
      location: 'Johannesburg',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { phone: '0798765432' },
    update: {},
    create: {
      firstName: 'Sipho',
      lastName: 'Dlamini',
      phone: '0798765432',
      password: hashedPassword,
      skills: ['plumbing', 'electrical', 'painting'],
      location: 'Soweto',
    },
  });

  await prisma.job.create({
    data: {
      title: 'Fix leaking tap',
      description: 'Kitchen tap has been leaking for a week. Need someone to fix it ASAP.',
      budget: 350,
      location: 'Sandton',
      category: 'plumbing',
      userId: user1.id,
    },
  });

  await prisma.job.create({
    data: {
      title: 'Paint bedroom walls',
      description: 'Need two bedroom walls painted white. Paint provided.',
      budget: 500,
      location: 'Soweto',
      category: 'painting',
      userId: user2.id,
    },
  });

  console.log('Seed completed!');
  console.log('Both users can create jobs AND apply to others jobs.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
