# 🚀 ISPANI - Digital Labour Marketplace

South African digital labour marketplace connecting clients with skilled workers.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT + bcryptjs

## Getting Started

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma migrate dev

# Seed database (optional)
npm run prisma:seed

# Start development server
npm run dev
```

## Project Structure

```
ispani-core/
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js            # Server entry point
│   ├── config/              # Configuration
│   ├── services/            # Prisma, JWT services
│   ├── middleware/           # Auth, error handling
│   ├── modules/
│   │   ├── auth/            # Registration & Login
│   │   ├── users/           # User management
│   │   └── jobs/            # Job CRUD & applications
│   └── utils/               # Helpers
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.js              # Seed data
└── package.json
```

## API Endpoints

### Auth
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login & get JWT
- `GET /auth/me` - Get current user

### Users
- `GET /users` - List all users
- `GET /users/:id` - Get user by ID

### Jobs
- `POST /jobs` - Create a job (client only)
- `GET /jobs` - List all jobs
- `GET /jobs/:id` - Get job by ID
- `POST /jobs/:id/apply` - Apply to a job (worker only)
- `GET /jobs/:id/applications` - View applications (job owner)
- `PATCH /jobs/:id/applications/:appId` - Accept/reject application

## License

ISC
