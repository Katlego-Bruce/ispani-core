const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create sample client
  const client1 = await prisma.user.upsert({
    where: { phone: '0712345678' },
    update: {},
    create: {
      firstName: 'Thabo',
      lastName: 'Mokoena',
      phone: '0712345678',
      password: hashedPassword,
      role: 'client',
      location: 'Johannesburg',
    },
  });

  // Create sample worker
  const worker1 = await prisma.user.upsert({
    where: { phone: '0798765432' },
    update: {},
    create: {
      firstName: 'Sipho',
      lastName: 'Dlamini',
      phone: '0798765432',
      password: hashedPassword,
      role: 'worker',
      skills: ['plumbing', 'electrical', 'painting'],
      location: 'Soweto',
    },
  });

  // Create sample job
  await prisma.job.create({
    data: {
      title: 'Fix leaking tap',
      description: 'Kitchen tap has been leaking for a week. Need someone to fix it ASAP.',
      budget: 350,
      location: 'Sandton',
      category: 'plumbing',
      userId: client1.id,
    },
  });

  console.log('✅ Seed completed!');
  console.log({ client1, worker1 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
