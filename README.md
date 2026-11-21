# Horizon Airways ✈️

A full-stack airlines reservation & operations system — passenger booking + airline administration — with four AI features. React + Express + Prisma/PostgreSQL monorepo.

## Quick start (local)

Prerequisites: **Node 20+**, **Docker** (for local Postgres).

```bash
# 1. Install deps
npm install

# 2. Start a local Postgres (if not already running)
docker run -d --name horizon-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=horizon -p 5432:5432 postgres:16-alpine

# 3. Configure env
cp .env.example .env     # the provided .env already points DATABASE_URL at local Docker

# 4. Create schema + demo data
npm run db:generate
npm run db:migrate       # or: npm run db:seed  (reset handled by migrate reset)

# 5. Run API (:4000) + web (:5173)
npm run dev
```

Open **http://localhost:5173**.

> Prefer separate terminals? `npm run dev:api` and `npm run dev:web`.
> If the API's file-watcher is flaky on your machine, run it directly: `cd apps/api && npx tsx src/server.ts`.

## Demo logins

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@horizon.air` | `Passw0rd!` |
| Passenger | `demo@horizon.air` | `Passw0rd!` |

Or register a new passenger from the UI.

## Features

**Passenger** — flight search (classic + natural-language), visual seat map (First/Business/Economy), booking with payment, printable/downloadable boarding-pass e-ticket (stored in S3), my-bookings, cancel + AI rebooking suggestions.

**Admin** — aircraft & employee CRUD, flight & crew scheduling, attendance, duty reporting, AI demand/crew optimizer, and a reports dashboard (revenue, flights, reservations, cancellations, aircraft, salary, employees, attendance, performance) with charts + CSV export.

**AI (hybrid: offline heuristics by default, upgrades to an LLM when `LLM_API_KEY` is set)**
1. **Natural-language flight search** — "cheap morning flight to Delhi next Friday" → structured query.
2. **Demand & crew optimizer** — predicted load factor + crew/aircraft recommendations.
3. **Fare forecast** — rising/steady/falling + book-now/wait advice.
4. **Smart rebooking** — ranked alternatives on cancellation.

## Payments

Payments use **Razorpay (test mode)** when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set, otherwise an offline **mock gateway** (16-digit Luhn validation). The local `.env` ships with Razorpay commented out, so booking works fully offline out of the box. Mock test cards: `4539148803436467` succeeds; a number ending `0002` is declined.

## Stack

React + TypeScript (Vite, Tailwind, TanStack Query, Recharts) · Express + TypeScript · Prisma + PostgreSQL · S3-compatible object storage · Vitest + Supertest (100 tests).

## Tests

```bash
npm test     # backend suite (requires the local Docker Postgres running)
```

## Config (`.env`)

`DATABASE_URL` (active DB), `NEON_DATABASE_URL` (cloud DB, optional), `JWT_SECRET`, `AWS_*` + `S3_BUCKET` (e-ticket storage), `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL` (AI), `RAZORPAY_*` (payments), `CLIENT_URL`.
