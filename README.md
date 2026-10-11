# Kuizu Backend 🎮

Multiplayer quiz & gamified learning platform backend (Duolingo + Kahoot architecture), built with NestJS, MongoDB, Redis, and Socket.IO.

---

## 🚀 Features

- **Authentication & RBAC:** Access/refresh JWT tokens with HTTP-only cookies, atomic refresh session rotation, device tracking, and role-based access control (`user`, `teacher`, `admin`).
- **Gamification Engine:** Hearts, gems, streak freezes, activity tracking, and weekly tiered competitive leagues (Bronze → Diamond).
- **Curriculum & Courses:** Modular unit and lesson progression with atomic unlocked lesson verification and XP rewards.
- **Quiz Management:** Author-owned question banks, taggable questions, search, and sanitization of answer keys for learners.
- **Realtime Multiplayer Arena:** Socket.IO WebSocket gateway with distributed Redis pub/sub adapter, 6-digit PIN rooms, synchronized timers, and real-time live leaderboards.
- **Background Job Queues:** BullMQ worker queues for transactional emails, game report persistence, and automated league standings calculation.
- **Production Observability & Resilience:** Pino structured logging with correlation IDs, Redis throttler rate limiting, and Terminus health checks.

---

## 🛠️ Tech Stack

- **Framework:** NestJS 12
- **Database:** MongoDB 7 via Mongoose
- **Cache & Message Broker:** Redis 7 via ioredis & BullMQ
- **Realtime:** Socket.IO with `@socket.io/redis-adapter`
- **Validation:** Zod schemas & custom pipes
- **Testing & Tooling:** Vitest, oxlint, Prettier, TypeScript

---

## 📦 Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional, for local MongoDB & Redis)

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Review and adjust variables in `.env` as needed:

| Variable             | Description                                        | Default                           |
| -------------------- | -------------------------------------------------- | --------------------------------- |
| `PORT`               | API Server port                                    | `4000`                            |
| `NODE_ENV`           | Environment (`development` / `production`)         | `development`                     |
| `CLIENT_URL`         | Frontend client origin                             | `http://localhost:3001`           |
| `MONGODB_URI`        | MongoDB connection string                          | `mongodb://127.0.0.1:27017/kuizu` |
| `REDIS_URI`          | Redis connection string                            | `redis://127.0.0.1:6379`          |
| `JWT_ACCESS_SECRET`  | Secret key for access tokens (min 16 chars)        | -                                 |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens (min 16 chars)       | -                                 |
| `EXPOSE_DEV_TOKENS`  | Expose tokens in auth responses (disabled in prod) | `false`                           |
| `ENABLE_SWAGGER`     | Enable Swagger UI (`api/docs`)                     | `true`                            |

### 2. Run with Docker Compose

Start MongoDB, Redis, and Kuizu Backend:

```bash
docker compose up -d
```

### 3. Local Development

Install dependencies:

```bash
npm install
```

Start MongoDB and Redis (or run local instances), then start the app in development mode:

```bash
npm run start:dev
```

API available at `http://localhost:4000/api/v1`.  
Swagger documentation available at `http://localhost:4000/api/docs`.

---

## 🧪 Testing & Quality Assurance

```bash
# Typecheck
npm run typecheck

# Lint with oxlint
npm run lint

# Run all unit test suites
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📜 License

UNLICENSED
