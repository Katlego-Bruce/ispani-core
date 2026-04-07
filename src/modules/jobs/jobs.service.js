const { prisma } = require('../../services/prisma');

exports.createJob = async (data) => {
  return prisma.job.create({
    data: {
      title: data.title,
      description: data.description,
      budget: data.budget,
      location: data.location,
      category: data.category,
      userId: data.userId,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
};

exports.listJobs = async ({ status, category, page, limit }) => {
  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getJobById = async (id) => {
  return prisma.job.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      _count: { select: { applications: true } },
    },
  });
};

exports.applyToJob = async ({ jobId, workerId, message }) => {
  // Check job exists and is open
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    const error = new Error('Job not found');
    error.statusCode = 404;
    throw error;
  }

  if (job.status !== 'open') {
    const error = new Error('This job is no longer accepting applications');
    error.statusCode = 400;
    throw error;
  }

  if (job.userId === workerId) {
    const error = new Error('You cannot apply to your own job');
    error.statusCode = 400;
    throw error;
  }

  return prisma.application.create({
    data: { jobId, workerId, message },
    include: {
      job: { select: { id: true, title: true } },
    },
  });
};

exports.getApplications = async (jobId, userId) => {
  // Verify the job belongs to the user
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job || job.userId !== userId) {
    const error = new Error('Not authorized to view these applications');
    error.statusCode = 403;
    throw error;
  }

  return prisma.application.findMany({
    where: { jobId },
    include: {
      worker: {
        select: { id: true, firstName: true, lastName: true, phone: true, skills: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

exports.updateApplication = async ({ applicationId, jobId, userId, status }) => {
  // Verify the job belongs to the user
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job || job.userId !== userId) {
    const error = new Error('Not authorized');
    error.statusCode = 403;
    throw error;
  }

  const application = await prisma.application.update({
    where: { id: applicationId },
    data: { status },
    include: {
      worker: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // If accepted, update job status to assigned
  if (status === 'accepted') {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'assigned' },
    });
  }

  return application;
};
