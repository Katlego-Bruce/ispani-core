# 🏛️ ISPANI — System Architecture

> Technical architecture guide for the ISPANI digital labour marketplace backend.

---

## 🌐 System Overview

```
                          ┌─────────────────┐
                          │  Mobile App    │
                          │  (React Native)│
                          └────────┬────────┘
                                  │
                           HTTPS / JWT
                                  │
                          ┌────────┴────────┐
                          │   Express.js   │
                          │   API Server   │
                          │   (Node.js)    │
                          └──┬────┬────┬───┘
                            │    │    │
                 ┌────────┘    │    └────────┐
                 │              │              │
          ┌──────┴─────┐  ┌──┴────────┐  ┌──┴────────┐
          │ PostgreSQL  │  │   Redis     │  │  Firebase   │
          │ (Prisma)    │  │   (Locks)   │  │  (FCM)      │
          └────────────┘  └───────────┘  └───────────┘
                                                    │
                                             ┌──────┴─────┐
                                             │   Twilio     │
                                             │   (SMS OTP)  │
                                             └────────────┘
```

---

## 🧩 Module Architecture

Each domain module follows the **Controller → Service → Prisma** pattern:

```
Request → Middleware → Controller → Service → Prisma/External → Response
              │
     ┌────────┴─────────┐
     │  authenticate     │  →  JWT verification + user lookup
     │  validate (Zod)   │  →  Request body/query validation
     │  requestId        │  →  Unique ID per request
     │  rateLimit        │  →  Request throttling
     └──────────────────┘
```

### Module Breakdown

| Module | Purpose | Key Files |
|:---|:---|:---|
| **auth** | Registration, login, OTP | `auth.routes.js` `auth.service.js` `otp.service.js` |
| **jobs** | Job CRUD, applications, status | `jobs.routes.js` `jobs.service.js` `jobs.controller.js` |
| **users** | Profiles, location, online status | `users.routes.js` `users.service.js` |
| **matching** | Geo-proximity matching, broadcast | `matching.service.js` `matching.controller.js` |
| **reviews** | Ratings, reputation, user levels | `reviews.service.js` `reviews.routes.js` |
| **payments** | Escrow lifecycle | `payments.service.js` `payments.routes.js` |
| **admin** | User management, analytics | `admin.service.js` `admin.routes.js` |

---

## 📊 Data Model

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User         │       │       Job        │       │   Application   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id               │─────│ userId (FK)     │       │ jobId (FK)      │
│ firstName        │       │ assignedToId   │─────│ applicantId(FK) │
│ lastName         │       │ title          │       │ message         │
│ phone (unique)   │       │ description    │       │ status          │
│ email            │       │ budget         │       └─────────────────┘
│ password         │       │ location       │
│ skills[]         │       │ latitude       │       ┌─────────────────┐
│ latitude         │       │ longitude      │       │     Review      │
│ longitude        │       │ status         │       ├─────────────────┤
│ isOnline         │       │ category       │       │ reviewerId (FK) │
│ averageRating    │       └─────────────────┘       │ revieweeId (FK) │
│ userLevel        │                               │ jobId (FK)      │
│ completedJobs    │       ┌─────────────────┐       │ rating (1-5)    │
│ isAdmin          │       │    Payment      │       │ comment         │
│ isSuspended      │       ├─────────────────┤       └─────────────────┘
│ isBanned         │       │ jobId (FK)      │
│ fcmToken         │       │ clientId (FK)   │       ┌─────────────────┐
└─────────────────┘       │ workerId (FK)   │       │       Otp       │
                          │ amount          │       ├─────────────────┤
                          │ serviceFee      │       │ phone           │
                          │ workerPayout    │       │ code            │
                          │ status          │       │ attempts        │
                          └─────────────────┘       │ expiresAt       │
                                                    └─────────────────┘
```

---

## 🔀 Key Data Flows

### 1. Job Posting & Matching

```
User posts job → Job created (OPEN)
            │
            └─→ Owner broadcasts job
                     │
                     └─→ findNearbyUsers() queries GPS + online + not-stale
                              │
                              └─→ Filter by radius (Haversine distance)
                              └─→ Exclude job owner + existing applicants
                              └─→ Send FCM push notifications to matches
```

### 2. Application Accept (Race-Safe)

```
Worker applies → Application created (PENDING)
                         │
Owner accepts  ─────────┘
    │
    ├─→ Redis: acquireJobLock(jobId)     ── If locked → 409 "Already taken"
    │
    └─→ Prisma $transaction (atomic):
         ├─ Update application → ACCEPTED
         ├─ Update job → ASSIGNED + set assignedToId
         ├─ Reject all other PENDING applications
         └─ Release Redis lock
