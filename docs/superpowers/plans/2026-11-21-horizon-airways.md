# Horizon Airways — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack airlines reservation + operations system (passenger + admin modules) with four AI features, deployable as one Vercel project on Neon Postgres.

**Architecture:** Monorepo with a Vite+React+TS frontend (`apps/web`), an Express+TS API (`apps/api`) exported as a Vercel serverless function, and a shared Prisma data layer (`packages/db`). Local dev runs Vite with a proxy to Express; production routes `/api/*` to the serverless function and everything else to the SPA.

**Tech Stack:** React, TypeScript, Vite, Tailwind, React Router, TanStack Query, Recharts, Express, Prisma, PostgreSQL (Neon), Zod, JWT, bcrypt, Vitest, Supertest, serverless-http.

## Global Constraints

- TypeScript everywhere (frontend + backend). `strict: true`.
- Node 20+. ESM modules.
- Roles are exactly: `PASSENGER`, `STAFF`, `ADMIN`.
- Payments are **mock only** — validate 16-digit card (Luhn) and store last-4; never charge.
- AI runs via a provider interface: `localProvider` (default, offline) and `llmProvider` (used only when `LLM_API_KEY` is set). The LLM provider calls an **OpenAI-compatible** chat-completions endpoint via `fetch` — `LLM_BASE_URL` (e.g. `https://integrate.api.nvidia.com/v1`) + `LLM_MODEL` (e.g. `moonshotai/kimi-k3.1-pro`) + Bearer `LLM_API_KEY`. No vendor SDK. Frontend never branches on which provider is used.
- Object storage is S3-compatible (Neon Object Storage). The API uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` with `forcePathStyle: true`, reading `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `S3_BUCKET` (default `assets`). Used to store generated e-ticket PDFs; clients fetch them via short-lived presigned URLs.
- Database: **Neon Postgres** for the app and production (`DATABASE_URL` in `.env`). The automated test suite uses a **local Docker Postgres** via `.env.test` so tests never touch live demo data. Vitest loads `.env.test`.
- Credit card: 16 digits + Luhn + expiry in future + 3-digit CVV.
- All API inputs validated with Zod; all mutating routes role-gated.
- Commit after every passing step. Conventional commit messages.
- Prisma is the single source of truth for the schema; no raw SQL except report aggregations where needed.

---

## Phase 0 — Monorepo Scaffold & Tooling

### Task 0.1: Workspace + tooling skeleton

**Files:**
- Create: `package.json` (root, npm workspaces), `tsconfig.base.json`, `.nvmrc`, `vercel.json`, `.env.example`, `README.md`
- Create: `apps/web/`, `apps/api/`, `packages/db/` package.json stubs

**Interfaces:**
- Produces: npm workspaces `@horizon/web`, `@horizon/api`, `@horizon/db`; root scripts `dev`, `build`, `test`, `db:*`.

- [ ] **Step 1:** Create root `package.json` with workspaces and scripts:

```json
{
  "name": "horizon-airways",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": "npm -w @horizon/api run dev",
    "dev:web": "npm -w @horizon/web run dev",
    "build": "npm -w @horizon/db run generate && npm -w @horizon/web run build",
    "test": "npm -w @horizon/api run test",
    "db:generate": "npm -w @horizon/db run generate",
    "db:migrate": "npm -w @horizon/db run migrate",
    "db:seed": "npm -w @horizon/db run seed"
  },
  "devDependencies": { "concurrently": "^9.0.0", "typescript": "^5.6.0" }
}
```

