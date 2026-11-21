# Horizon Airways — Airlines Reservation System

**Project code:** KT_HORIZON AERO SOLUTION_028
**Date:** 2026-11-21
**Status:** Design approved — ready for implementation planning

## 1. Purpose

A full-stack airlines reservation and operations system for "Horizon Airways" with two
major modules:

- **Passenger module** — search, book, pay for, cancel, and print e-tickets for flights.
- **Administration module** — staff attendance, duty reporting, flight & crew scheduling,
  aircraft management, employee records, and management reporting.

Both modules are implemented end-to-end at full depth. The system ships with two flagship
AI features (plus two lighter AI helpers) that run offline by default and upgrade to a real
LLM when an API key is present.

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript (Vite), Tailwind CSS, React Router, TanStack Query, Recharts, PDF export for e-tickets |
| Backend | Express + TypeScript, Prisma ORM, Zod validation, JWT auth |
| Database | PostgreSQL (Neon serverless for deploy; local Postgres for dev) |
| Deploy | Single Vercel project — Vite static frontend + Express wrapped as a serverless function under `/api` |
| AI | Hybrid: local heuristics/NLP by default; optional Anthropic LLM via `ANTHROPIC_API_KEY` |

### Architecture (Approach A)

Monorepo:

```
/apps/web      → Vite React frontend (static build, served by Vercel)
/apps/api      → Express app (TypeScript) exported as a Vercel serverless handler
/packages/db   → Prisma schema, client, migrations, seed
/api/index.ts  → Vercel entrypoint that wraps the Express app (serverless-http)
vercel.json    → routes /api/* to the function, everything else to the SPA
```

Local dev: `vite` dev server proxies `/api` to the Express server; Postgres via a local
instance or Docker. One `vercel` deploy ships both.

## 3. Authentication & Roles

- Roles: `PASSENGER`, `STAFF`, `ADMIN`.
- Registration: passengers self-register; staff accounts created by admin (or self-register
  then elevated by admin).
- JWT access token (httpOnly cookie + Authorization header support), password hashing with
  bcrypt. Zod-validated inputs. Role-gated routes on both client and server.

## 4. Passenger Module

