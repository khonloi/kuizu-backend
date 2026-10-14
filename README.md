# Kuizu Backend 🎮

> Enterprise-grade, distributed micro-architecture backend uniting Duolingo-style self-paced language mastery with Kahoot-style real-time multiplayer projector battles. Built on **NestJS 12**, **MongoDB 7**, **Redis 7**, **Socket.IO 4**, and **BullMQ 6**.

[![CI Status](https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square&logo=github-actions)](https://github.com/your-username/kuizu-backend/actions)
[![NestJS](https://img.shields.io/badge/NestJS-12.0-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black?style=flat-square&logo=socket.io)](https://socket.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-6.3-orange?style=flat-square)](https://bullmq.io/)
[![Vitest](https://img.shields.io/badge/Vitest-333%20Passed-green?style=flat-square&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-UNLICENSED-blue?style=flat-square)](<>)

---

## Table of Contents

- [Architectural Highlights](#architectural-highlights)
- [Tech Stack](#tech-stack)
- [Project Directory Structure](#project-directory-structure)
- [Prerequisites](#prerequisites)
- [Installation & Getting Started](#installation--getting-started)
- [Environment Configuration](#environment-configuration)
- [Available Scripts](#available-scripts)
- [Security & Authentication Engine](#security--authentication-engine)
  - [Dual-Token Rotation & Session Management](#dual-token-rotation--session-management)
  - [Role-Based Access Control (RBAC) Matrix](#role-based-access-control-rbac-matrix)
  - [Defense-in-Depth Pipeline](#defense-in-depth-pipeline)
- [Real-Time Multiplayer Arena Engine](#real-time-multiplayer-arena-engine)
  - [WebSocket Lifecycle & Event Catalog](#websocket-lifecycle--event-catalog)
  - [Scoring Formula & Speed Multipliers](#scoring-formula--speed-multipliers)
  - [Horizontal Scaling via Redis Adapter](#horizontal-scaling-via-redis-adapter)
- [Gamification & Curriculum Systems](#gamification--curriculum-systems)
  - [Sine-Wave Curriculum & Atomic Lesson Engine](#sine-wave-curriculum--atomic-lesson-engine)
  - [Streak Calculation & Freeze Recovery](#streak-calculation--freeze-recovery)
  - [Weekly League Division Progression](#weekly-league-division-progression)
- [Asynchronous Job Processing (BullMQ)](#asynchronous-job-processing-bullmq)
- [API Conventions & Querying](#api-conventions--querying)
  - [Standard & Paginated Envelopes](#standard--paginated-envelopes)
  - [Error Response Structure](#error-response-structure)
- [Complete API Reference](#complete-api-reference)
  - [1. Authentication (`/api/v1/auth`)](#1-authentication-apiv1auth)
  - [2. User Profile & Social (`/api/v1/users`)](#2-user-profile--social-apiv1users)
  - [3. Admin User Management (`/api/v1/admin/users`)](#3-admin-user-management-apiv1adminusers)
  - [4. Curriculum Courses (`/api/v1/courses`)](#4-curriculum-courses-apiv1courses)
  - [5. Quiz Bank & Questions (`/api/v1/quizzes`)](#5-quiz-bank--questions-apiv1quizzes)
  - [6. System Health & Probes (`/api/v1/health`)](#6-system-health--probes-apiv1health)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Docker & Production Deployment](#docker--production-deployment)
- [License](#license)

---

## Architectural Highlights

- **NestJS 12 Modular Architecture**: Structured domain modules (`auth`, `users`, `courses`, `quizzes`, `games`, `gamification`, `jobs`, `health`, `database`) ensuring loose coupling and maximum separation of concerns.
- **Repository Pattern with Lean & Transactional Support**:
  - Abstract [`BaseRepository<T>`](src/common/database/base.repository.ts) encapsulates Mongoose operations.
  - High-performance lean query methods (`findLean`, `findOneLean`, `findByIdLean`) bypass heavyweight Mongoose document hydration on read-heavy routes.
  - Multi-document ACID transactional unit-of-work support (`withTransaction`) for atomic streak updates, XP awards, and shop item deductions.
- **Dual-Token Authentication & Device Session Tracking**:
  - Stateless short-lived JWT Access Tokens (15 min) verified via HTTP-only cookies (`access_token`, `kuizu_session`) and `Authorization: Bearer` headers.
  - Stateful rotating Refresh Tokens (7 days) tied to device fingerprints (`sessionId`, `userAgent`, `ipAddress`) with atomic rotation and session eviction.
- **Distributed Real-Time WebSocket Gateway**:
  - Live multiplayer game lobby with synchronized timers, 6-digit cryptographic PINs, and answer distribution bar charts.
  - Socket.IO cluster scaling enabled via [`RedisIoAdapter`](src/common/adapters/redis-io.adapter.ts) and clean [`IGameStateStore`](src/modules/games/game-state.store.ts) interface contract.
- **Asynchronous Task Queue (BullMQ & Redis)**:
  - Offloaded background tasks for email verification delivery, game session persistence, and weekly league promotions.
  - Resilient fallback mechanism that safely handles disconnected or in-memory environments without process crashes.
- **Strict Runtime Contract Validation**:
  - Request payloads and environment variables validated at startup and request boundaries using **Zod** (`ZodValidationPipe`).
- **Production Observability & Telemetry**:
  - High-performance structured JSON logging with **Pino**, sensitive credential redaction, and distributed request tracing with correlation IDs (`CorrelationIdMiddleware`).
  - Kubernetes-native health checks with **Terminus** providing `/health/liveness` and `/health/readiness` probes.

---

## Tech Stack

| Domain                       | Technology / Library                                                                                                | Purpose                                                                 |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------- |
| **Framework**                | [NestJS 12](https://nestjs.com/)                                                                                    | Enterprise-grade TypeScript server framework                            |
| **Language & Runtime**       | [Node.js](https://nodejs.org/) (20+ / 22+) & [TypeScript 6](https://www.typescriptlang.org/)                        | Strict typing, ECMAScript 2022 target                                   |
| **Database**                 | [MongoDB 7](https://www.mongodb.com/) & [Mongoose 9](https://mongoosejs.com/)                                       | Document persistence, schemas, and compound index optimization          |
| **In-Memory Cache & Broker** | [Redis 7](https://redis.io/) & [ioredis](https://github.com/redis/ioredis)                                          | Distributed cache, rate limiter storage, and Pub/Sub broker             |
| **Realtime WebSockets**      | [Socket.IO 4](https://socket.io/) & [@socket.io/redis-adapter](https://github.com/socketio/socket.io-redis-adapter) | Low-latency duplex live classroom quiz rooms                            |
| **Queue & Worker Engine**    | [BullMQ 6](https://bullmq.io/) & [@nestjs/bullmq](https://github.com/nestjs/bullmq)                                 | Redis-backed asynchronous jobs and worker processors                    |
| **Schema & Validation**      | [Zod 4](https://zod.dev/)                                                                                           | Type inference, runtime validation pipes, and environment validation    |
| **Security & Auth**          | `passport-jwt`, `bcryptjs`, `helmet`, `cookie-parser`                                                               | Dual-token authentication, password hashing, and HTTP header protection |
| **Rate Limiting**            | [@nestjs/throttler 6](https://github.com/nestjs/throttler)                                                          | Distributed sliding-window request throttling backed by Redis           |
| **Structured Logging**       | [nestjs-pino 5](https://github.com/iamolegg/nestjs-pino) & [pino](https://getpino.io/)                              | High-speed structured logging with correlation IDs and redaction        |
| **API Documentation**        | [@nestjs/swagger 12](https://github.com/nestjs/swagger)                                                             | OpenAPI 3.0 documentation generated dynamically at `/api/docs`          |
| **Health Checks**            | [@nestjs/terminus 12](https://github.com/nestjs/terminus)                                                           | Liveness & Readiness Kubernetes probes                                  |
| **Testing**                  | [Vitest 4](https://vitest.dev/) & [Supertest 7](https://github.com/ladjs/supertest)                                 | Blazing-fast unit and end-to-end integration test runners               |
| **Linter & Formatting**      | [oxlint](https://oxc.rs/) & [Prettier 3](https://prettier.io/)                                                      | Rust-powered ultra-fast linting and code formatting                     |

---

## Project Directory Structure

```text
kuizu-backend/
├── .github/
│   └── workflows/ci.yml       # Automated GitHub Actions CI workflow (lint, typecheck, test, build)
├── dist/                      # Production compiled JavaScript build artifacts
├── src/
│   ├── common/                # Shared enterprise cross-cutting concerns
│   │   ├── adapters/          # Socket.IO Redis distributed adapter
│   │   ├── database/          # BaseRepository<T> with lean queries & ACID transactions
│   │   ├── decorators/        # @CurrentUser, @Public, @Roles parameter/method decorators
│   │   ├── dto/               # Universal pagination schemas (offset & cursor)
│   │   ├── filters/           # AllExceptionsFilter with production error masking
│   │   ├── guards/            # JwtAuthGuard, RolesGuard, ThrottlerGuard
│   │   ├── middleware/        # CorrelationIdMiddleware (X-Request-Id, X-Correlation-Id)
│   │   ├── pipes/             # ZodValidationPipe, ParseObjectIdPipe
│   │   ├── redis/             # RedisModule & RedisService with in-memory fallback
│   │   ├── throttler/         # RedisThrottlerStorageService
│   │   └── utils/             # Regex sanitizers, string helpers
│   ├── config/                # Environment schema validation with strict production guards
│   ├── database/              # SeedService with initial demo accounts, courses, and quizzes
│   ├── modules/               # Feature domain modules
│   │   ├── auth/              # Dual-token auth, session rotation, password reset, JWT strategy
│   │   ├── courses/           # Units, lessons, exercise progression, enriched curriculum
│   │   ├── games/             # Live Arena gateway, GameStateStore, scoring, room PINs
│   │   ├── gamification/      # Hearts economy, streak freezes, weekly Diamond leagues, XP
│   │   ├── health/            # Kubernetes liveness & readiness health indicators
│   │   ├── jobs/              # BullMQ queue producer and processors (email, reports, league)
│   │   ├── quizzes/           # Questions, choices, tags, author banks, public showcases
│   │   └── users/             # User profile, session revocation, admin role/status operations
│   ├── app.module.ts          # Root NestJS application module wiring
│   └── main.ts                # Application entrypoint, CORS, Swagger, shutdown hooks
├── test/                      # End-to-end (E2E) integration test suites
│   ├── app.e2e-spec.ts        # Root API bootstrap tests
│   ├── auth-users.e2e-spec.ts # Auth endpoints, session security, admin guards
│   ├── courses.e2e-spec.ts    # Course curriculum and lesson completion E2E
│   └── quizzes.e2e-spec.ts    # Quiz creation, question queries, and public filtering
├── Dockerfile                 # Multi-stage production container build (Alpine runtime)
├── docker-compose.yml         # Container orchestration (MongoDB 7, Redis 7, Backend)
├── vitest.config.ts           # Unit test configuration with native tsconfigPaths
└── vitest.config.e2e.ts       # E2E test configuration
```

---

## Prerequisites

Ensure your environment meets these specifications:

- **Node.js**: `>= 20.0.0` (`v22.x LTS` recommended)
- **Package Manager**: `npm` (`>= 10.x`) or `pnpm` (`>= 9.x`)
- **Database**: [MongoDB 7.x](https://www.mongodb.com/) (local service or MongoDB Atlas cluster)
- **Cache / Broker**: [Redis 7.x](https://redis.io/) (local service or managed Redis)
- **Docker**: Optional, for containerized local dependencies

---

## Installation & Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/kuizu-backend.git
cd kuizu-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

Review and adjust variables according to your local configuration.

### 4. Start Infrastructure via Docker (Recommended)

Spin up MongoDB and Redis in isolated containers:

```bash
docker compose up -d kuizu-mongo kuizu-redis
```

### 5. Launch Development Server

```bash
npm run start:dev
```

The server will launch with hot-reloading at:

- **REST API Base**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **Swagger Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **WebSocket Gateway**: `ws://localhost:4000`

---

## Environment Configuration

| Variable                 | Required |              Default              | Description                                                    | Example                                   |
| :----------------------- | :------: | :-------------------------------: | :------------------------------------------------------------- | :---------------------------------------- |
| `NODE_ENV`               |   Yes    |           `development`           | Runtime environment (`development`, `production`, `test`)      | `development`                             |
| `PORT`                   |    No    |              `4000`               | Port on which NestJS HTTP server listens                       | `4000`                                    |
| `CLIENT_URL`             |    No    |      `http://localhost:3001`      | Primary frontend web client URL                                | `http://localhost:3001`                   |
| `CORS_ALLOWED_ORIGINS`   |    No    |      `CLIENT_URL,3000,3001`       | Comma-separated list of allowed CORS origins                   | `http://localhost:3001,https://kuizu.app` |
| `MONGODB_URI`            |   Yes    | `mongodb://127.0.0.1:27017/kuizu` | MongoDB connection string (cannot be localhost in prod)        | `mongodb://127.0.0.1:27017/kuizu`         |
| `JWT_ACCESS_SECRET`      |   Yes    |                 -                 | Secret key used to sign Access Tokens (min 32 chars in prod)   | `kuizu_super_secret_access_key_2026_dev`  |
| `JWT_REFRESH_SECRET`     |   Yes    |                 -                 | Secret key used to sign Refresh Tokens (min 32 chars in prod)  | `kuizu_super_secret_refresh_key_2026_dev` |
| `JWT_ACCESS_EXPIRATION`  |    No    |               `15m`               | Lifetime duration for access tokens                            | `15m`                                     |
| `JWT_REFRESH_EXPIRATION` |    No    |               `7d`                | Lifetime duration for refresh tokens                           | `7d`                                      |
| `REDIS_URI`              |    No    |     `redis://127.0.0.1:6379`      | Redis connection URL for caching, queues, and pub/sub          | `redis://127.0.0.1:6379`                  |
| `EXPOSE_DEV_TOKENS`      |    No    |              `false`              | Expose raw tokens in registration/reset API (disabled in prod) | `false`                                   |
| `ENABLE_SWAGGER`         |    No    |              `true`               | Expose interactive OpenAPI Swagger UI at `/api/docs`           | `true`                                    |

---

## Available Scripts

| Script         | Command              | Purpose                                                                     |
| :------------- | :------------------- | :-------------------------------------------------------------------------- |
| **start:dev**  | `npm run start:dev`  | Launches NestJS in watch mode with incremental compilation.                 |
| **build**      | `npm run build`      | Compiles TypeScript source to production bundle in `dist/`.                 |
| **start:prod** | `npm run start:prod` | Runs compiled production server from `dist/main.js`.                        |
| **typecheck**  | `npm run typecheck`  | Validates TypeScript types across the entire project (`tsc --noEmit`).      |
| **lint**       | `npm run lint`       | High-speed type-aware code quality verification via `oxlint`.               |
| **format**     | `npm run format`     | Enforces code formatting style across all files via `prettier`.             |
| **test**       | `npm test`           | Executes 300+ unit test suites using Vitest.                                |
| **test:watch** | `npm run test:watch` | Runs unit tests in interactive watch mode.                                  |
| **test:cov**   | `npm run test:cov`   | Collects unit test coverage report via V8.                                  |
| **test:e2e**   | `npm run test:e2e`   | Runs comprehensive HTTP integration test suites against NestJS application. |

---

## Security & Authentication Engine

### Dual-Token Rotation & Session Management

Kuizu implements the OAuth 2.0 / RFC 6749 recommended token rotation pattern:

```
┌──────────┐                                                     ┌───────────────┐
│  Client  │ ─── (1) POST /api/v1/auth/login ──────────────────> │  NestJS Auth  │
│ (Browser)│ <── (2) Set-Cookie: access_token (15m), refresh (7d)│ (Stores Hash) │
│          │                                                     └───────────────┘
│          │ ─── (3) Request with Access Cookie or Bearer ─────> ┌───────────────┐
│          │ <── (4) Authorized JSON Response ───────────────────│ Protected API │
│          │                                                     └───────────────┘
│          │ ─── (5) POST /api/v1/auth/refresh ────────────────> ┌───────────────┐
│          │         [Validates & Rotates Session]               │ Session Store │
│          │ <── (6) Issues New Access + Rotated Refresh Pair ───│ (MongoDB/User)│
└──────────┘                                                     └───────────────┘
```

- **Cryptographic Hashing**: User passwords hashed using `bcryptjs` with 12 salt rounds.
- **Session Tracking**: Active devices stored in `user.sessions` subdocuments. Calling `logout` invalidates the specific device session, while `DELETE /api/v1/auth/sessions?all=true` allows users to revoke all active sessions immediately.
- **Session Capping**: Automatically limits active sessions to 10 devices per user using FIFO eviction.

### Role-Based Access Control (RBAC) Matrix

| Endpoint Group                      | Description                                      | Public | User | Teacher | Admin |
| :---------------------------------- | :----------------------------------------------- | :----: | :--: | :-----: | :---: |
| `/api/v1/auth/*`                    | Registration, login, password reset              |   ✅   |  ✅  |   ✅    |  ✅   |
| `/api/v1/courses` (GET)             | Browse published curriculum courses              |   ✅   |  ✅  |   ✅    |  ✅   |
| `/api/v1/courses/:slug/curriculum`  | Enriched course units with learner progress      |   ❌   |  ✅  |   ✅    |  ✅   |
| `/api/v1/courses` (POST/PUT/DELETE) | Course creation and content authoring            |   ❌   |  ❌  |   ✅    |  ✅   |
| `/api/v1/quizzes` (GET)             | Search and list public community quizzes         |   ✅   |  ✅  |   ✅    |  ✅   |
| `/api/v1/quizzes` (POST/PUT)        | Create & edit quizzes                            |   ❌   |  ✅  |   ✅    |  ✅   |
| `/api/v1/quizzes/admin/all`         | Inspect all quizzes including unlisted           |   ❌   |  ❌  |   ❌    |  ✅   |
| `/api/v1/admin/users/*`             | Manage roles, deactivate users, inspect accounts |   ❌   |  ❌  |   ❌    |  ✅   |

### Defense-in-Depth Pipeline

1. **Helmet HTTP Headers**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict HSTS.
2. **Distributed Throttler**: Protects against brute-force attacks via Redis sliding-window limiters (e.g., maximum 5 login attempts per minute per IP).
3. **Zod Validation Pipe**: Rejects unexpected or malformed body payloads with instant HTTP 400 Bad Request responses.
4. **Production Error Masking**: Intercepts unhandled 500 errors to prevent leaking internal database schemas or stack traces to clients.

---

## Real-Time Multiplayer Arena Engine

### WebSocket Lifecycle & Event Catalog

The live multiplayer quiz arena communicates through the `@WebSocketGateway()` at port `4000`:

```mermaid
sequenceDiagram
    autonumber
    actor Host as Teacher / Host (Projector)
    participant GW as GamesGateway
    actor P1 as Player 1 (Mobile)
    actor P2 as Player 2 (Mobile)

    Host->>GW: emit('host:create', { quizId })
    GW-->>Host: ack({ success: true, pin: "582914" })

    P1->>GW: emit('player:join', { pin: "582914", nickname: "Kenji ⚡" })
    GW-->>P1: ack({ success: true })
    GW-->>Host: emit('player:joined', { nickname: "Kenji ⚡", playerCount: 1 })

    P2->>GW: emit('player:join', { pin: "582914", nickname: "Sakura 🌸" })
    GW-->>Host: emit('player:joined', { nickname: "Sakura 🌸", playerCount: 2 })

    Host->>GW: emit('host:start')
    GW-->>Host: broadcast('question:start', questionPayload)
    GW-->>P1: broadcast('question:start', questionPayload)
    GW-->>P2: broadcast('question:start', questionPayload)

    P1->>GW: emit('player:answer', { pin: "582914", choiceId: "c-1" })
    GW-->>Host: emit('question:answer_count', { answeredCount: 1, totalPlayers: 2 })

    Host->>GW: emit('host:reveal')
    GW-->>Host: broadcast('question:reveal', { correctChoiceId, answersDistribution })
    GW-->>P1: broadcast('question:reveal', { correctChoiceId, answersDistribution })

    Host->>GW: emit('host:next')
    GW-->>Host: broadcast('game:ended', { podium, fullLeaderboard })
    GW-->>P1: broadcast('game:ended', { podium, fullLeaderboard })
```

### Scoring Formula & Speed Multipliers

Answers are scored dynamically using the **Kahoot competitive speed equation**:

$$\text{Points} = \left\lfloor \text{BasePoints} \times 0.5 \right\rfloor + \left\lfloor \text{BasePoints} \times 0.5 \times \frac{\text{TimeRemaining}}{\text{TimeLimit}} \right\rfloor + \min(\text{Streak} \times 50, 250)$$

- **Accuracy**: Incorrect answers award `0` points and reset the streak counter to `0`.
- **Speed Bonus**: Players who answer in the first second receive up to 99% of the speed bonus.
- **Streak Bonus**: Continuous correct answers stack up to +250 bonus points per question.

### Horizontal Scaling via Redis Adapter

When `REDIS_URI` is configured, `RedisIoAdapter` attaches Redis Pub/Sub channels to Socket.IO. Multiple server pods behind an AWS ALB or Nginx reverse proxy seamlessly broadcast room events across containers.

---

## Gamification & Curriculum Systems

### Sine-Wave Curriculum & Atomic Lesson Engine

- **Path Progression**: Courses consist of sequenced **Units** and **Lessons**.
- **Atomic Verification**: Completing a lesson validates prerequisites in MongoDB and awards 20 XP.
- **Progress Synchronization**: Endpoint `/api/v1/courses/:slug/curriculum` merges static course maps with dynamic user completion states.

### Streak Calculation & Freeze Recovery

- **Activity Recording**: Invoking `/api/v1/users/me/streak` calculates calendar day differences.
- **Freeze Consumption**: If a learner misses a day and holds a `streakFreeze > 0`, the freeze is automatically consumed, maintaining the streak count.

### Weekly League Division Progression

- **Tier Hierarchy**: `Bronze` → `Silver` → `Gold` → `Sapphire` → `Ruby` → `Diamond`.
- **Automated Partitioning**: The BullMQ `gamification-queue` evaluates user XP: top 20% of active players are promoted, while bottom 10% are demoted.

---

## Asynchronous Job Processing (BullMQ)

| Queue Name               | Job Name                     | Payload                                | Processing Action                                                                                    |
| :----------------------- | :--------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **`email-queue`**        | `send-verification-email`    | `{ to, username, token }`              | Dispatches email verification message via transactional email provider.                              |
| **`email-queue`**        | `send-password-reset-email`  | `{ to, username, token }`              | Sends secure password reset link to user.                                                            |
| **`game-reports-queue`** | `save-game-session`          | `{ pin, quizId, players, hostUserId }` | Persists completed arena match records to `GameSession` collection and increments quiz play counter. |
| **`gamification-queue`** | `calculate-league-standings` | `{ timestamp }`                        | Calculates weekly XP rankings and applies tier promotions/demotions.                                 |

---

## API Conventions & Querying

### Standard & Paginated Envelopes

Endpoints support both direct resource arrays and structured pagination envelopes:

#### 1. Unpaginated List Response (Default)

`GET /api/v1/courses`

```json
[
  {
    "_id": "60d0fe4f5311236168a109ca",
    "title": "Japanese Foundations",
    "slug": "japanese-foundations",
    "isPublished": true
  }
]
```

#### 2. Paginated Collection Envelope

`GET /api/v1/courses?page=1&limit=20`

```json
{
  "data": [ ... ],
  "meta": {
    "total": 48,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextCursor": null
  },
  "total": 48,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### Error Response Structure

All HTTP errors follow the RFC 7807 compliant envelope with correlation tracking:

```json
{
  "statusCode": 400,
  "timestamp": "2026-10-14T20:30:00.000Z",
  "path": "/api/v1/auth/register",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Username must be at least 3 characters",
  "errors": [ ... ]
}
```

---

## Complete API Reference

Interactive OpenAPI documentation is hosted at `http://localhost:4000/api/docs`.

### 1. Authentication (`/api/v1/auth`)

| Method   | Endpoint                           |    Access     | Description                                                           |
| :------- | :--------------------------------- | :-----------: | :-------------------------------------------------------------------- |
| `POST`   | `/api/v1/auth/register`            |    Public     | Register new user account. Returns user profile and sets JWT cookies. |
| `POST`   | `/api/v1/auth/login`               |    Public     | Authenticate with email/username and password.                        |
| `POST`   | `/api/v1/auth/refresh`             |    Public     | Rotate refresh token and receive fresh access token.                  |
| `POST`   | `/api/v1/auth/logout`              | Authenticated | Revoke current device session and clear cookies.                      |
| `GET`    | `/api/v1/auth/sessions`            | Authenticated | List all active device sessions for current user.                     |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | Authenticated | Evict specific device session by ID.                                  |
| `DELETE` | `/api/v1/auth/sessions?all=true`   | Authenticated | Revoke all active sessions across all devices.                        |
| `POST`   | `/api/v1/auth/change-password`     | Authenticated | Change password for authenticated user.                               |
| `POST`   | `/api/v1/auth/verify-email`        |    Public     | Confirm account email using verification token.                       |
| `POST`   | `/api/v1/auth/resend-verification` |    Public     | Request a new email verification token.                               |
| `POST`   | `/api/v1/auth/forgot-password`     |    Public     | Request password reset token via registered email.                    |
| `POST`   | `/api/v1/auth/reset-password`      |    Public     | Set new password using reset token.                                   |

### 2. User Profile & Social (`/api/v1/users`)

| Method  | Endpoint                          |    Access     | Description                                               |
| :------ | :-------------------------------- | :-----------: | :-------------------------------------------------------- |
| `GET`   | `/api/v1/users/me`                | Authenticated | Retrieve current user profile and game stats.             |
| `PATCH` | `/api/v1/users/me`                | Authenticated | Update user username or avatar URL.                       |
| `POST`  | `/api/v1/users/me/streak`         | Authenticated | Record daily activity and calculate day streak.           |
| `POST`  | `/api/v1/users/me/hearts/refill`  | Authenticated | Purchase full 5-heart refill for 50 gems.                 |
| `POST`  | `/api/v1/users/me/hearts/consume` | Authenticated | Consume 1 quest heart upon answering incorrectly.         |
| `POST`  | `/api/v1/users/me/streak-freeze`  | Authenticated | Purchase a streak freeze shield for 100 gems.             |
| `GET`   | `/api/v1/users/leaderboard`       |    Public     | Fetch top players ranked by total experience points (XP). |

### 3. Admin User Management (`/api/v1/admin/users`)

| Method   | Endpoint                         | Access | Description                                                |
| :------- | :------------------------------- | :----: | :--------------------------------------------------------- |
| `GET`    | `/api/v1/admin/users`            | Admin  | Search and inspect users with pagination and role filters. |
| `GET`    | `/api/v1/admin/users/:id`        | Admin  | Get full user profile and session metadata.                |
| `PATCH`  | `/api/v1/admin/users/:id/role`   | Admin  | Change user role (`user`, `teacher`, `admin`).             |
| `PATCH`  | `/api/v1/admin/users/:id/status` | Admin  | Suspend or activate user account.                          |
| `DELETE` | `/api/v1/admin/users/:id`        | Admin  | Permanently delete user account and evict sessions.        |

### 4. Curriculum Courses (`/api/v1/courses`)

| Method   | Endpoint                                     |    Access     | Description                                                |
| :------- | :------------------------------------------- | :-----------: | :--------------------------------------------------------- |
| `GET`    | `/api/v1/courses`                            |    Public     | Browse all published curriculum courses.                   |
| `GET`    | `/api/v1/courses/:slug`                      |    Public     | Retrieve course metadata and unit breakdown.               |
| `GET`    | `/api/v1/courses/:slug/curriculum`           | Authenticated | Retrieve course units enriched with user unlocked states.  |
| `GET`    | `/api/v1/courses/:slug/lessons/:id`          |    Public     | Retrieve interactive exercises for a specific lesson.      |
| `POST`   | `/api/v1/courses/:slug/lessons/:id/complete` | Authenticated | Submit lesson completion, verify quest, and award XP.      |
| `POST`   | `/api/v1/courses`                            | Teacher/Admin | Author and publish a new course curriculum.                |
| `PUT`    | `/api/v1/courses/:id`                        | Teacher/Admin | Update units, lessons, or metadata for an existing course. |
| `DELETE` | `/api/v1/courses/:id`                        | Teacher/Admin | Delete a course curriculum.                                |

### 5. Quiz Bank & Questions (`/api/v1/quizzes`)

| Method   | Endpoint                             |    Access     | Description                                                 |
| :------- | :----------------------------------- | :-----------: | :---------------------------------------------------------- |
| `GET`    | `/api/v1/quizzes`                    |    Public     | List and search public community quizzes.                   |
| `GET`    | `/api/v1/quizzes/my`                 | Authenticated | List all quizzes created by current authenticated user.     |
| `GET`    | `/api/v1/quizzes/:id`                |    Public     | Retrieve quiz details (answer keys sanitized for learners). |
| `POST`   | `/api/v1/quizzes`                    | Authenticated | Create a new community or classroom quiz.                   |
| `PUT`    | `/api/v1/quizzes/:id`                | Authenticated | Update owned quiz title, tags, or description.              |
| `DELETE` | `/api/v1/quizzes/:id`                | Authenticated | Delete owned quiz.                                          |
| `POST`   | `/api/v1/quizzes/:id/questions`      | Authenticated | Add a question to an owned quiz bank.                       |
| `DELETE` | `/api/v1/quizzes/:id/questions/:qId` | Authenticated | Remove a question from a quiz bank.                         |

### 6. System Health & Probes (`/api/v1/health`)

| Method | Endpoint                   | Access | Description                                                          |
| :----- | :------------------------- | :----: | :------------------------------------------------------------------- |
| `GET`  | `/api/v1/health`           | Public | General service health, uptime, and database connection state.       |
| `GET`  | `/api/v1/health/liveness`  | Public | Kubernetes liveness probe (validates process responsiveness).        |
| `GET`  | `/api/v1/health/readiness` | Public | Kubernetes readiness probe (validates MongoDB & Redis connectivity). |

---

## Testing & Quality Assurance

Kuizu Backend maintains **100% test pass rates** across both unit and end-to-end integration test suites:

```bash
# Execute unit test suites (303 tests passing)
npm test

# Execute HTTP End-to-End integration test suites (30 tests passing)
npm run test:e2e

# Run type-checking
npm run typecheck

# Run ultra-fast type-aware linting
npm run lint
```

---

## Docker & Production Deployment

### Production Multi-Stage Container Build

The application includes an optimized multi-stage `Dockerfile`:

```bash
# Build production Docker image
docker build -t kuizu-backend:latest .

# Run containerized application
docker run -p 4000:4000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://user:pass@mongo-host:27017/kuizu \
  -e REDIS_URI=redis://redis-host:6379 \
  -e JWT_ACCESS_SECRET=your_32_character_production_access_key \
  -e JWT_REFRESH_SECRET=your_32_character_production_refresh_key \
  kuizu-backend:latest
```

---

## License

UNLICENSED © Kuizu Platform. Proprietary and confidential.
