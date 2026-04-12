# 🚀 ISPANI Core — Render Deployment Guide

> **Deploy ispani-core (v2.3.0) to Render step-by-step.**
> Derived from actual source code analysis — `server.js`, `config/`, `prisma/schema.prisma`, `Dockerfile`, and CI pipeline.

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Step 1 — Create a PostgreSQL Database on Render](#2-step-1--create-a-postgresql-database-on-render)
3. [Step 2 — Create a Redis Instance (Optional)](#3-step-2--create-a-redis-instance-optional)
4. [Step 3 — Create the Web Service](#4-step-3--create-the-web-service)
5. [Step 4 — Configure Environment Variables](#5-step-4--configure-environment-variables)
6. [Step 5 — Deploy & Run Migrations](#6-step-5--deploy--run-migrations)
7. [Step 6 — Verify the Deployment](#7-step-6--verify-the-deployment)
8. [Auto-Deploy from GitHub](#8-auto-deploy-from-github)
9. [Render Blueprint (render.yaml)](#9-render-blueprint-renderyaml)
10. [Known Issues & Troubleshooting](#10-known-issues--troubleshooting)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Useful Render Commands](#12-useful-render-commands)

---

## 1. Prerequisites

| Requirement | Details |
|:---|:---|
| **Render account** | [render.com](https://render.com) — free tier available |
| **GitHub repo** | `Katlego-Bruce/ispani-core` connected to Render |
| **Node.js** | 20+ (defined in `package.json` → `engines.node`) |
| **PostgreSQL** | Required — Prisma ORM connects via `DATABASE_URL` |
| **Redis** | Optional — only used for distributed job locking (`src/services/redis.js`) |

### What the App Needs to Start

From `src/config/env.js`, the server **will not start** without these:

```
DATABASE_URL   → PostgreSQL connection string (Prisma)
JWT_SECRET     → Minimum 32 characters
```

All other env vars have sensible defaults (see [Section 11](#11-environment-variables-reference)).

---

## 2. Step 1 — Create a PostgreSQL Database on Render


> **📌 Note**: A PostgreSQL database `ispani-db` has already been created on Render:
> - **ID**: `dpg-d7e0n8navr4c73edbugg-a`
> - **Region**: Oregon
> - **Plan**: Free
> - **Status**: Created (check dashboard for connection strings once ready)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**
2. Configure:
   - **Name**: `ispani-db`
   - **Database**: `ispani`
   - **User**: `ispani`
   - **Region**: Choose closest to your users (e.g., `Oregon` or `Frankfurt`)
   - **Plan**: Free tier works for development; **Starter ($7/mo)** for production
3. Click **Create Database**
4. Once created, go to the database page and copy the **Internal Database URL** — it looks like:
   ```
   postgresql://ispani:PASSWORD@dpg-xxxxx-a.oregon-postgres.render.com/ispani
   ```

> **⚠️ Important**: Use the **Internal Database URL** (not External) if your web service and database are in the same Render region. This is faster and free of egress charges.

> **⚠️ Free Tier Warning**: Render free PostgreSQL databases are deleted after 90 days. Use Starter plan ($7/mo) for persistent data.

---

## 3. Step 2 — Create a Redis Instance (Optional)

Redis is **optional** — it's only used for job locking in `src/services/redis.js`. The app starts fine without it.

If you need it:

1. **Render Dashboard** → **New** → **Redis**
2. Configure:
   - **Name**: `ispani-redis`
   - **Plan**: Free tier (25MB) is sufficient for job locks
   - **Region**: Same as your database
3. Copy the **Internal Redis URL**:
   ```
   redis://red-xxxxx-a.oregon-redis.render.com:6379
   ```

---

## 4. Step 3 — Create the Web Service

### Option A: Deploy from Dockerfile (Recommended)

The repo has a production-ready multi-stage `Dockerfile`:

1. **Render Dashboard** → **New** → **Web Service**
2. Connect your GitHub repo: `Katlego-Bruce/ispani-core`
3. Configure:

   | Setting | Value |
   |:---|:---|
   | **Name** | `ispani-core` |
   | **Region** | Same as your database |
   | **Branch** | `main` |
   | **Runtime** | **Docker** |
   | **Plan** | Free (for testing) or Starter ($7/mo) |

4. Click **Create Web Service** (don't deploy yet — set env vars first)

### Option B: Deploy as Node.js (Native Runtime)

If you prefer not to use Docker:

1. Same steps as above, but choose **Node** as runtime
2. Set these commands:

   | Setting | Value |
   |:---|:---|
   | **Build Command** | `npm ci && npx prisma generate && npx prisma migrate deploy` |
   | **Start Command** | `node src/server.js` |
   | **Node Version** | `20` |

> **Why `prisma migrate deploy`** in the build command? This runs pending migrations against your production database during each deploy. It's idempotent — safe to re-run.

---

## 5. Step 4 — Configure Environment Variables

Go to your web service → **Environment** tab → Add these:

### 🔴 Required (Server won't start without these)

| Variable | Value | Source |
|:---|:---|:---|
| `DATABASE_URL` | `postgresql://ispani:PASSWORD@dpg-xxx.render.com/ispani` | From Step 1 (Internal URL) |
| `JWT_SECRET` | A random string, **minimum 32 characters** | Generate: `openssl rand -base64 48` |

### 🟡 Recommended for Production

| Variable | Value | Why |
|:---|:---|:---|
| `NODE_ENV` | `production` | Disables pretty logging, enables stricter error messages |
| `PORT` | `3000` | Default in code — Render auto-sets this, but explicit is safer |
| `ALLOWED_ORIGINS` | `https://your-frontend.com` | CORS — comma-separated origins. **Without this, only `http://localhost:3000` is allowed** (from `src/config/index.js`) |

### 🟢 Optional Services

| Variable | Value | When Needed |
|:---|:---|:---|
| `REDIS_URL` | `redis://red-xxx.render.com:6379` | Only if using Redis for job locking |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID | Push notifications (`src/services/firebase.js`) |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxx@project.iam.gserviceaccount.com` | Push notifications |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` | Push notifications — **⚠️ Must include literal `\n` newlines** |
| `TWILIO_ACCOUNT_SID` | Your Twilio SID | OTP SMS (`src/services/twilio.js`) |
| `TWILIO_AUTH_TOKEN` | Your Twilio auth token | OTP SMS |
| `TWILIO_PHONE_NUMBER` | `+27xxxxxxxxx` | OTP sender number |

### 🔧 Tuning (All have defaults in code)

| Variable | Default | Description |
|:---|:---|:---|
| `LOG_LEVEL` | `info` | Pino log level (`src/services/logger.js`) |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `7` | Refresh token TTL in days |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (1 minute) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Auth rate limit window (15 min) |
| `AUTH_RATE_LIMIT_MAX` | `5` | Max auth attempts per window |

---

## 6. Step 5 — Deploy & Run Migrations

### If Using Docker (Option A)

Render will build the Docker image automatically. But the Dockerfile does **NOT** run migrations — you need to run them manually the first time:

1. After the first deploy, go to **Shell** tab in your Render web service
2. Run:
   ```bash
   npx prisma migrate deploy
   ```
3. (Optional) Seed the database:
   ```bash
   node prisma/seed.js
   ```

> **For subsequent deploys**: Add a **Pre-Deploy Command** in Render settings:
> ```
> npx prisma migrate deploy
> ```
> This ensures migrations run automatically on every deploy.

### If Using Node.js Runtime (Option B)

Migrations are included in the build command, so they run automatically on every deploy.

---

## 7. Step 6 — Verify the Deployment

### Health Check

Once deployed, hit the health endpoint:

```bash
curl https://ispani-core.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-12T20:00:00.000Z",
  "database": "connected",
  "version": "2.3.0"
}
```

If you see `"database": "disconnected"`, your `DATABASE_URL` is wrong — double-check the Internal URL from Step 1.

### API Endpoints

```bash
# Auth
curl https://ispani-core.onrender.com/api/v1/auth/register \
  -X POST -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","phone":"0712345678","password":"Test1234!"}'

# Health
curl https://ispani-core.onrender.com/health
```

### Render Logs

Check real-time logs: **Render Dashboard** → Your service → **Logs** tab

Look for:
```
ISPANI API started {"port":3000,"env":"production"}
Environment variables validated
```

If you see `Missing required environment variables: DATABASE_URL, JWT_SECRET` — your env vars aren't set correctly.

---

## 8. Auto-Deploy from GitHub

Render auto-deploys on every push to `main` by default.

### How It Works

1. You push code to `main` branch on GitHub
2. Render detects the push via webhook
3. Render rebuilds (Docker build or `npm ci`) and redeploys
4. Zero-downtime deployment — old instance serves traffic until new one is healthy

### Configure

In Render Dashboard → Your service → **Settings**:

- **Auto-Deploy**: `Yes` (default)
- **Branch**: `main`
- **Render uses the Dockerfile** at the repo root

### Disable Auto-Deploy

If you want manual control, set **Auto-Deploy** to `No`. Then trigger deploys manually from the dashboard or via Render API.

---

## 9. Render Blueprint (render.yaml)

Add this file to your repo root for one-click infrastructure setup:

```yaml
# render.yaml
services:
  - type: web
    name: ispani-core
    runtime: docker
    repo: https://github.com/Katlego-Bruce/ispani-core
    branch: main
    region: oregon
    plan: starter
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: ispani-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3000"
      - key: REDIS_URL
        fromService:
          name: ispani-redis
          type: redis
          property: connectionString
      - key: ALLOWED_ORIGINS
        sync: false  # Set manually per environment
    preDeployCommand: npx prisma migrate deploy

databases:
  - name: ispani-db
    plan: starter
    databaseName: ispani
    user: ispani
    region: oregon

  # Optional — remove if you don't need Redis
  # - name: ispani-redis
  #   plan: free
  #   region: oregon
```

**To use**: Push `render.yaml` to your repo, then go to [Render Blueprints](https://dashboard.render.com/blueprints) → **New Blueprint Instance** → Select your repo.

---

## 10. Known Issues & Troubleshooting

### 🔴 `Missing required environment variables: DATABASE_URL, JWT_SECRET`

**Cause**: Environment variables not set in Render.
**Fix**: Go to your service → **Environment** tab and add `DATABASE_URL` and `JWT_SECRET`.

---

### 🔴 Prisma: `Can't reach database server at dpg-xxx.render.com:5432`

**Cause**: Using External URL instead of Internal, or database hasn't finished provisioning.
**Fix**:
1. Use the **Internal Database URL** (starts with `dpg-`)
2. Make sure web service and database are in the **same region**
3. Wait 2-3 minutes after creating the database before deploying

---

### 🔴 `P3005: The database schema is not empty` (Prisma migrate)

**Cause**: Running `prisma migrate dev` instead of `prisma migrate deploy` in production.
**Fix**: Always use `npx prisma migrate deploy` in production. Never use `migrate dev` — it's for local development only.

---


### 🔴 `402 Payment Required` when creating Web Service via API

**Cause**: Render requires a payment method on file even for free-tier web services.
**Fix**:
1. Go to [Render Billing](https://dashboard.render.com/billing)
2. Add a credit/debit card
3. You won't be charged for free-tier services — the card is just required to prevent abuse
4. After adding the card, retry creating the service

---

### 🟡 Build fails: `npm ERR! Could not resolve dependency`

**Cause**: `package-lock.json` out of sync with `package.json`.
**Fix**:
1. Locally: `rm -rf node_modules package-lock.json && npm install`
2. Commit the updated `package-lock.json`
3. Push to trigger a new deploy

---

### 🟡 `argon2` build fails on Render

**Cause**: `argon2` has native C++ bindings that require build tools.
**Fix**: The Dockerfile uses `node:20-alpine` which includes the build tools. If using Node.js runtime, Render's default build environment includes them. If it still fails:
- Switch to Docker deployment (Option A)
- Or add to Build Command: `apt-get update && apt-get install -y build-essential python3`

---

### 🟡 `FIREBASE_PRIVATE_KEY` not working

**Cause**: Newlines in the private key get mangled by Render's env var input.
**Fix**: When pasting the key in Render, make sure:
- The key is wrapped in double quotes
- Newlines are literal `\n` (not actual line breaks)
- Example: `"-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD...\n-----END PRIVATE KEY-----\n"`

The code handles this in `src/services/firebase.js`:
```js
privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
```

---

### 🟡 Free tier service spins down after 15 minutes

**Cause**: Render free tier services sleep after 15 minutes of inactivity.
**Fix**:
- First request after sleep takes ~30-60 seconds (cold start)
- For production: Upgrade to Starter plan ($7/mo) — always on
- The `/health` endpoint + Dockerfile `HEALTHCHECK` help Render know the service is ready

---

### 🟡 CORS errors from frontend

**Cause**: `ALLOWED_ORIGINS` not set or doesn't include your frontend URL.
**Fix**: Set `ALLOWED_ORIGINS` to your frontend URL(s), comma-separated:
```
ALLOWED_ORIGINS=https://ispani-app.vercel.app,https://ispani.co.za
```
Source: `src/config/index.js` defaults to `['http://localhost:3000']` if not set.

---

### 🟡 Rate limiting too aggressive

**Cause**: Default is 100 requests per minute per IP.
**Fix**: Adjust in Render env vars:
```
RATE_LIMIT_MAX=500
AUTH_RATE_LIMIT_MAX=20
```

---

### 🔵 Redis connection errors (non-fatal)

**Cause**: `REDIS_URL` not set or Redis instance not created.
**Impact**: Job locking won't work, but everything else functions normally. Redis is lazy-loaded in `src/services/redis.js` — it only connects when a job lock is requested.
**Fix**: Create a Redis instance (Step 2) or ignore if you don't need job locking.

---

## 11. Environment Variables Reference

Full reference derived from source code analysis:

| Variable | Required | Default | Source File |
|:---|:---|:---|:---|
| `DATABASE_URL` | ✅ Yes | — | `src/config/env.js` |
| `JWT_SECRET` | ✅ Yes | — | `src/config/env.js` (min 32 chars) |
| `PORT` | No | `3000` | `src/config/index.js` |
| `NODE_ENV` | No | `development` | `src/config/index.js` |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | `src/config/index.js` |
| `ACCESS_TOKEN_EXPIRES_IN` | No | `15m` | `src/config/index.js` |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | No | `7` | `src/config/index.js` |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | `src/config/index.js` |
| `RATE_LIMIT_MAX` | No | `100` | `src/config/index.js` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | `900000` | `src/config/index.js` |
| `AUTH_RATE_LIMIT_MAX` | No | `5` | `src/config/index.js` |
| `LOG_LEVEL` | No | `info` | `src/services/logger.js` |
| `REDIS_URL` | No | `redis://localhost:6379` | `src/services/redis.js` |
| `FIREBASE_PROJECT_ID` | No* | — | `src/services/firebase.js` |
| `FIREBASE_CLIENT_EMAIL` | No* | — | `src/services/firebase.js` |
| `FIREBASE_PRIVATE_KEY` | No* | — | `src/services/firebase.js` |
| `TWILIO_ACCOUNT_SID` | No* | — | `src/services/twilio.js` |
| `TWILIO_AUTH_TOKEN` | No* | — | `src/services/twilio.js` |
| `TWILIO_PHONE_NUMBER` | No* | — | `src/services/twilio.js` |

*Required if using push notifications (Firebase) or OTP SMS (Twilio).

---

## 12. Useful Render Commands

```bash
# Check health
curl https://ispani-core.onrender.com/health

# View Prisma migration status (from Render Shell)
npx prisma migrate status

# Reset database (⚠️ DESTRUCTIVE — development only)
npx prisma migrate reset

# Run seed
node prisma/seed.js

# Generate Prisma client (after schema changes)
npx prisma generate
```

---

## Quick Deploy Checklist

- [ ] Created PostgreSQL database on Render
- [ ] Copied Internal Database URL
- [ ] Created Web Service (Docker or Node.js runtime)
- [ ] Set `DATABASE_URL` environment variable
- [ ] Set `JWT_SECRET` (32+ chars)
- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOWED_ORIGINS` to frontend URL
- [ ] Ran `npx prisma migrate deploy`
- [ ] Verified `/health` returns `"status": "ok"`
- [ ] (Optional) Set Firebase env vars for push notifications
- [ ] (Optional) Set Twilio env vars for OTP SMS
- [ ] (Optional) Created Redis instance and set `REDIS_URL`
- [ ] (Optional) Added `render.yaml` blueprint to repo

---

*Generated from source code analysis of `Katlego-Bruce/ispani-core` @ main (v2.3.0)*