- [ ] **Step 2:** Create `tsconfig.base.json` with `strict`, `ESNext` modules, `moduleResolution: bundler`, `esModuleInterop`.
- [ ] **Step 3:** Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "apps/web/dist",
  "functions": { "api/index.ts": { "runtime": "@vercel/node@5" } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.ts" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4:** Create `.env.example` with `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY=` (blank), `CLIENT_URL`.
- [ ] **Step 5:** Commit: `chore: scaffold monorepo workspace and tooling`

---

## Phase 1 — Data Layer (`packages/db`)

### Task 1.1: Prisma schema + client

**Files:**
- Create: `packages/db/package.json`, `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts`

**Interfaces:**
- Produces: exported `prisma` client singleton; all models from §7 of the spec.

- [ ] **Step 1:** `packages/db/package.json` with `@prisma/client`, dev `prisma`, scripts `generate`/`migrate`/`seed` (seed via `tsx prisma/seed.ts`).
- [ ] **Step 2:** Write `schema.prisma` — datasource `postgresql` from `env("DATABASE_URL")`, generator client. Models & enums:

```prisma
enum Role { PASSENGER STAFF ADMIN }
enum SeatStatus { AVAILABLE HELD BOOKED }
enum BookingStatus { CONFIRMED CANCELLED }
enum FlightStatus { SCHEDULED DEPARTED ARRIVED CANCELLED }

model User {
  id String @id @default(cuid())
  email String @unique
  passwordHash String
  role Role @default(PASSENGER)
  createdAt DateTime @default(now())
  passenger Passenger?
  employee Employee?
}
model Passenger {
  id String @id @default(cuid())
  userId String @unique
  user User @relation(fields: [userId], references: [id])
  fullName String
  phone String?
  preferences Json?
  bookings Booking[]
}
model Employee {
  id String @id @default(cuid())
  userId String? @unique
  user User? @relation(fields: [userId], references: [id])
  empCode String @unique
  fullName String
  designation String
  dutyArea String?
  salary Decimal @default(0)
  contact String?
  attendance Attendance[]
  dutyReports DutyReport[]
  crew CrewAssignment[]
}
model Airport {
  id String @id @default(cuid())
  code String @unique
  name String
  city String
  country String
  departures Flight[] @relation("origin")
  arrivals Flight[] @relation("destination")
}
model Aircraft {
  id String @id @default(cuid())
  registration String @unique
  model String
  capacity Int
  status String @default("ACTIVE")
  flights Flight[]
}
model Flight {
  id String @id @default(cuid())
  flightNo String
  originId String
  origin Airport @relation("origin", fields: [originId], references: [id])
  destinationId String
  destination Airport @relation("destination", fields: [destinationId], references: [id])
  aircraftId String
  aircraft Aircraft @relation(fields: [aircraftId], references: [id])
  departAt DateTime
  arriveAt DateTime
  baseFare Decimal
  capacity Int
  seatsBooked Int @default(0)
  status FlightStatus @default(SCHEDULED)
  seats Seat[]
  bookings Booking[]
  crew CrewAssignment[]
}
model Seat {
  id String @id @default(cuid())
  flightId String
  flight Flight @relation(fields: [flightId], references: [id])
  seatNo String
  cabinClass String @default("ECONOMY")
  status SeatStatus @default(AVAILABLE)
  booking Booking?
  @@unique([flightId, seatNo])
}
model CrewAssignment {
  id String @id @default(cuid())
  flightId String
  flight Flight @relation(fields: [flightId], references: [id])
  employeeId String
  employee Employee @relation(fields: [employeeId], references: [id])
  role String
  @@unique([flightId, employeeId])
}
model Booking {
  id String @id @default(cuid())
  pnr String @unique
  passengerId String
  passenger Passenger @relation(fields: [passengerId], references: [id])
  flightId String
  flight Flight @relation(fields: [flightId], references: [id])
  seatId String @unique
  seat Seat @relation(fields: [seatId], references: [id])
  farePaid Decimal
  status BookingStatus @default(CONFIRMED)
  createdAt DateTime @default(now())
  cancelledAt DateTime?
  payment Payment?
  ticket Ticket?
}
model Payment {
  id String @id @default(cuid())
  bookingId String @unique
  booking Booking @relation(fields: [bookingId], references: [id])
  cardLast4 String
  amount Decimal
  status String @default("PAID")
  method String @default("CARD")
  createdAt DateTime @default(now())
}
model Ticket {
  id String @id @default(cuid())
  bookingId String @unique
  booking Booking @relation(fields: [bookingId], references: [id])
  issuedAt DateTime @default(now())
}
model Attendance {
  id String @id @default(cuid())
  employeeId String
  employee Employee @relation(fields: [employeeId], references: [id])
  date DateTime
  checkIn DateTime?
  checkOut DateTime?
  status String @default("PRESENT")
  @@unique([employeeId, date])
}
model DutyReport {
  id String @id @default(cuid())
  employeeId String
  employee Employee @relation(fields: [employeeId], references: [id])
  dutyArea String
  startAt DateTime
  endAt DateTime?
}
```

- [ ] **Step 3:** `packages/db/src/index.ts` exports a singleton `prisma` (guard against hot-reload duplicates).
- [ ] **Step 4:** Run `npm run db:generate`. Expected: Prisma client generated, no errors.
- [ ] **Step 5:** Commit: `feat(db): add prisma schema and client`

### Task 1.2: Seed script

**Files:**
- Create: `packages/db/prisma/seed.ts`

**Interfaces:**
- Consumes: `prisma` client, models from 1.1.
- Produces: demo data — airports (DEL, BOM, BLR, HYD, MAA, CCU), 6 aircraft, ~20 flights over next 14 days with generated seats, ~12 employees, 1 admin (`admin@horizon.air`), 1 demo passenger (`demo@horizon.air`), both password `Passw0rd!`.

- [ ] **Step 1:** Write seed creating users with bcrypt-hashed passwords, airports, aircraft, flights (loop routes × dates), and per-flight seats (rows A–F). Idempotent via `upsert` on unique keys.
- [ ] **Step 2:** Run `npm run db:migrate -- --name init` then `npm run db:seed`. Expected: "Seed complete" with row counts.
- [ ] **Step 3:** Commit: `feat(db): add seed data`

---

## Phase 2 — API Foundation (`apps/api`)

### Task 2.1: Express app + Vercel handler + test harness

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `api/index.ts` (repo root), `apps/api/vitest.config.ts`, `apps/api/src/__tests__/health.test.ts`

**Interfaces:**
- Produces: `createApp(): Express` (no `listen`), used by both `server.ts` (local) and `api/index.ts` (serverless via `serverless-http`). `GET /api/health → { ok: true }`.

- [ ] **Step 1 (test):** `health.test.ts`:

```ts
import request from "supertest";
import { createApp } from "../app";
it("health returns ok", async () => {
  const res = await request(createApp()).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});
```

- [ ] **Step 2:** Run `npm -w @horizon/api run test`. Expected: FAIL (createApp missing).
- [ ] **Step 3:** Implement `app.ts`: express, `express.json()`, cors (from `CLIENT_URL`), cookie-parser, mount routers under `/api`, `GET /api/health`, central error middleware mapping thrown `HttpError`→status and ZodError→400.
- [ ] **Step 4:** `server.ts` calls `createApp().listen(process.env.PORT ?? 4000)`. `api/index.ts` exports `serverless(createApp())`.
- [ ] **Step 5:** Run test. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(api): express app, serverless handler, health check`

### Task 2.2: Shared utilities (errors, auth middleware, async wrapper)

**Files:**
- Create: `apps/api/src/lib/http-error.ts`, `apps/api/src/lib/auth.ts`, `apps/api/src/lib/validate.ts`, `apps/api/src/__tests__/auth-mw.test.ts`

**Interfaces:**
- Produces: `HttpError(status, message)`; `signToken(payload)`, `verifyToken(t)`; `requireAuth` and `requireRole(...roles)` Express middlewares reading Bearer header or `token` cookie, setting `req.user = { id, role }`; `validate(schema)` middleware.

- [ ] **Step 1 (test):** assert `requireRole('ADMIN')` returns 401 without token and 403 with a `PASSENGER` token; `requireAuth` sets `req.user` with a valid token.
- [ ] **Step 2:** Run test → FAIL.
- [ ] **Step 3:** Implement with `jsonwebtoken` (`JWT_SECRET`, 7d expiry) and the Zod validate middleware.
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit: `feat(api): auth middleware, errors, validation helpers`

### Task 2.3: Auth routes

**Files:**
- Create: `apps/api/src/routes/auth.ts`, `apps/api/src/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `signToken`, `validate`.
- Produces: `POST /api/auth/register` (passenger: email, password, fullName, phone? → creates User+Passenger, returns token+user), `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.

- [ ] **Step 1 (test):** register→200 with token; duplicate email→409; login wrong password→401; `/me` with token→user.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with bcrypt hashing; set httpOnly cookie + return token in body. Zod schemas inline.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(api): auth register/login/me/logout`

---

## Phase 3 — Core Domain API

### Task 3.1: Card validation + flight search

**Files:**
- Create: `apps/api/src/lib/card.ts`, `apps/api/src/routes/flights.ts`, `apps/api/src/routes/payments.ts`, tests `card.test.ts`, `flights.test.ts`

**Interfaces:**
- Produces: `validateCard({number, expiry, cvv}): {valid, last4, reason?}` (16 digits, Luhn, future expiry MM/YY, 3-digit CVV). `GET /api/flights?origin&destination&date&pax` returns flights with computed `seatsLeft`. `GET /api/flights/:id` includes seat map. `POST /api/payments/validate-card`.

- [ ] **Step 1 (test):** `card.test.ts` — `4539148803436467` valid; `1234...` invalid Luhn; 15-digit invalid length; past expiry invalid. `flights.test.ts` — search by route+date returns seeded flight; unknown route returns `[]`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement Luhn in `card.ts`; flight search query with date-range (whole day) + origin/destination code joins; seat map in `/:id`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(api): card validation and flight search`

### Task 3.2: Booking create (seat hold + payment + ticket) & PNR

**Files:**
- Create: `apps/api/src/lib/pnr.ts`, `apps/api/src/routes/bookings.ts`, test `bookings.test.ts`

**Interfaces:**
- Consumes: `validateCard`, `prisma`, `requireAuth`.
- Produces: `POST /api/bookings` (flightId, seatNo, passenger details+preferences, card) → transaction: validate card, lock seat (`status AVAILABLE→BOOKED`, fail 409 if taken), create Booking (`pnr` from `genPnr()`), Payment (last4), Ticket, increment `flight.seatsBooked`, persist passenger preferences. Returns booking with flight+seat+payment. `genPnr(): string` 6-char A–Z0–9.

- [ ] **Step 1 (test):** booking a free seat → 200, seat becomes BOOKED, payment last4 set; booking same seat again → 409; invalid card → 400.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement inside `prisma.$transaction`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(api): booking creation with seat lock, payment, ticket`

### Task 3.3: My bookings, cancel + seat release, e-ticket data

**Files:**
- Modify: `apps/api/src/routes/bookings.ts`
- Test: `bookings-cancel.test.ts`

**Interfaces:**
- Produces: `GET /api/bookings/mine`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel` (status→CANCELLED, seat→AVAILABLE, decrement seatsBooked, set refund status on payment, `cancelledAt`), `GET /api/bookings/:id/ticket` (JSON e-ticket payload; PDF rendered client-side).

- [ ] **Step 1 (test):** cancel confirmed booking → seat AVAILABLE again + status CANCELLED; cancel other user's booking → 403.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement in transaction. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(api): booking listing, cancellation, e-ticket payload`

### Task 3.4: S3-backed e-ticket PDF storage

**Files:**
- Create: `apps/api/src/lib/storage.ts`, `apps/api/src/lib/ticket-pdf.ts`, test `storage.test.ts`
- Modify: `packages/db/prisma/schema.prisma` (add `pdfKey String?` to `Ticket`), add migration
- Modify: `apps/api/src/routes/bookings.ts`

**Interfaces:**
- Produces:
  - `storage.ts`: `s3` client (`new S3Client({ forcePathStyle: true })` — SDK reads `AWS_ENDPOINT_URL_S3`/`AWS_REGION`/keys from env), `BUCKET = process.env.S3_BUCKET ?? "assets"`, `ensureBucket()`, `putObject(key, body, contentType)`, `presignGet(key, expiresIn=3600): Promise<string>`. Deps: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
  - `ticket-pdf.ts`: `renderTicketPdf(ticketData): Buffer` using `pdfkit` (PNR, flight, passenger, seat, fare).
  - On booking create (Task 3.2), after the booking txn: render the PDF, upload to `tickets/{pnr}.pdf`, store the object key in `Ticket.pdfKey`. `GET /api/bookings/:id/ticket` returns `{ ticket: {...}, pdfUrl }` where `pdfUrl` is a presigned GET URL (regenerated per request).

**Note:** S3 is configured against Neon Object Storage; credentials are in `.env`. The bucket `assets` already exists. If `AWS_ENDPOINT_URL_S3` is unset in a test env, `storage.ts` must no-op gracefully (skip upload, return `null` pdfUrl) so booking tests don't require network.

- [ ] **Step 1 (test):** `storage.test.ts` — with S3 env unset, `putObject`/`presignGet` are skipped and callers get `null` (no throw); key builder produces `tickets/{pnr}.pdf`. (Live S3 round-trip is validated manually, not in CI.)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add `pdfKey` to Ticket + `prisma migrate dev --name ticket_pdf_key` (run against local test DB; controller applies to Neon separately). Implement storage + pdf + wire into booking create and ticket route. Install `pdfkit`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` in `apps/api`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(api): e-ticket PDF generation and S3 storage`

---

## Phase 4 — Admin Domain API

### Task 4.1: Aircraft & Employees CRUD

**Files:**
- Create: `apps/api/src/routes/aircraft.ts`, `apps/api/src/routes/employees.ts`, test `admin-crud.test.ts`
- Create: `apps/api/src/lib/crud.ts` (generic `makeCrudRouter(model, schema, roles)` factory to keep CRUD DRY)

**Interfaces:**
- Produces: `/api/aircraft` and `/api/employees` with `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, all `requireRole('ADMIN','STAFF')` for writes. Aircraft fields: registration, model, capacity, status. Employee fields: empCode, fullName, designation, dutyArea, salary, contact.

- [ ] **Step 1 (test):** STAFF token creates aircraft → 200; PASSENGER token create → 403; list returns created item.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `makeCrudRouter` using `prisma[model]` with a Zod schema per resource; mount both.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(api): aircraft and employee CRUD`

### Task 4.2: Flight & crew scheduling (admin writes)

**Files:**
- Modify: `apps/api/src/routes/flights.ts`
- Create: `apps/api/src/routes/crew.ts`
- Test: `scheduling.test.ts`

**Interfaces:**
- Produces: admin `POST/PUT/DELETE /api/flights` (on create: generate seats A–F per row to match capacity). `POST /api/crew` {flightId, employeeId, role}, `GET /api/crew?flightId`, `DELETE /api/crew/:id`.

- [ ] **Step 1 (test):** admin creates flight → seats generated = capacity; assign crew → appears in crew list; duplicate crew assignment → 409.
- [ ] **Step 2:** FAIL. **Step 3:** Implement seat generation helper + crew router. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(api): flight scheduling and crew assignment`

### Task 4.3: Attendance & Duty reporting

**Files:**
- Create: `apps/api/src/routes/attendance.ts`, `apps/api/src/routes/duty.ts`, test `attendance-duty.test.ts`

**Interfaces:**
- Produces: `POST /api/attendance/mark` {employeeId, type: 'IN'|'OUT'} (upsert today's row, set checkIn/checkOut), `GET /api/attendance?employeeId&from&to`. `POST /api/duty` {employeeId, dutyArea, startAt}, `POST /api/duty/:id/end`, `GET /api/duty?employeeId`.

- [ ] **Step 1 (test):** mark IN then OUT same day → single row with both times; duty start then end sets endAt.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(api): attendance marking and duty reporting`

### Task 4.4: Reports

**Files:**
- Create: `apps/api/src/routes/reports.ts`, `apps/api/src/lib/reports.ts`, test `reports.test.ts`

**Interfaces:**
- Produces: `GET /api/reports/:type?from&to` for types: `revenue`, `flights`, `reservations`, `cancellations`, `aircraft`, `salary`, `employees`, `attendance`, `performance`. Each returns `{ summary, series }` where `series` is array of `{label, value}` for charts.

- [ ] **Step 1 (test):** after seed + one booking, `revenue` summary total > 0 and series non-empty; `cancellations` counts cancelled bookings.
- [ ] **Step 2:** FAIL. **Step 3:** Implement aggregation functions (Prisma groupBy/aggregate; raw SQL only if needed). **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(api): management reports`

---

## Phase 5 — AI Layer

### Task 5.1: AI provider interface + local NL search parser (Feature #1)

**Files:**
- Create: `apps/api/src/ai/provider.ts`, `apps/api/src/ai/local.ts`, `apps/api/src/ai/llm.ts`, `apps/api/src/ai/airports.ts`, `apps/api/src/routes/ai-search.ts`, test `nl-search.test.ts`

**Interfaces:**
- Produces: `AiProvider` interface `{ parseSearch(text): Promise<ParsedSearch> }` where `ParsedSearch = { origin?: string; destination?: string; dateFrom?: string; dateTo?: string; timeOfDay?: 'MORNING'|'AFTERNOON'|'EVENING'|'NIGHT'; sort?: 'CHEAPEST'|'FASTEST'|'EARLIEST' }`. `getProvider()` returns `llmProvider` if `ANTHROPIC_API_KEY` else `localProvider`. `POST /api/ai/search` {text} → `{ parsed, flights }`.

- [ ] **Step 1 (test):** local parse of "cheap morning flight to Delhi next Friday" → destination `DEL`, timeOfDay `MORNING`, sort `CHEAPEST`, dateFrom within next 7 days.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement `airports.ts` city→IATA lexicon; local parser (regex for cities/relative dates like today/tomorrow/next <weekday>, keyword→timeOfDay/sort); `llm.ts` calls the OpenAI-compatible endpoint (`POST {LLM_BASE_URL}/chat/completions`, model `LLM_MODEL`, Bearer `LLM_API_KEY`, `temperature:0`, a system prompt instructing JSON-only output matching `ParsedSearch`) via `fetch` and parses the JSON from the response — behind the same `AiProvider` interface; route applies `parsed` to flight search + sort.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(ai): provider interface and NL flight search`

### Task 5.2: Demand & Crew Optimizer (Feature #2)

**Files:**
- Create: `apps/api/src/ai/optimizer.ts`, `apps/api/src/routes/ai-optimizer.ts`, test `optimizer.test.ts`

**Interfaces:**
- Produces: `optimizeFlights(flights, crewCounts): OptimizerResult[]` where each = `{ flightId, flightNo, predictedLoadFactor, recommendedCrew, recommendedAircraftSize, flag: 'OVER'|'UNDER'|'OK', rationale }`. `GET /api/ai/optimizer` (admin) returns upcoming flights analyzed.

- [ ] **Step 1 (test):** a near-full flight close to departure → high predictedLoadFactor and `recommendedCrew` ≥ baseline; empty far-out flight → low load factor.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement heuristic: `loadFactor = clamp(seatsBooked/capacity * seasonality(daysOut))`; crew baseline by capacity tier; flag vs assigned crew; optional LLM rationale.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(ai): demand and crew optimizer`

### Task 5.3: Fare forecast + smart rebooking (helpers)

**Files:**
- Create: `apps/api/src/ai/fare.ts`, `apps/api/src/ai/rebooking.ts`, routes `ai-fare.ts`, `ai-rebooking.ts`, tests `fare.test.ts`, `rebooking.test.ts`

**Interfaces:**
- Produces: `forecastFare(flight): { trend: 'RISING'|'STEADY'|'FALLING'; advice: 'BOOK_NOW'|'WAIT'; confidence }`. `GET /api/ai/fare-forecast/:flightId`. `suggestRebooking(cancelledFlightId): Flight[]` ranked by time proximity, fare, seats. `POST /api/ai/rebooking` {flightId}.

- [ ] **Step 1 (test):** high occupancy + near departure → `RISING`/`BOOK_NOW`; rebooking returns same-route alternatives sorted, excludes the cancelled flight.
- [ ] **Step 2:** FAIL. **Step 3:** Implement heuristics. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(ai): fare forecast and smart rebooking`

---

## Phase 6 — Frontend (`apps/web`)

### Task 6.1: Vite app shell, Tailwind, router, API client, auth store

**Files:**
- Create: `apps/web/package.json`, `vite.config.ts` (proxy `/api`→localhost:4000), `index.html`, `src/main.tsx`, `src/App.tsx`, `tailwind.config.ts`, `src/index.css`, `src/lib/api.ts` (fetch wrapper), `src/lib/auth.tsx` (context + token storage), `src/router.tsx`, `src/components/ProtectedRoute.tsx`

**Interfaces:**
- Produces: TanStack Query client; `useAuth()` with `user`, `login`, `register`, `logout`; `api.get/post/put/del` attaching Bearer token; route tree with public (`/`, `/login`, `/register`, `/search`), passenger, and admin areas gated by `ProtectedRoute role=`.

- [ ] **Step 1:** Scaffold Vite React-TS; install deps (react-router-dom, @tanstack/react-query, tailwindcss, recharts, lucide-react, clsx).
- [ ] **Step 2:** Implement api client, auth context (persist token in localStorage, hydrate `/me`), router + ProtectedRoute.
- [ ] **Step 3:** Run `npm -w @horizon/web run build`. Expected: build succeeds.
- [ ] **Step 4:** Commit: `feat(web): app shell, routing, auth, api client`

> **Design note:** Before building visual pages (6.2+), invoke the `frontend-design` skill to establish the aviation-themed design system (color, type, spacing, component style). Apply it consistently across all pages.

### Task 6.2: Landing, auth pages, NL + classic search

**Files:**
- Create: `src/pages/Landing.tsx`, `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/Search.tsx`, `src/components/FlightCard.tsx`, `src/components/SearchBar.tsx` (classic + NL toggle), `src/components/FareBadge.tsx`

- [ ] **Step 1:** Build landing (hero + NL search box), login/register forms wired to `useAuth`.
- [ ] **Step 2:** Search page: classic filters + NL box calling `/api/ai/search`; results as FlightCards with FareBadge (calls fare-forecast).
- [ ] **Step 3:** Manual check via `npm run dev`; build passes.
- [ ] **Step 4:** Commit: `feat(web): landing, auth, and flight search`

### Task 6.3: Booking flow (seat map → details → payment → confirmation → PDF e-ticket)

**Files:**
- Create: `src/pages/Booking.tsx`, `src/components/SeatMap.tsx`, `src/components/PassengerForm.tsx`, `src/components/PaymentForm.tsx`, `src/pages/Confirmation.tsx`, `src/components/ETicket.tsx`, `src/lib/ticket-pdf.ts`

**Interfaces:**
- Consumes: `/api/flights/:id`, `/api/payments/validate-card`, `/api/bookings`, `/api/bookings/:id/ticket`.
- Produces: multi-step booking; client-side card validation mirroring server; e-ticket printable via `window.print()` with print CSS and PDF download (html-to-image/jsPDF or react-to-print).

- [ ] **Step 1:** Seat map (grid from flight seats, disabled if booked), passenger+preferences form, payment form with live card/Luhn feedback.
- [ ] **Step 2:** On submit → create booking → navigate to confirmation → render ETicket with print/download.
- [ ] **Step 3:** Manual check + build passes.
- [ ] **Step 4:** Commit: `feat(web): booking flow with seat map, payment, e-ticket`

### Task 6.4: My bookings + cancellation + rebooking suggestions

**Files:**
- Create: `src/pages/MyBookings.tsx`, `src/components/RebookingSuggestions.tsx`

- [ ] **Step 1:** List bookings, view e-ticket, cancel (confirm dialog) → on cancel show rebooking suggestions from `/api/ai/rebooking`.
- [ ] **Step 2:** Build passes. **Step 3:** Commit: `feat(web): my bookings, cancellation, rebooking`

### Task 6.5: Admin shell + aircraft/employees/flights/crew management

**Files:**
- Create: `src/pages/admin/AdminLayout.tsx`, `AircraftAdmin.tsx`, `EmployeesAdmin.tsx`, `FlightsAdmin.tsx`, `CrewAdmin.tsx`, `src/components/DataTable.tsx`, `src/components/CrudModal.tsx`

- [ ] **Step 1:** Admin sidebar layout (gated to STAFF/ADMIN); reusable DataTable + CrudModal.
- [ ] **Step 2:** Wire aircraft/employees/flights/crew CRUD to their endpoints.
- [ ] **Step 3:** Build passes. **Step 4:** Commit: `feat(web): admin management screens`

### Task 6.6: Attendance, duty, optimizer, reports dashboard

**Files:**
- Create: `src/pages/admin/Attendance.tsx`, `Duty.tsx`, `Optimizer.tsx`, `Reports.tsx`, `src/components/ReportChart.tsx`

- [ ] **Step 1:** Attendance mark-in/out + history; duty start/end; optimizer table with flags & rationale from `/api/ai/optimizer`.
- [ ] **Step 2:** Reports page: type selector + date range → Recharts chart + table + CSV export.
- [ ] **Step 3:** Build passes. **Step 4:** Commit: `feat(web): attendance, duty, optimizer, reports`

---

## Phase 7 — Integration, Deploy, Docs

### Task 7.1: End-to-end smoke + README + deploy config

**Files:**
- Modify: `README.md`; Create: `docs/DEPLOY.md`

- [ ] **Step 1:** Write README: local setup (`.env`, `db:migrate`, `db:seed`, `npm run dev`), demo credentials, feature tour.
- [ ] **Step 2:** DEPLOY.md: create Neon DB, set Vercel env vars (`DATABASE_URL`, `JWT_SECRET`, optional `ANTHROPIC_API_KEY`), `vercel --prod`; run `db:migrate`+`db:seed` against Neon.
- [ ] **Step 3:** Run full backend test suite `npm test`. Expected: all green.
- [ ] **Step 4:** Manual E2E in `npm run dev`: register → NL search → book → e-ticket → cancel → rebooking; admin → schedule flight → optimizer → reports.
- [ ] **Step 5:** Commit: `docs: readme and deploy guide`

---

## Self-Review

**Spec coverage:** Login/Registration (2.3, 6.2) ✓ · Book/cancel (3.2, 3.3, 6.3, 6.4) ✓ · See flights per destination/day (3.1, 6.2) ✓ · Card payment + 16-digit validation (3.1, 3.2) ✓ · E-ticket generate+print (3.3, 6.3) ✓ · Preferences (3.2, 6.3) ✓ · Reports: flights/revenue/reservation/cancellation/aircraft/salary/employees/attendance/performance (4.4, 6.6) ✓ · Attendance (4.3, 6.6) ✓ · Duty reporting (4.3, 6.6) ✓ · Flight & crew scheduling (4.2, 6.5) ✓ · Aircraft module (4.1, 6.5) ✓ · Mgmt module/performance (4.4, 5.2, 6.6) ✓ · AI #1 NL search (5.1) ✓ · AI #2 optimizer (5.2) ✓ · AI helpers fare+rebooking (5.3) ✓ · Vercel+Neon deploy (0.1, 7.1) ✓.

**Placeholder scan:** CRUD/attendance/report tasks reference the concrete pattern + exact fields from earlier tasks rather than restating code; this is intentional reuse (`makeCrudRouter`, `DataTable`), not a placeholder.

**Type consistency:** `ParsedSearch`, `OptimizerResult`, `validateCard` return shape, and role strings are defined once and reused by name downstream.