1. **Flight search** — classic form (origin, destination, date, passengers) **and** natural-
   language search (AI feature #1). Results show flight, times, aircraft, fare, seats left,
   and a fare-trend badge (AI helper).
2. **Seat selection** — visual seat map per flight; seats locked on selection.
3. **Passenger details & preferences** — name, contact, meal/seat/assistance preferences,
   persisted to the passenger profile.
4. **Payment** — mock gateway. Credit-card validation: 16-digit length + Luhn check + expiry
   + CVV format. No real charge; a `Payment` record is created with card last-4 and status.
5. **Booking confirmation + e-ticket** — generates a printable PDF e-ticket (PNR, QR/barcode
   placeholder, flight + passenger details).
6. **My bookings** — list, view e-ticket, cancel. Cancellation sets booking status, releases
   the seat, records a refund status, and triggers smart-rebooking suggestions (AI helper).

## 5. Administration Module

1. **Staff attendance** — employees mark attendance (date, in/out, status).
2. **Duty reporting** — employee logs duty area + duty start/end times.
3. **Flight & crew scheduling** — create/edit flights (route, aircraft, departure/arrival,
   fare, capacity) and assign crew (employees) to flights.
4. **Aircraft management** — CRUD on aircraft (registration, model, capacity, status).
5. **Employee personal details** — CRUD on employee records incl. salary.
6. **Management module** — dashboard surfacing KPIs and the Reports module, plus the Demand
   & Crew Optimizer (AI feature #2).

## 6. Reports Module

Charts (Recharts) + exportable tables for: Flights Sent, Revenue, Reservations,
Cancellations, Aircraft, Salary, Employees, Attendance, and overall Airline Performance.
Reports are computed by aggregation queries over the operational tables with date-range
filters.

## 7. Data Model (Prisma / Postgres)

- **User** — id, email, passwordHash, role, createdAt.
- **Passenger** — userId, fullName, phone, preferences (JSON: meal/seat/assistance).
- **Employee** — userId?, empCode, fullName, designation, dutyArea, salary, contact.
- **Airport** — code (IATA), name, city, country.
- **Aircraft** — registration, model, capacity, status.
- **Flight** — flightNo, originId, destinationId, aircraftId, departAt, arriveAt, baseFare,
  capacity, seatsBooked, status.
- **Seat** — flightId, seatNo, class, status (AVAILABLE/HELD/BOOKED).
- **CrewAssignment** — flightId, employeeId, role.
- **Booking** — pnr, passengerId, flightId, seatId, farePaid, status (CONFIRMED/CANCELLED),
  createdAt, cancelledAt.
- **Ticket** — bookingId, issuedAt, pdf metadata.
- **Payment** — bookingId, cardLast4, amount, status, method.
- **Attendance** — employeeId, date, checkIn, checkOut, status.
- **DutyReport** — employeeId, dutyArea, startAt, endAt.

## 8. API Surface (Express, `/api`)

- `auth`: `POST /register`, `POST /login`, `GET /me`, `POST /logout`.
- `flights`: `GET /flights` (search + filters), `GET /flights/:id`, admin `POST/PUT/DELETE`.
- `search/nl`: `POST /search/nl` → parsed query + results (AI #1).
- `bookings`: `POST /bookings`, `GET /bookings/mine`, `GET /bookings/:id`,
  `POST /bookings/:id/cancel`, `GET /bookings/:id/ticket` (PDF).
- `payments`: `POST /payments/validate-card`, charging happens inside booking create.
- `aircraft`, `employees`, `attendance`, `duty-reports`, `crew`: CRUD (role-gated).
- `reports`: `GET /reports/:type?from&to`.
- `ai`: `POST /ai/rebooking-suggestions`, `GET /ai/fare-forecast/:flightId`,
  `GET /ai/optimizer` (demand + crew).

## 9. AI Features (Hybrid)

All AI endpoints share a provider abstraction: `localProvider` (default) and
`llmProvider` (used only when `ANTHROPIC_API_KEY` is set), behind one interface so the
frontend is identical either way.

1. **NL Flight Search (passenger, flagship):** parses free text ("cheap morning flight to
   Delhi next Friday") into `{origin?, destination, dateRange, timeOfDay?, sort}`. Local:
   date parsing (chrono-style) + city/IATA lexicon + keyword rules. LLM: structured
   extraction. Output feeds the normal flight-search query.
2. **Demand & Crew Optimizer (admin, flagship):** per upcoming flight, predicts load factor
   from seatsBooked, days-to-departure, route popularity, and a seasonality curve; flags
   over/under-crewed flights and recommends crew count & aircraft size. Local heuristic
   model; LLM adds a natural-language rationale.
3. **Fare-forecast badge (helper):** predicts fares rising/steady/falling and a book-now vs
   wait hint from occupancy and days-to-departure.
4. **Smart rebooking (helper):** on cancellation/delay, ranks alternative flights on the same
   route by time proximity, fare, and seats available.

## 10. Testing

- Backend unit/integration (Vitest + Supertest): auth, card validation (Luhn), booking
  create/cancel + seat release, report aggregations, and each AI parser/heuristic with fixed
  inputs → expected structured output.
- Seed script with realistic airports, aircraft, flights, employees, and a demo passenger so
  the app is fully explorable immediately after deploy.

## 11. Non-Goals

- Real payment processing (mock only).
- Real-time flight tracking / external GDS integration.
- Mobile native apps (responsive web only).

## 12. Success Criteria

- A passenger can register, search (classic + NL), book with seat selection and card
  validation, receive a printable e-ticket, and cancel with a rebooking suggestion.
- An admin can manage aircraft/employees/flights/crew, mark attendance & duty, view the
  optimizer, and generate every listed report.
- Deploys to Vercel as one project against a Neon Postgres database.
- Backend test suite passes.