```

### 3. Escrow Payment Flow

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   PENDING   │──→│    HELD     │──→│  RELEASED   │   │  REFUNDED   │
│ (created)   │   │ (in escrow) │   │ (to worker) │   │ (to client) │
└─────────────┘   └──────┬──────┘   └─────────────┘   └─────────────┘
                            │                                 ▲
                            └───── DISPUTED ───────────────┘
                                 (under review)

Service Fee: 10% of budget
Worker Payout: budget - serviceFee
```

### 4. OTP Authentication

```
User enters phone → normalizePhone() → +27XXXXXXXXX
         │
         └─→ Rate limit check (max 3 per 10 min)
         └─→ Generate 6-digit code
         └─→ Store in Otp table (expires in 5 min)
         └─→ Send via Twilio SMS

User enters code → Verify against DB
         │
         ├─ Max 3 attempts per OTP
         ├─ Check expiry
         ├─ If valid: create/find user + issue JWT
         └─ Clean up used OTPs
```

---

## 🛡️ Security Architecture

| Layer | Mechanism |
|:---|:---|
| **Transport** | HTTPS enforced, CORS whitelist, Helmet headers |
| **Authentication** | JWT (Bearer token) with configurable expiry |
| **Password** | bcrypt with 12 salt rounds |
| **Rate Limiting** | express-rate-limit on all endpoints, stricter on auth |
| **Validation** | Zod schemas on every input |
| **SQL Injection** | Prisma parameterized queries (no raw SQL in business logic) |
| **Race Conditions** | Redis distributed locks + Prisma $transaction |
| **Admin** | `isAdmin` flag checked via middleware |
| **Soft Delete** | `deletedAt` field — records are never hard-deleted |

---

## 📈 Reputation System

```
                    ┌─────────────────────────────────────────┐
                    │  Level 5  │  50+ jobs, 95%+, 4.5+★  │
                    ├──────────┼──────────────────────────────┤
                    │  Level 4  │  30+ jobs, 90%+, 4.3+★  │
                    ├──────────┼──────────────────────────────┤
                    │  Level 3  │  15+ jobs, 85%+, 4.0+★  │
                    ├──────────┼──────────────────────────────┤
                    │  Level 2  │  5+ completed jobs         │
                    ├──────────┼──────────────────────────────┤
                    │  Level 1  │  New user (default)        │
                    └──────────┴──────────────────────────────┘

Reliability Score = (completedJobs / totalJobsAccepted) × 100
```

---

## 🚀 Scaling Considerations

| Component | Current | Scale Path |
|:---|:---|:---|
| **API Server** | Single instance | Horizontal scaling behind load balancer |
| **Database** | Single PostgreSQL | Read replicas + connection pooling (PgBouncer) |
| **Redis** | Single instance | Redis Cluster for high availability |
| **Geo-matching** | In-memory filter | PostGIS extension for database-level geo queries |
| **Notifications** | Direct FCM | Message queue (Bull/BullMQ) for async delivery |
| **File Storage** | N/A | S3/Cloudflare R2 for profile photos, job images |

---

## 🔧 Design Decisions

### Why No Fixed Roles?

Traditional marketplaces have rigid CLIENT/WORKER roles. ISPANI uses **behavior-based roles**:

- **Post a job** → you're the client for that job
- **Apply to a job** → you're the worker for that job
- **Same person** can post jobs AND apply to others

This reflects South Africa's gig economy reality — people both hire and get hired.

### Why Escrow?

Direct payments create trust issues. Escrow ensures:
- Workers know money is reserved before starting
- Clients know money is only released after completion
- Disputes have a resolution path

### Why Redis Locks + Prisma Transactions?

Two layers of protection:
1. **Redis lock** — instant response at application level ("already taken")
2. **Prisma transaction** — atomic database guarantee (no partial updates)

Together they handle both UI-level race conditions and DB-level consistency.

---

## 📝 Environment Requirements

| Service | Min Version | Purpose |
|:---|:---|:---|
| Node.js | 18.x | Runtime |
| PostgreSQL | 15.x | Primary database |
| Redis | 7.x | Job locking, caching |
| Twilio | — | SMS OTP delivery |
| Firebase | — | Push notifications |

---

<div align="center">

*Architecture designed for South Africa's digital labour marketplace.*

**🌿 ISPANI — Earn. Save. Grow Together.**

</div>
