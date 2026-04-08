<div align="center">

# 🌿 ISPANI

### Earn. Save. Grow Together.

**South Africa's Digital Labour Marketplace**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis&logoColor=white)](https://redis.io)

---

</div>

## 📱 App Preview

<div align="center">
<table>
<tr>
<td align="center"><strong>Login</strong></td>
<td align="center"><strong>Home</strong></td>
<td align="center"><strong>Find Work</strong></td>
<td align="center"><strong>Alerts</strong></td>
<td align="center"><strong>Profile</strong></td>
</tr>
<tr>
<td><img src="https://codewords-uploads.s3.amazonaws.com/runtime_v2/66a13361a8364199ab83631848011279dc70ef4ec1a841918536e1c1bb96d310/Screenshot_20260407_095046_com.android.chrome.jpg" width="160"/></td>
<td><img src="https://codewords-uploads.s3.amazonaws.com/runtime_v2/3a698597c4a0479296eac1ef07f6a17aa940b706ab254383ba045d4c7b4664a8/Screenshot_20260407_095126_com.android.chrome.jpg" width="160"/></td>
<td><img src="https://codewords-uploads.s3.amazonaws.com/runtime_v2/45317ed30e4a4e3797c478a2bef2c6627c56a5d53c2e4239994a1a0f8c997185/Screenshot_20260407_095150_com.android.chrome.jpg" width="160"/></td>
<td><img src="https://codewords-uploads.s3.amazonaws.com/runtime_v2/5468e8f77e3c4b9b87cdb83aa9bc0735dcbb9e39db8f49d68c7a2aae0c9d83a8/Screenshot_20260407_095159_com.android.chrome.jpg" width="160"/></td>
<td><img src="https://codewords-uploads.s3.amazonaws.com/runtime_v2/105d7979752440df88f45b4a47a06988a6f8eb5f6dce4529adbd137cfd680be4/Screenshot_20260407_095204_com.android.chrome.jpg" width="160"/></td>
</tr>
</table>
</div>

---

## 🎯 What is ISPANI?

ISPANI is a **digital labour marketplace** built for South Africa's informal economy. It connects people who need work done with people who can do it — no fixed roles, no barriers.

**Anyone can post a job. Anyone can earn.** Your role is determined by what you do, not who you are.

### Core Value Proposition

| For Job Posters | For Workers |
|:---|:---|
| 📋 Post jobs in seconds | 🔍 Find nearby work instantly |
| 👥 Get matched with nearby workers | 💰 Get paid through secure escrow |
| ⭐ Rate workers & build trust | 📈 Build your reputation & level up |
| 🔒 Escrow protects your money | 🔔 Real-time push notifications |

---

## ✨ Features

### 🔐 Authentication
- **Password-based** registration & login with JWT
- **OTP via SMS** (Twilio) — no passwords needed
- Rate-limited endpoints for brute-force protection

### 💼 Job Marketplace
- Create, list, filter, and search jobs
- Geo-location matching — find work within X km
- Application system with atomic accept/reject
- Job lifecycle: `OPEN` → `ASSIGNED` → `IN_PROGRESS` → `COMPLETED`

### 🔒 Escrow Payments
- Money held in escrow when job is accepted
- Released to worker on completion
- Refund & dispute mechanisms
- 10% platform service fee

### ⭐ Trust & Reputation
- 1–5 star ratings after job completion
- Reliability score (completed ÷ accepted × 100)
- Worker levels 1–5 based on performance

### 🔔 Push Notifications (FCM)
- Real-time job alerts via Firebase Cloud Messaging
- Application & payment status updates

### 🔒 Job Locking (Redis)
- Distributed locks prevent double-booking
- Auto-expiring TTL prevents deadlocks

### 🛡️ Admin Dashboard
- User management (suspend / ban / restore)
- Platform analytics & stats

---

## 🏗️ Tech Stack

| Layer | Technology |
|:---|:---|
| **Runtime** | Node.js 18+ |
| **Framework** | Express 4.x |
| **Database** | PostgreSQL 15+ |
| **ORM** | Prisma 5.x |
| **Cache / Locks** | Redis 7+ (ioredis) |
| **Auth** | JWT + bcrypt + Twilio OTP |
| **Notifications** | Firebase Cloud Messaging |
| **Validation** | Zod |
| **Logging** | Pino |
| **Testing** | Jest + Supertest |

---

## 📂 Project Structure

```
ispani-core/
├── prisma/
│   ├── schema.prisma          # DB schema (User, Job, Application, Otp, Review, Payment)
│   └── seed.js
├── src/
│   ├── app.js                 # Express app, middleware, routes
│   ├── server.js              # HTTP entry point
│   ├── config/                # Environment config
│   ├── middleware/            # auth, errorHandler, validate, requestId
│   ├── modules/
│   │   ├── auth/              # Registration, login, OTP
│   │   ├── jobs/              # Job CRUD, applications, status
│   │   ├── users/             # Profile, location, online status
│   │   ├── matching/          # Geo-matching, broadcast
│   │   ├── reviews/           # Ratings, reputation, levels
│   │   ├── payments/          # Escrow create/release/refund/dispute
│   │   └── admin/             # User management, platform stats
│   ├── services/              # prisma, jwt, logger, geo, twilio, firebase, redis
│   └── utils/                 # AppError, asyncHandler
├── tests/                     # Jest + Supertest E2E tests
├── Dockerfile
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ &nbsp;•&nbsp; **PostgreSQL** 15+ &nbsp;•&nbsp; **Redis** 7+

### Installation

```bash
git clone https://github.com/Katlego-Bruce/ispani-core.git
cd ispani-core
npm install
cp .env.example .env    # Edit with your credentials
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Environment Variables

| Variable | Description |
|:---|:---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing tokens |
| `REDIS_URL` | Redis connection string |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sender number (+27...) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase service account key |
| `FIREBASE_CLIENT_EMAIL` | Firebase client email |

---

## 📡 API Overview

Base URL: `/api/v1`

| Module | Endpoints | Description |
|:---|:---|:---|
| **Auth** | `POST /auth/register` `POST /auth/login` `GET /auth/me` | Password auth |
| **OTP** | `POST /auth/send-otp` `POST /auth/verify-otp` | SMS authentication |
| **Jobs** | `POST /jobs` `GET /jobs` `GET /jobs/:id` | Job CRUD |
| **Status** | `PATCH /jobs/:id/start` `/complete` `/cancel` | Job lifecycle |
| **Apply** | `POST /jobs/:id/apply` `GET /jobs/:id/applications` | Applications |
| **Matching** | `POST /jobs/:id/broadcast` `GET /matching/nearby` | Geo-matching |
| **Users** | `GET /users` `PATCH /users/me` `PATCH /users/location` | Profiles |
| **Reviews** | `POST /reviews` `GET /reviews/user/:id/stats` | Reputation |
| **Payments** | `POST /payments/create` `/release` `/refund` `/dispute` | Escrow |
| **Admin** | `GET /admin/users` `GET /admin/stats` | Management |

---

## 🧪 Testing

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

---

## 🏛️ Architecture

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for system architecture, data flows, and design decisions.

---

<div align="center">

**Built for South Africa 🇿🇦**

*Connecting communities. Creating opportunity.*

</div>
