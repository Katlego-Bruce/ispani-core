# 🌿 ISPANI Core — Step-by-Step Server Setup Guide

> **A complete guide to getting the ISPANI backend API running on your machine.**
> Three methods: Local, DevContainer (one-click), or Docker.
>
> *Derived from source code analysis of every file in the repository.*

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Method A — Local Development (Manual)](#2-method-a--local-development-manual)
3. [Method B — VS Code DevContainer (One-Click)](#3-method-b--vs-code-devcontainer-one-click)
4. [Method C — Docker](#4-method-c--docker)
5. [Verify It's Running](#5-verify-its-running)
6. [How the Database Connection Works](#6-how-the-database-connection-works)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Common Commands](#8-common-commands)
9. [API Quick Reference](#9-api-quick-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool | Minimum Version | Check Command | Install Link |
|:---|:---|:---|:---|
| **Node.js** | 20.0.0+ | `node -v` | [nodejs.org](https://nodejs.org) |
| **npm** | 9+ (ships with Node) | `npm -v` | Comes with Node.js |
| **PostgreSQL** | 15+ | `psql --version` | [postgresql.org/download](https://www.postgresql.org/download/) |
| **Redis** | 7+ *(optional)* | `redis-server --version` | [redis.io/download](https://redis.io/download) |
| **Git** | Any | `git --version` | [git-scm.com](https://git-scm.com) |

> **Note:** Redis is optional — it's only used for distributed job locking. The server will still start without it, but the job locking feature won't work.

---

## 2. Method A — Local Development (Manual)

This is the full step-by-step for running everything locally.

### Step 1: Clone the Repository

```bash
git clone https://github.com/Katlego-Bruce/ispani-core.git
cd ispani-core
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all production and dev dependencies from `package.json` (Express, Prisma, argon2, Twilio, Firebase, Zod, Pino, etc.)

### Step 3: Set Up PostgreSQL Database

Make sure PostgreSQL is running, then create a database and user:

```bash
# Start PostgreSQL (varies by OS)
# macOS (Homebrew):  brew services start postgresql
# Ubuntu:            sudo service postgresql start
# Windows:           Runs as a service after install

# Connect to PostgreSQL
sudo -u postgres psql
```

Inside the PostgreSQL shell:

```sql
CREATE USER ispani WITH PASSWORD 'ispani123' CREATEDB;
CREATE DATABASE ispani OWNER ispani;
\q
```

Verify it worked:

```bash
psql postgresql://ispani:ispani123@localhost:5432/ispani -c "SELECT 1"
```

Expected output:

```
 ?column?
----------
        1
(1 row)
```

### Step 4: Start Redis (Optional)

```bash
# macOS (Homebrew):  brew services start redis
# Ubuntu:            sudo service redis-server start
# Docker one-liner:  docker run -d -p 6379:6379 redis:7-alpine
```

### Step 5: Create the `.env` File

```bash
cp .env.example .env
```

Now edit `.env` with your actual values. **At minimum**, you need these two — the server **will exit** without them:

```dotenv
# ── REQUIRED (server won't start without these) ──────────
DATABASE_URL=postgresql://ispani:ispani123@localhost:5432/ispani
JWT_SECRET=your-super-secret-key-change-this-min-32-chars

# ── RECOMMENDED ───────────────────────────────────────────
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# ── RATE LIMITING (sensible defaults) ─────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20

# ── OPTIONAL INTEGRATIONS (skip for basic local dev) ──────
# TWILIO_ACCOUNT_SID=...       # Required only for OTP SMS
# TWILIO_AUTH_TOKEN=...
# TWILIO_PHONE_NUMBER=+27...
# FIREBASE_PROJECT_ID=...      # Required only for push notifications
# FIREBASE_CLIENT_EMAIL=...
# FIREBASE_PRIVATE_KEY="..."
```

> ⚠️ **`JWT_SECRET`** must be at least 32 characters. The server will log a warning if it's shorter.
>
> 💡 **Generate a strong secret:** `openssl rand -hex 32`

### Step 6: Generate the Prisma Client

```bash
npx prisma generate
```

This reads `prisma/schema.prisma` and generates the typed Prisma Client into `node_modules/@prisma/client`. You'll see:

```
✔ Generated Prisma Client to ./node_modules/@prisma/client
```

### Step 7: Run Database Migrations

```bash
npx prisma migrate dev
```

This will:
- Create all tables (User, Job, Application, Otp, Review, Payment)
- Set up enums (JobStatus, ApplicationStatus, PaymentStatus)
- Apply all indexes for performance

If this is a fresh database, Prisma will prompt you for a migration name — enter `init`.

**Alternative** (push schema without creating migration files):
```bash
npx prisma db push
```

### Step 8: (Optional) Seed the Database

```bash
npm run prisma:seed
```

Runs `prisma/seed.js` to populate the database with sample data.

### Step 9: Start the Development Server

```bash
npm run dev
```

This starts the server with **nodemon** (auto-restarts on file changes). You'll see output like:

```json
{"level":30,"msg":"Environment variables validated"}
{"level":30,"port":3000,"env":"development","msg":"ISPANI API started"}
{"level":30,"msg":"Health: http://localhost:3000/health"}
{"level":30,"msg":"API v1: http://localhost:3000/api/v1"}
```

**For production** (no auto-restart):
```bash
npm start
```

### ✅ Server is now running at `http://localhost:3000`

---

## 3. Method B — VS Code DevContainer (One-Click)

The easiest way — PostgreSQL, Redis, `.env`, dependencies, and migrations are all set up automatically inside a container.

### Prerequisites
- [VS Code](https://code.visualstudio.com/) with the **Dev Containers** extension
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running

### Steps

1. **Clone and open:**
   ```bash
   git clone https://github.com/Katlego-Bruce/ispani-core.git
   code ispani-core
   ```

2. **When VS Code opens**, click the notification:
   > "Reopen in Container"

   Or press `Ctrl+Shift+P` → **Dev Containers: Reopen in Container**

3. **Wait ~2-3 minutes** for the automated setup. The `setup.sh` script handles everything:
   - Installs PostgreSQL and Redis inside the container
   - Creates user `ispani` with password `ispani123`
   - Creates the `ispani` database
   - Generates `.env` with local dev defaults
   - Runs `npm install`
   - Runs `npx prisma generate`
   - Runs database migrations

4. **Start the server:**
   ```bash
   npm run dev
   ```

5. **Ports auto-forwarded:** 3000 (API), 5432 (PostgreSQL), 6379 (Redis)

### ✅ That's it — everything is running inside the container.

---

## 4. Method C — Docker

Run the production-ready Docker image with external PostgreSQL/Redis.

### Step 1: Start supporting services

```bash
# Start PostgreSQL
docker run -d \
  --name ispani-postgres \
  -e POSTGRES_USER=ispani \
  -e POSTGRES_PASSWORD=ispani123 \
  -e POSTGRES_DB=ispani \
  -p 5432:5432 \
  postgres:15-alpine

# Start Redis (optional)
docker run -d \
  --name ispani-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Step 2: Build the Docker image

```bash
cd ispani-core
docker build -t ispani-core .
```

The multi-stage Dockerfile:
- Uses `node:20-alpine` (small footprint)
- Runs `npm ci --omit=dev` (production deps only)
- Generates Prisma client at build time
- Runs as non-root user `ispani` (security)

### Step 3: Run database migrations

Before starting the container, run migrations:

```bash
# From the host machine (requires local Node.js + npm):
DATABASE_URL=postgresql://ispani:ispani123@localhost:5432/ispani npx prisma migrate deploy
```

### Step 4: Run the container

```bash
docker run -d \
  --name ispani-api \
  --network host \
  -e DATABASE_URL=postgresql://ispani:ispani123@localhost:5432/ispani \
  -e JWT_SECRET=your-super-secret-key-change-this-min-32-chars \
  -e REDIS_URL=redis://localhost:6379 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  ispani-core
```

### Step 5: Check logs

```bash
docker logs ispani-api
```

### ✅ Production container running at `http://localhost:3000`

---

## 5. Verify It's Running

Once the server is up (any method), test these endpoints:

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-04-09T...",
  "database": "connected",
  "version": "2.2.0"
}
```

> The health check runs `SELECT 1` against PostgreSQL (see `src/app.js`). If the database is down, you'll get `{"status": "error", "database": "disconnected"}` with HTTP 503.

### Register a Test User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "phone": "+27812345678",
    "password": "TestPassword123!"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+27812345678",
    "password": "TestPassword123!"
  }'
```

You'll get back a JWT token — use it as `Authorization: Bearer <token>` for all protected endpoints.

---

## 6. How the Database Connection Works

Understanding the full flow from `.env` → Prisma → PostgreSQL:

### Connection Flow

```
.env file
  │
  ├──▶ DATABASE_URL = "postgresql://ispani:ispani123@localhost:5432/ispani"
  │
  ▼
src/server.js
  │  require('dotenv').config()    ← loads .env into process.env
  │  validateEnv()                 ← checks DATABASE_URL + JWT_SECRET exist
  │
  ▼
prisma/schema.prisma
  │  datasource db {
  │    provider = "postgresql"
  │    url      = env("DATABASE_URL")    ← reads from process.env
  │  }
  │
  ▼
src/services/prisma.js
  │  const { PrismaClient } = require('@prisma/client')
  │  const prisma = new PrismaClient()   ← connects to PostgreSQL using DATABASE_URL
  │
  ▼
PostgreSQL Server
  │  Host: localhost
  │  Port: 5432
  │  Database: ispani
  │  User: ispani
  │  Password: ispani123
```

### What Happens at Startup

1. **`server.js`** calls `require('dotenv').config()` — loads `.env` into `process.env`
2. **`config/env.js`** → `validateEnv()` checks that `DATABASE_URL` and `JWT_SECRET` are present. If either is missing, the server **exits immediately** with a fatal log.
3. **Prisma Client** reads `DATABASE_URL` from `process.env` and establishes a connection pool to PostgreSQL.
4. **Express app** starts listening on the configured `PORT` (default 3000).
5. The **health check** (`GET /health`) runs `SELECT 1` against the database to confirm the connection is alive.

### Graceful Shutdown

When the server receives `SIGTERM` or `SIGINT`:
1. Stops accepting new HTTP connections
2. Calls `prisma.$disconnect()` to close the database connection pool
3. Exits with code 0

If the shutdown takes longer than 10 seconds, it force-exits with code 1.

### Connection String Format

```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

| Part | Value | Description |
|:---|:---|:---|
| `USER` | `ispani` | PostgreSQL username |
| `PASSWORD` | `ispani123` | User's password |
| `HOST` | `localhost` | PostgreSQL server host |
| `PORT` | `5432` | Default PostgreSQL port |
| `DATABASE` | `ispani` | Database name |

### Prisma Studio (Visual DB Browser)

To inspect your database visually:

```bash
npx prisma studio
```

Opens a web UI at `http://localhost:5555` where you can browse all tables, view records, and edit data.

---

## 7. Environment Variables Reference

### 🔴 Required (server exits without these)

| Variable | Example | Description |
|:---|:---|:---|
| `DATABASE_URL` | `postgresql://ispani:ispani123@localhost:5432/ispani` | PostgreSQL connection string |
| `JWT_SECRET` | `my-super-secret-key-at-least-32-chars!!` | JWT signing secret (≥32 chars) |

### 🟡 Recommended

| Variable | Default | Description |
|:---|:---|:---|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment mode |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection (for job locking) |
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |

### ⚙️ Rate Limiting

| Variable | Default | Description |
|:---|:---|:---|
| `RATE_LIMIT_WINDOW_MS` | `60000` | General rate limit window (ms) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Auth rate limit window (15 min) |
| `AUTH_RATE_LIMIT_MAX` | `5` | Max auth attempts per window |

### 🟢 Optional Integrations

| Variable | Required For | Description |
|:---|:---|:---|
| `TWILIO_ACCOUNT_SID` | OTP SMS | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | OTP SMS | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | OTP SMS | Sender number (`+27...`) |
| `FIREBASE_PROJECT_ID` | Push Notifications | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Push Notifications | Service account email |
| `FIREBASE_PRIVATE_KEY` | Push Notifications | Private key (escaped newlines) |

---

## 8. Common Commands

| Command | Description |
|:---|:---|
| `npm run dev` | Start dev server with nodemon (auto-reload) |
| `npm start` | Start production server |
| `npm test` | Run all Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint on `src/` |
| `npm run prisma:generate` | Regenerate Prisma client after schema changes |
| `npm run prisma:migrate` | Create & run a new database migration |
| `npm run prisma:deploy` | Apply pending migrations (production) |
| `npm run prisma:seed` | Seed the database with sample data |
| `npx prisma studio` | Open visual database browser |

---

## 9. API Quick Reference

Base URL: `http://localhost:3000/api/v1`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| `POST` | `/auth/register` | ❌ | Register new user |
| `POST` | `/auth/login` | ❌ | Login (returns JWT) |
| `GET` | `/auth/me` | ✅ | Get current user |
| `POST` | `/auth/send-otp` | ❌ | Send OTP via SMS |
| `POST` | `/auth/verify-otp` | ❌ | Verify OTP |
| `GET` | `/jobs` | ✅ | List all jobs |
| `POST` | `/jobs` | ✅ | Create a job |
| `GET` | `/jobs/:id` | ✅ | Get job details |
| `POST` | `/jobs/:id/apply` | ✅ | Apply to a job |
| `PATCH` | `/jobs/:id/start` | ✅ | Start a job |
| `PATCH` | `/jobs/:id/complete` | ✅ | Complete a job |
| `PATCH` | `/jobs/:id/cancel` | ✅ | Cancel a job |
| `GET` | `/jobs/:id/applications` | ✅ | View job applications |
| `POST` | `/jobs/:id/broadcast` | ✅ | Broadcast job to nearby workers |
| `GET` | `/matching/nearby` | ✅ | Find nearby workers |
| `GET` | `/users` | ✅ | List users |
| `PATCH` | `/users/me` | ✅ | Update profile |
| `PATCH` | `/users/location` | ✅ | Update GPS location |
| `POST` | `/reviews` | ✅ | Leave a review |
| `GET` | `/reviews/user/:id/stats` | ✅ | Get user review stats |
| `POST` | `/payments/create` | ✅ | Create escrow payment |
| `POST` | `/payments/release` | ✅ | Release payment to worker |
| `POST` | `/payments/refund` | ✅ | Refund payment |
| `POST` | `/payments/dispute` | ✅ | Dispute a payment |
| `GET` | `/admin/users` | ✅ 🛡️ | Admin: list all users |
| `GET` | `/admin/stats` | ✅ 🛡️ | Admin: platform statistics |

> ✅ = Requires `Authorization: Bearer <token>` header
> 🛡️ = Requires admin role (`isAdmin: true`)

---

## 10. Troubleshooting

### ❌ "Missing required environment variables: DATABASE_URL, JWT_SECRET"
**Cause:** `.env` file is missing or doesn't have these values.
**Fix:** `cp .env.example .env` and fill in `DATABASE_URL` + `JWT_SECRET`.

### ❌ "Can't reach database server"
**Cause:** PostgreSQL isn't running or the connection string is wrong.
**Fix:**
```bash
# Check if PostgreSQL is running
sudo service postgresql status   # Linux
brew services list               # macOS

# Verify connection manually
psql postgresql://ispani:ispani123@localhost:5432/ispani -c "SELECT 1"
```

### ❌ "JWT_SECRET should be at least 32 characters"
**Cause:** Your JWT_SECRET is too short (warning only — server still runs).
**Fix:** Generate a proper secret: `openssl rand -hex 32`

### ❌ "ECONNREFUSED 127.0.0.1:6379"
**Cause:** Redis isn't running. This is non-fatal — the server starts, but job locking won't work.
**Fix:** Start Redis or remove `REDIS_URL` from `.env` if you don't need locking.

### ❌ Prisma migration fails
**Cause:** Database doesn't exist or user lacks permissions.
**Fix:**
```bash
# Recreate database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ispani;"
sudo -u postgres psql -c "CREATE DATABASE ispani OWNER ispani;"
npx prisma migrate dev
```

### ❌ `argon2` build fails on install
**Cause:** Missing native build tools (argon2 has a C++ binding).
**Fix:**
```bash
# macOS:          xcode-select --install
# Ubuntu/Debian:  sudo apt-get install -y build-essential python3
# Windows:        npm install --global windows-build-tools
```

### ❌ Port 3000 already in use
**Fix:**
```bash
# Find the process
lsof -i :3000           # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Or change PORT in .env
echo "PORT=3001" >> .env
```

### ❌ `prisma generate` fails
**Cause:** Missing `prisma` devDependency.
**Fix:** `npm install` (it includes `prisma` as a devDependency).

---

*Generated from source code analysis of the [ispani-core](https://github.com/Katlego-Bruce/ispani-core) repository (v2.2.0).*
