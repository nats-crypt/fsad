# Horizon Airways — Complete Code Walkthrough

> Reviewer-level explanation of every file, API, and data flow in the codebase.

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Entry Points: server.ts & app.ts](#2-entry-points-serverts--appts)
3. [Database Schema (Prisma)](#3-database-schema-prisma)
4. [Backend Libraries](#4-backend-libraries)
5. [Authentication Routes (`/api/auth/*`)](#5-authentication-routes-apiauth)
6. [Flight Routes (`/api/flights/*`)](#6-flight-routes-apiflights)
7. [Payment Routes (`/api/payments/*`)](#7-payment-routes-apipayments)
8. [Booking Routes (`/api/bookings/*`)](#8-booking-routes-apibookings)
9. [Admin CRUD Routes](#9-admin-crud-routes)
10. [AI Feature Routes](#10-ai-feature-routes)
11. [Notification & Cron Scheduler](#11-notification--cron-scheduler)
12. [WebSocket Flight Tracking](#12-websocket-flight-tracking)
13. [Frontend: Core Libraries](#13-frontend-core-libraries)
14. [Frontend: Routing & Auth Context](#14-frontend-routing--auth-context)
15. [Frontend: Pages](#15-frontend-pages)
16. [Frontend: Components](#16-frontend-components)
17. [Payment Providers (Mock & Razorpay)](#17-payment-providers-mock--razorpay)
18. [Security Summary](#18-security-summary)
19. [End-to-End Data Flows](#19-end-to-end-data-flows)

---

## 1. Project Architecture

```
horizon-airways/
├── apps/
│   ├── api/          ← Express + TypeScript backend
│   │   └── src/
│   │       ├── server.ts       ← HTTP + WebSocket server entry point
│   │       ├── app.ts          ← Express app factory (routes, middleware)
│   │       ├── lib/            ← Shared utilities
│   │       ├── routes/         ← Route handlers
│   │       ├── payments/       ← Payment provider abstraction
│   │       └── ai/             ← AI search + optimizer
│   └── web/          ← React 18 + Vite + Tailwind CSS frontend
│       └── src/
│           ├── lib/            ← API client, auth context, utils
│           ├── pages/          ← Route-level page components
│           └── components/     ← Reusable UI components
└── packages/
    └── db/           ← Prisma schema + seed script (shared between apps)
        └── prisma/
            ├── schema.prisma
            └── seed.ts
```

**Tech stack at a glance:**
- Backend: Express 5, TypeScript, Prisma ORM, PostgreSQL (Neon), node-cron, ws (WebSocket), Resend (email), PDFKit (ticket PDF), tsx (TS runtime)
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query v5, React Router v6, Lucide icons
- Auth: JWT HS256 (Bearer header + httpOnly cookie), bcryptjs, AES-256-GCM for passport numbers
- Payments: Mock card provider (Luhn check) or live Razorpay (auto-detect by env vars)
- Deployment: Railway (single service: API + serves frontend static files), Neon PostgreSQL

---

## 2. Entry Points: server.ts & app.ts

### `apps/api/src/server.ts`

This is the process entry point. It does three things:

```typescript
import "./env.js";                            // loads .env file
const app = createApp();                      // creates Express app
const httpServer = createServer(app);         // wraps it in a Node HTTP server

// WebSocket server attached to the SAME HTTP server at path /ws/track
const wss = new WebSocketServer({ server: httpServer, path: "/ws/track" });
```

**Why attach WebSocket to the same HTTP server?** A single port handles both HTTP REST requests and WebSocket upgrades. This is required on Railway where only one port is exposed.

**WebSocket tracking logic:**
```typescript
wss.on("connection", (ws) => {
  let interval = null;

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "track" && msg.callsign) {
      // Poll OpenSky every 30s for aircraft position
      interval = setInterval(() => {
        fetchAircraftPosition(callsign).then(pos =>
          ws.send(JSON.stringify({ type: "position", callsign, data: pos }))
        );
      }, 30_000);
      poll(); // immediate first poll
    } else if (msg.type === "stop") {
      clearInterval(interval);
    }
  });

  ws.on("close", () => clearInterval(interval)); // cleanup on disconnect
});
```

The frontend sends `{type:"track", callsign:"HAI101"}`, receives back `{type:"position", callsign, data:{lat, lon, altitude, speed}}` every 30 seconds and renders a live map.

**After creating the server, it also starts the cron scheduler:**
```typescript
startNotificationScheduler(); // from lib/notifications.ts
httpServer.listen(port, ...);

// Process-level error guards prevent Railway restarts on transient errors
process.on("unhandledRejection", (reason) => { console.error("[unhandledRejection]", reason); });
process.on("uncaughtException", (err) => { console.error("[uncaughtException]", err); });
```

**WebSocket error handling** — each connection has per-poll try/catch and a `ws.on("error", ...)` handler so a single bad OpenSky response or disconnected client doesn't crash the server process.

---

### `apps/api/src/app.ts`

`createApp()` configures and returns the Express application. The key patterns here:

**CORS configuration:**
```typescript
cors({
  origin: [
    process.env.CLIENT_URL ?? "http://localhost:5173",
    "https://fsad-production.up.railway.app",
  ],
  credentials: true, // required for httpOnly cookie auth
})
```
`credentials: true` is required so the browser sends the `token` httpOnly cookie alongside requests.

**Route mounting order matters:**
```typescript
app.use("/api/flights/live", flightsLiveRouter); // must come BEFORE /api/flights
app.use("/api/flights", flightsRouter);
```
Express matches routes by registration order. `/api/flights/live` must be registered before `/api/flights` or the `:id` wildcard in `GET /api/flights/:id` would swallow it.

**Static file serving (single-process production deployment):**
```typescript
const webDist = resolve(here, "../../web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });
}
```
On Railway, `npm run build` in the web workspace puts static files in `apps/web/dist`. The API serves them directly — no separate Vite server needed in production. The regex `/^\/(?!api\/)/` means "any path that does NOT start with /api/" gets the React SPA's `index.html`, enabling React Router to handle client-side navigation.

**Central error handler (4-arg Express middleware):**
```typescript
app.use((err: unknown, _req, res, _next) => {
  if (err instanceof HttpError)  → res.status(err.status).json({ message })
  if (err instanceof ZodError)   → res.status(400).json({ message, issues })
  else                           → res.status(500).json({ message: "Internal server error" })
});
```
Any route that calls `next(err)` ends up here. The two custom error types are intentional (typed HTTP error + schema validation error); everything else is a 500.

---

## 3. Database Schema (Prisma)

**13 models, all using `cuid()` as primary key (collision-resistant string IDs).**

### Core Relationships

```
User ──1:1──► Passenger (via userId)
User ──1:1──► Employee  (via userId, nullable — employees may not have logins)
User ──1:N──► PasswordResetToken
User ──1:N──► PaymentOrder

Airport ──1:N──► Flight (as origin)
Airport ──1:N──► Flight (as destination)
Aircraft ──1:N──► Flight

Flight ──1:N──► Seat
Flight ──1:N──► Booking
Flight ──1:N──► CrewAssignment

Passenger ──1:N──► Booking

Booking ──1:1──► Seat     (seatId @unique — one seat per booking, one booking per seat)
Booking ──1:1──► Payment  (optional)
Booking ──1:1──► Ticket   (optional)

Employee ──1:N──► Attendance
Employee ──1:N──► DutyReport
Employee ──1:N──► CrewAssignment
```

### Key Models

**User** — authentication identity only. `role` is an enum: `PASSENGER | STAFF | ADMIN`. No PII here.

**Passenger** — the PII container. Linked 1:1 to User via `userId`. Stores:
- `passportEnc: String?` — AES-256-GCM encrypted passport number (never plaintext)
- `preferences: Json?` — `{meal, seatPref, assistance}` stored as PostgreSQL JSON
- One Passenger can have many Bookings

**Flight** — `flightNo` is NOT `@unique`. Multiple flights can have the same flight number on different dates (e.g. HA101 flies daily). Key point: you cannot `upsert` by flightNo; you must `findFirst({ where: { flightNo } })` then `create` if null.

**Seat** — `@@unique([flightId, seatNo])` enforces no duplicate seats per flight. `status` enum: `AVAILABLE | HELD | BOOKED`. The seat's cabin class (FIRST/BUSINESS/ECONOMY) is determined by row number at seed time.

**Booking** — `seatId @unique` enforces one booking per seat globally. `pnr @unique` — 6-char PNR is the human-facing reference. `farePaid` stores the actual amount paid (may differ from baseFare due to cabin multiplier). Added fields: `passengerName String?`, `passengerEmail String?`, `passengerType String @default("ADULT")` — store per-passenger details directly on the Booking row for multi-pax flows.

**PaymentOrder** — server-side record created when `POST /api/payments/order` is called. Stores `orderId`, `flightId`, `seatNo`, `amount` (in rupees), `userId`, and `seatsJson Json?` (JSONB array of `{seatNo, fare}` for multi-seat orders). The booking route validates this record to prevent amount-tampering: a client cannot fabricate a lower fare.

**PasswordResetToken** — stores `tokenHash` (SHA-256 of the raw token, never the raw token itself), `expiresAt` (15 minutes), `used` boolean.

---

## 4. Backend Libraries

### `lib/auth.ts`

```typescript
// JWT sign: HS256, 7-day expiry
function signToken(payload: { id: string; role: string }): string

// JWT verify: returns { id, role } or throws
function verifyToken(token: string): JwtPayload

// Express middleware: reads Bearer header or cookies.token
// Attaches req.user = { id, role } or throws HttpError 401
function requireAuth(req, res, next)

// Role guard factory: requireRole("ADMIN") or requireRole("ADMIN", "STAFF")
function requireRole(...roles: string[])
```

The `requireAuth` middleware reads the token from either:
1. `Authorization: Bearer <token>` header (used by the frontend's `api.ts`)
2. `req.cookies.token` (httpOnly cookie, set at login)

Both are supported so the same endpoints work from browser fetch requests (Bearer) and future server-side or mobile clients (cookie).

### `lib/crypto.ts`

```typescript
// encrypt("A1234567") → "iv_hex:tag_hex:ciphertext_hex"
function encrypt(plain: string): string

// decrypt("iv_hex:tag_hex:ciphertext_hex") → "A1234567"
function decrypt(stored: string): string
```

The encryption key is `SHA-256(JWT_SECRET)` — no extra env var needed. AES-256-GCM is an authenticated encryption mode: the `tag` (16-byte auth tag) proves the data wasn't tampered with. The 12-byte IV is random on every `encrypt()` call, so encrypting the same passport number twice produces different ciphertext.

The only place passport plaintext touches the app layer is at the moment of `encrypt()` on write and `decrypt()` on read. It's immediately masked (`A****567`) before being returned in any API response.

### `lib/mailer.ts`

```typescript
function getClient(): Resend | null  // returns null if RESEND_API_KEY not set
function sendMail({ to, subject, html, attachments? }): Promise<boolean>
function isMailConfigured(): boolean
```

All email goes through Resend SDK. The `from` address is `Horizon Airways <onboarding@resend.dev>` (Resend's shared sending domain for development). `sendMail` returns `true` on success, `false` on failure — callers decide whether to retry. The booking confirmation email uses `.catch()` for fire-and-forget behaviour so a mail failure never blocks the booking response.

### `lib/validate.ts`

```typescript
function validate(schema: ZodSchema): RequestHandler
```

This middleware replaces `req.body` with the Zod-parsed (and coerced) value. If Zod throws a `ZodError`, it's passed to `next()` and caught by the central error handler which returns a 400. Because it replaces `req.body`, route handlers can safely type-cast: `const body = req.body as z.infer<typeof schema>`.

### `lib/http-error.ts`

```typescript
class HttpError extends Error {
  constructor(public status: number, message: string)
}
```

Throw `new HttpError(404, "Flight not found")` anywhere in a route handler and the central error middleware returns exactly `{ "message": "Flight not found" }` with HTTP 404.

### `lib/pnr.ts`

```typescript
function genPnr(): string
// → "K4X9BW" (6-char uppercase alphanumeric)
```

Generates 6-character PNR. The booking route retries up to 10 times on collision (statistically ~1-in-36^6 chance = 1 in 2.1 billion, but protected defensively).

### `lib/ticket-pdf.ts`

```typescript
interface TicketData {
  pnr, flightNo, origin, destination, departAt, arriveAt,
  passengerName, seatNo, cabinClass, farePaid
}
function renderTicketPdf(data: TicketData): Promise<Buffer>
```

Uses PDFKit to generate an A4 PDF entirely in memory (no temp files). The PDF includes PNR, route, departure/arrival times, passenger name, seat, cabin class, and fare. It's returned as a `Buffer` which is then either:
1. Uploaded to S3 (`putObject`) and a presigned URL stored in `Ticket.pdfKey`
2. Attached directly to the confirmation email via Resend attachments API

### `lib/card.ts`

```typescript
function luhn(num: string): boolean
function detectBrand(num: string): "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER" | "JCB" | "UNKNOWN"
function validateCard({ number, expiry, cvv }): { valid: true, last4, brand } | { valid: false, reason }
```

This is the **server-side** card validator used by the mock payment provider. The frontend also has a **client-side** mirror (`luhnCheck`, `validateCardExpiry` in `lib/api.ts`) for immediate UX feedback without a round trip. Both use the same Luhn algorithm. Cards ending in `0002` are hard-declined by the mock provider for testing decline flows.

### `lib/crud.ts`

```typescript
function makeCrudRouter(modelDelegate, zodSchema, { roles }): Router
```

A generic CRUD factory. Pass a Prisma model delegate (`prisma.aircraft`), a Zod schema, and allowed write roles — it returns an Express Router with:
- `GET /` — `findMany()` all records
- `GET /:id` — `findUnique({ where: { id } })` or 404
- `POST /` — auth + role guard + validate + `create`
- `PUT /:id` — auth + role guard + validate (`.partial()`) + `update`
- `DELETE /:id` — auth + role guard + `delete`

`serializeRecord` recursively converts `Prisma.Decimal` to `Number` (Prisma returns Decimal objects for `Decimal` columns; JSON.stringify doesn't handle them automatically).

---

## 5. Authentication Routes (`/api/auth/*`)

### POST `/api/auth/register`

**Input:** `{ email, password, fullName, phone?, dob?, nationality?, passportNo?, address? }`

**What happens:**
1. Zod validates the body (email format, password ≥ 8 chars)
2. `prisma.user.findUnique({ where: { email } })` — 409 if already exists
3. `bcrypt.hash(password, 10)` — 10 salt rounds
4. `prisma.user.create(...)` with nested `passenger: { create: { ... } }` — creates both User and Passenger in one transaction
5. Passport number is `encrypt(passportNo)` before storage
6. `signToken({ id, role })` → returns JWT + sets httpOnly `token` cookie

The `select` on the create excludes `passwordHash` from the returned user object.

### POST `/api/auth/login`

**Input:** `{ email, password }`

1. `prisma.user.findUnique` → 401 if not found (generic message to prevent user enumeration)
2. `bcrypt.compare(password, user.passwordHash)` → 401 if wrong
3. `signToken` + cookie + return `{ token, user }` (without passwordHash)

### GET `/api/auth/me`

Requires `requireAuth`. Returns `{ id, email, role, createdAt }` for the authenticated user. Used by the frontend `AuthProvider` on page load to restore session state.

### GET `/api/auth/profile`

Requires `requireAuth`. Returns all Passenger fields except `passportEnc`. Instead returns `passportMasked`: the decrypted passport run through `maskPassport()` which produces `"A****567"`.

### PATCH `/api/auth/profile`

Partial updates to Passenger. Each field uses a conditional spread: `...(fullName !== undefined && { fullName })` — this means sending `{phone: null}` explicitly clears the phone, while omitting `phone` entirely leaves it unchanged.

### POST `/api/auth/forgot-password`

**Security-critical endpoint:**

1. Always returns 200 (even if email not found) — prevents enumeration
2. Invalidates all existing unused tokens for the user: `updateMany({ where: { userId, used: false }, data: { used: true } })`
3. Generates `rawToken = randomBytes(32).toString('hex')` (64 hex chars = 256 bits of entropy)
4. Stores `tokenHash = sha256(rawToken)` — the raw token NEVER touches the database
5. Sends email via Resend with `resetLink = CLIENT_URL/reset-password?token=rawToken`
6. Email is fire-and-forget: `.catch(err => console.error(...))`

The raw token only exists in the email. Even if the database is compromised, the attacker gets hashes, not usable tokens.

### POST `/api/auth/reset-password`

**Input:** `{ token, newPassword }`

1. `tokenHash = sha256(token)` from request
2. `prisma.passwordResetToken.findUnique({ where: { tokenHash } })` — 400 if not found
3. Check `record.used` and `record.expiresAt < new Date()` — 400 if expired or used
4. `bcrypt.hash(newPassword, 10)` → update user
5. Mark token `used: true`

The token can only be used once. Expiry is 15 minutes.

---

## 6. Flight Routes (`/api/flights/*`)

### GET `/api/flights` (search)

**Query params:** `origin?, destination?, date (YYYY-MM-DD), pax?`

**Key logic — hiding departed flights:**
```typescript
const dayStart = new Date(`${date}T00:00:00.000+05:30`); // IST midnight
const now = new Date();
const departFrom = dayStart <= now ? now : dayStart;

// For today: show only flights departing after right now
// For future dates: show all flights from midnight IST
```

This was a bug that was fixed: the original code used `dayStart` as the lower bound, so if you searched for today's flights at 3 PM you'd see 9 AM flights that already departed. Now `departFrom = max(now, dayStart)`.

**Other filters:**
- `status: { not: "CANCELLED" }` — CANCELLED flights never appear in search
- Orders by `departAt: "asc"`
- Returns a projected shape (no raw Prisma types — `baseFare` is `Number(f.baseFare)`, etc.)

### GET `/api/flights/board`

Returns all SCHEDULED and DEPARTED flights in the next 72 hours. Used by the departure board admin UI. Filters: `status IN (SCHEDULED, DEPARTED)`, `departAt <= now+72h`, `arriveAt >= now` (flights that haven't landed yet).

### GET `/api/flights/:id`

Returns the full flight including the seat map. Seats are ordered by `cabinClass ASC` then `seatNo ASC`. Fare per seat is computed:

```typescript
fare: Math.round(Number(flight.baseFare) * (
  s.cabinClass === "FIRST" ? 3 :
  s.cabinClass === "BUSINESS" ? 2 : 1
))
```

Economy = 1× baseFare, Business = 2×, First = 3×.

### POST `/api/flights` (admin create)

Creates a flight + immediately generates seats. The `buildSeatData(flightId, capacity)` function:
- Row 1 → FIRST class (6 seats)
- Rows 2-3 → BUSINESS (12 seats)
- Rows 4+ → ECONOMY (remaining seats)
- Columns: A, B, C, D, E, F (6 per row)

Accepts either `originId` (UUID) or `originCode` (IATA like "DEL") — the `resolveAirportId` helper looks up the airport if only a code is given.

### DELETE `/api/flights/:id` (admin)

Cascades manually because Prisma's cascade delete requires `onDelete: Cascade` in the schema. The route manually deletes in FK order:
1. Tickets (FK → Bookings)
2. Payments (FK → Bookings)
3. Bookings (FK → Flight)
4. PaymentOrders (FK → Flight)
5. Seats (FK → Flight)
6. CrewAssignments (FK → Flight)
7. Flight

---

## 7. Payment Routes (`/api/payments/*`)

### POST `/api/payments/order`

**Input:** `{ flightId, seats: string[] }` (array of seat numbers for multi-pax)
**Purpose:** Creates a payment order on the server before showing the user the payment UI.

```typescript
// Compute fare for each seat in the order
const seatsJson = seats.map(seatNo => {
  const seat = flight.seats.find(s => s.seatNo === seatNo);
  const multiplier = seat.cabinClass === "FIRST" ? 3 : seat.cabinClass === "BUSINESS" ? 2 : 1;
  return { seatNo, fare: Math.round(Number(flight.baseFare) * multiplier) };
});
const totalFare = seatsJson.reduce((sum, s) => sum + s.fare, 0);
const amountPaise = totalFare * 100; // paise for Razorpay API
const order = await provider.createOrder(amountPaise, "INR", receipt);

// Store server-computed amount bound to this user+flight+seats
await prisma.paymentOrder.create({
  data: { orderId: order.orderId, flightId, seatNo: seats[0], amount: totalFare, userId, seatsJson }
});
```

**Why this two-step approach?** Without a server-side PaymentOrder record, a malicious client could:
- Change the amount in the network request to pay ₹1 for a ₹5000 seat
- Reuse a payment orderId for multiple bookings

The booking route later validates that the submitted `orderId` matches a PaymentOrder that:
- Belongs to the requesting user
- Matches the requested flight+seats
- Has not been used yet

---

## 8. Booking Routes (`/api/bookings/*`)

### POST `/api/bookings` — The Most Complex Route

This route handles multi-passenger booking in a single atomic transaction. It's worth walking through every step:

**1. Validation:**
```typescript
const passengerInputSchema = z.object({
  seatNo: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  type: z.enum(["ADULT", "CHILD"]).default("ADULT"),
  preferences: z.object({ meal: z.string().optional(), assistance: z.boolean().optional() }).optional(),
});
const createBookingSchema = z.object({
  flightId: z.string(),
  passengers: z.array(passengerInputSchema).min(1).max(9),
  payment: z.union([razorpayPaymentSchema, mockPaymentSchema]),
});
```
Accepts 1–9 passengers. Each passenger references a specific seat by `seatNo`.

**2. PaymentOrder validation:**
```typescript
const paymentOrder = await prisma.paymentOrder.findUnique({ where: { orderId: submittedOrderId } });
if (!paymentOrder) throw 402;
if (paymentOrder.userId !== userId) throw 402;
if (paymentOrder.flightId !== flightId) throw 402;
if (paymentOrder.used) throw 402;
```

**3. Payment verification (before the DB transaction):**
```typescript
const verifyResult = await provider.verify(payment);
if (!verifyResult.ok) throw HttpError(402, verifyResult.reason);
```
Payment is verified BEFORE the atomic transaction to avoid holding DB locks during a network call to Razorpay.

**4. Atomic transaction (one Booking row per passenger):**
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Lock ALL seats atomically
  for (const pax of passengers) {
    const updated = await tx.seat.updateMany({
      where: { flightId, seatNo: pax.seatNo, status: "AVAILABLE" },
      data: { status: "BOOKED" },
    });
    if (updated.count === 0) throw HttpError(409, `Seat ${pax.seatNo} is no longer available`);
  }

  // Mark PaymentOrder consumed
  await tx.paymentOrder.update({ where: { orderId }, data: { used: true } });

  // One Booking + Ticket per passenger
  const bookings = [];
  for (const pax of passengers) {
    const fare = seatsJson.find(s => s.seatNo === pax.seatNo)?.fare ?? 0;
    // Generate unique PNR, create Booking, Payment (on first pax), Ticket
    bookings.push(await tx.booking.create({ data: { ..., passengerName: pax.fullName, passengerEmail: pax.email, passengerType: pax.type } }));
  }

  // Increment seatsBooked by number of passengers
  await tx.flight.update({ where: { id: flightId }, data: { seatsBooked: { increment: passengers.length } } });
  return bookings;
});
```

The key race-condition protection: `updateMany({ where: { flightId, seatNo, status: "AVAILABLE" } })`. If two concurrent requests try to book the same seat, only one succeeds. This is an optimistic lock — no `SELECT ... FOR UPDATE` needed.

**5. Post-transaction (non-fatal):**
- PDF generation + S3 upload (failure doesn't roll back the booking)
- Confirmation email with PDF attachment (fire-and-forget via `.catch()`)

**Returns:** `{ bookings: [{id, pnr, flightId, seatNo, passengerName, passengerType, farePaid, status}] }`

### GET `/api/bookings/mine`

Returns all bookings for the authenticated user, including nested flight, seat, payment, and ticket. Ordered newest-first.

### POST `/api/bookings/:id/cancel`

Atomic transaction:
1. Update booking status to CANCELLED + set `cancelledAt`
2. Update seat status to AVAILABLE (re-opens the seat)
3. Decrement `flight.seatsBooked`
4. Update payment status to REFUNDED

### GET `/api/bookings/:id/ticket`

Returns the full ticket payload the frontend ETicket component needs. Optionally generates a presigned S3 URL for the PDF download (null if S3 not configured).

---

## 9. Admin CRUD Routes

### Generic CRUD (`lib/crud.ts`)

Five routes built from `makeCrudRouter(prisma.aircraft, aircraftSchema, { roles: ["ADMIN", "STAFF"] })`:
- `GET /api/aircraft` — list all
- `GET /api/aircraft/:id` — get one
- `POST /api/aircraft` — create (ADMIN/STAFF only)
- `PUT /api/aircraft/:id` — partial update (ADMIN/STAFF only)
- `DELETE /api/aircraft/:id` — delete (ADMIN/STAFF only)

The same pattern is used for employees, crew, attendance, and duty reports. All use `requireAuth + requireRole` as write guards.

### Reports (`/api/reports/:type`)

```typescript
const REPORT_HANDLERS = {
  revenue, flights, reservations, cancellations,
  aircraft, salary, employees, attendance, performance
};
```

Each handler accepts `{ from?, to? }` date range and returns `{ summary: {...}, series: [{label, value}] }`. The admin Reports page fetches one at a time and renders it as a chart.

---

## 10. AI Feature Routes

### POST `/api/ai/search`

The AI search parses natural language like "morning flight from Delhi to Mumbai this Friday" into a structured `ParsedSearch` object:

```typescript
{
  origin?: "DEL",
  destination?: "BOM",
  dateFrom?: "2026-11-28",
  dateTo?: "2026-11-28",
  timeOfDay?: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT",
  sort?: "CHEAPEST" | "FASTEST" | "EARLIEST"
}
```

**Provider strategy** (`ai/provider.ts`):
```typescript
// 1. Try local regex/keyword parser (instant, no network)
const local = await localProvider.parseSearch(text);
if (local.destination || local.origin) return local; // fast path

// 2. Only call LLM if local parser couldn't extract a route
const llm = await llmProvider.parseSearch(text);
return { ...local, ...llm }; // LLM fills gaps
```

This means typical queries ("Delhi to Mumbai") never hit the LLM API — the local parser handles them in <1ms. The LLM is only called for ambiguous queries like "anywhere warm this weekend".

**Time-of-day filtering in IST:**
```typescript
function matchesTimeOfDay(departAt: Date, timeOfDay): boolean {
  // Convert UTC to IST before checking hour
  const istMinutes = departAt.getUTCHours() * 60 + departAt.getUTCMinutes() + (5*60+30);
  const hour = Math.floor((istMinutes % (24*60)) / 60);
  const [start, end] = TIME_RANGES[timeOfDay];
  return hour >= start && hour < end;
}
```
This was a bug fix from earlier: without the IST offset, a 9 AM IST flight is stored as 3:30 AM UTC and would be classified as NIGHT instead of MORNING.

---

## 11. Notification & Cron Scheduler

**`lib/notifications.ts` — two cron jobs, one process:**

```typescript
export function startNotificationScheduler() {
  import("node-cron").then(({ default: cron }) => {
    // Every 1 minute: advance flight statuses
    cron.schedule("* * * * *", () => runFlightStatusUpdates());

    // Every 15 minutes: send pre-flight email reminders
    cron.schedule("*/15 * * * *", () => runNotifications());

    // Initial run after 5s delay (let DB connections settle)
    setTimeout(() => { runFlightStatusUpdates(); runNotifications(); }, 5000);
  });
}
```

### `runFlightStatusUpdates()`

```typescript
// SCHEDULED → DEPARTED: departAt has passed
await prisma.flight.updateMany({
  where: { status: "SCHEDULED", departAt: { lte: now } },
  data: { status: "DEPARTED" },
});

// DEPARTED → ARRIVED: arriveAt has passed
await prisma.flight.updateMany({
  where: { status: "DEPARTED", arriveAt: { lte: now } },
  data: { status: "ARRIVED" },
});
```

Runs every minute. Batch `updateMany` — single SQL query touches all eligible flights.

### `runNotifications()`

Queries CONFIRMED bookings for flights departing in the next 25 hours. For each:
- **24h reminder:** `hoursUntil >= 23 && hoursUntil <= 25` — sends "Your flight departs tomorrow" email
- **2h reminder:** `hoursUntil >= 1.5 && hoursUntil <= 2.5` — sends "Your flight departs in 2 hours" email

**Deduplication:** `const notified = new Set<string>()` stores keys like `"bookingId:24h"`. Once sent, that combination is never sent again in the same process lifetime. This is in-memory — a process restart would re-send, but the 2-hour window is narrow enough that this is acceptable.

---

## 12. WebSocket Flight Tracking

The FlightMap component (admin panel) connects to `ws://host/ws/track`:

```typescript
// Frontend sends:
ws.send(JSON.stringify({ type: "track", callsign: "HAI101" }))

// Backend (server.ts) polls OpenSky every 30s and responds:
ws.send(JSON.stringify({
  type: "position",
  callsign: "HAI101",
  data: { latitude: 28.5, longitude: 77.1, altitude: 10668, velocity: 240, ... }
}))
```

`fetchAircraftPosition` in `lib/opensky.ts` hits the OpenSky Network API (no key needed for public data, optional auth via `OPENSKY_USER` + `OPENSKY_PASS` for higher rate limits). The aircraft state vector includes lat/lon, altitude, velocity, and heading.

---

## 13. Frontend: Core Libraries

### `lib/api.ts`

The API client. All frontend HTTP requests go through this:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(method, path, body?, options?): Promise<T> {
  const token = localStorage.getItem('hz_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Network failures (no internet, DNS failure) are caught separately from HTTP errors
  let res: Response;
  try {
    res = await fetch(url, { method, credentials: 'include', headers, body });
  } catch {
    throw new ApiError(0, 'Network error — please check your connection');
  }

  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? `HTTP ${res.status}`, data);
  }
  return data as T;
}

export const api = { get, post, put, del, patch };
```

`credentials: 'include'` sends cookies. The `Bearer` header is attached if `hz_token` exists in localStorage. `ApiError` is a typed error class with `status` and `data` fields — components use `instanceof ApiError` to extract the server's error message. Status `0` indicates a network-level failure (not an HTTP error).

The file also exports client-side card helpers:
- `luhnCheck(num)` — Luhn algorithm for instant card number validation
- `validateCardExpiry(expiry)` — parses MM/YY and checks not expired
- `formatCardNumber(value)` — inserts spaces: "4539148803436467" → "4539 1488 0343 6467"
- `formatExpiry(value)` — inserts slash: "1228" → "12/28"

### `lib/utils.ts`

Format helpers used throughout the UI:
- `formatCurrency(amount)` — `₹5,000`
- `formatTime(date)` — `"09:00"` in IST
- `formatDate(date, options?)` — `"23 Nov 2026"` in IST
- `getDuration(from, to)` — `"2h 15m"`
- `cn(...classes)` — Tailwind class merger (clsx + tailwind-merge)

---

## 14. Frontend: Routing & Auth Context

### `lib/auth.tsx` — AuthProvider

React Context that wraps the entire app. Exposes:

```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;        // true while /auth/me request is in-flight
  login(email, password): Promise<void>;
  register(data): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
}
```

**On mount:** `useEffect(() => refreshUser(), [])` — calls `GET /api/auth/me` to restore session from stored JWT. If the token is expired or invalid, the backend returns 401 and `refreshUser` clears localStorage + sets `user = null`.

**On login/register:** stores JWT in `localStorage` + sets `user` state.

**On logout:** calls `POST /api/auth/logout` (clears the httpOnly cookie), then clears localStorage + sets `user = null`.

### `components/ProtectedRoute.tsx`

```typescript
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && !allowed.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
```

Used in `router.tsx` to protect `/book/:id`, `/confirmation/:id`, `/my-bookings`, `/profile`, and all `/admin/*` routes. The `state: { from: location }` passes the current URL to the login page so after login the user is redirected back where they came from.

Admin routes additionally check role: `<ProtectedRoute role={['STAFF', 'ADMIN']}>`.

### `router.tsx`

Defines the React Router v6 route tree. All routes share the `<App />` layout (Navbar + `<Outlet />`). Booking, confirmation, my-bookings, and profile are wrapped in `ProtectedRoute`. Admin routes are wrapped in `ProtectedRoute` with role guard.

---

## 15. Frontend: Pages

### `Search.tsx`

Two search modes controlled by `nlMode` state:

**Classic mode (default):** HTML form with:
- **Trip type toggle:** One Way / Round Trip
- Origin/destination selects, departure date, pax count
- **Return date picker** (appears only in Round Trip mode)
- **Filter panel** (toggleable; dot indicator when filters are active; "Clear filters" button):
  - Sort: Cheapest / Fastest / Earliest / Latest
  - Departure time slot: Any / Morning (5am–12pm) / Afternoon (12pm–5pm) / Evening (5pm–9pm) / Night (9pm–5am)
  - Arrival time slot: same slots
  - Max fare slider (range auto-computed from query results via `useMemo`)
- All filtering via `applyFiltersAndSort()` pure function — no additional API calls; `getHourIST(dateStr)` converts UTC ISO string to IST hour for time slot matching

**One-way results:** `useQuery` from TanStack Query fetches `GET /api/flights?...`. Renders results as `<FlightCard />` list.

**Round-trip results:** Two `useQuery` instances — `flightQuery` (outbound) and `returnQuery` (return leg with swapped origin/destination and return date). Outbound and return results stacked vertically; compact `FlightRow` component used for selection (click to select/deselect). `selectedOutbound` / `selectedReturn` state tracks chosen legs. Combined total card shown at the bottom once either leg is chosen, with a "Book" CTA.

**AI mode:** Text input → `useMutation` POSTs to `/api/ai/search`. Shows a "parsed chips" row with what the AI extracted (origin badge, destination badge, date, time-of-day, sort preference). Then renders the same `<FlightCard />` list.

The Live Fares (SerpAPI) tab has been removed.

### `Booking.tsx`

Multi-passenger three-step wizard: Select Seats → Passengers → Payment.

**URL param:** `?pax=N` (default 1, clamped 1–9) — the step indicator reads "Select N Seats".

**State:**
```typescript
const [step, setStep] = useState<Step>('seat');
const [selectedSeats, setSelectedSeats] = useState<Array<{seatId: string, seatNo: string}>>([]);
const [forms, setForms] = useState<PassengerForm[]>([]); // one per pax
const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
```

**Step 1 (Seat selection):** Renders `<SeatMap />` with `selectedSeats` and `maxSelectable={pax}`. When user clicks a seat: if already selected, deselects it; if at capacity, removes the oldest selection (FIFO) and adds the new one. Each selected seat shows its passenger number (1, 2, 3…) in the map. Continue button is enabled only when exactly `pax` seats are selected.

**Step 2 (Passengers):** One form per selected seat, in order. First passenger pre-filled from `GET /api/auth/profile`. Each form has: fullName (required), email, phone, ADULT/CHILD toggle, meal preference, assistance checkbox. Form submits → `useMutation` calls `POST /api/payments/order { flightId, seats: [seatNo, ...] }` → on success, advances to step 3.

**Step 3 (Payment):** Shows per-seat fare breakdown (seatNo + cabin class + fare). Then:
- If `paymentOrder.provider === 'razorpay'`: dynamically loads Razorpay checkout.js script, opens modal
- If `paymentOrder.provider === 'mock'`: shows card input form with real-time Luhn validation

Both paths call `POST /api/bookings { flightId, passengers: [{seatNo, fullName, email?, phone?, type, preferences}], payment }`. On success → `navigate('/confirmation/:bookings[0].id')`.

### `ForgotPassword.tsx`

Simple email form → `POST /api/auth/forgot-password`. On success, `setSent(true)` and shows "Check your inbox" message. No token or link ever shown to the user — it's emailed.

---

## 16. Frontend: Components

### `SeatMap.tsx`

Groups seats by cabin class → then by row number. For each row, renders seat buttons in A-B-C | D-E-F layout (aisle gap after seat C).

```typescript
function getSeatPosition(col: string): string {
  if (col === 'A' || col === 'F') return 'Window';
  if (col === 'B' || col === 'E') return 'Middle';
  return 'Aisle'; // C or D
}
```

Tooltip on each seat button: `"4A — Window — ₹7,500"`. The `aria-label` includes the position for screen reader accessibility. FIRST class seats render with a gold background, BUSINESS with blue, ECONOMY with default.

**Multi-select support:** New props `selectedSeats?: string[]` and `maxSelectable?: number` enable multi-passenger selection. When `selectedSeats` is provided, `isSelected` checks `selectedSeats.includes(seat.id)`. Selected seats display their passenger number (1, 2, 3…) instead of a single checkmark, so users can see which seat belongs to which passenger.

### `FlightCard.tsx`

Expandable card. Click expands to show aircraft model, date, seat availability progress bar, amenities. The book button is conditional:

```typescript
{user ? (
  <Link to={`/book/${flight.id}`}>Select Flight</Link>
) : (
  <button onClick={() => navigate('/login', {
    state: { from: { pathname: `/book/${flight.id}` } }
  })}>
    Login to Book
  </button>
)}
```

If logged in, navigates directly to `/book/:id`. If not, redirects to `/login` with the flight URL as `from` state — after login, the Login page reads `location.state.from` and redirects there.

### `FareBadge.tsx`

Fetches the AI fare forecast for a flight via `GET /api/ai/fare-forecast/:flightId`. Shows a colored badge: "CHEAP" (green), "FAIR" (yellow), "HIGH" (red), or "VERY_HIGH" (ember). The forecast uses historical price data + current occupancy.

### `RebookingSuggestions.tsx`

Shows alternative flights when a booking is cancelled. Calls `POST /api/ai/rebooking` with the cancelled booking's route and date. The AI finds 3 alternatives and presents them with a "Rebook" link.

### `ErrorBoundary.tsx`

React class component (required — only class components can catch render errors via lifecycle methods).

```typescript
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: { componentStack: string }) { console.error('[ErrorBoundary]', error); }
  render() {
    if (this.state.error) return <FriendlyErrorScreen />; // "Go to Homepage" button
    return this.props.children;
  }
}
```

Wraps the entire app in `main.tsx`. Any unhandled render crash shows a friendly dark-themed error screen instead of a blank page. Uses inline styles (not Tailwind) so it renders correctly even if the CSS bundle fails to load.

**Smart QueryClient (`main.tsx`):**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
        return failureCount < 1; // one retry for transient errors
      },
      staleTime: 30 * 1000,
    },
    mutations: { retry: false },
  },
});
```
Avoids hammering the server on auth errors and prevents mutation retries that could double-submit.

---

## 17. Payment Providers (Mock & Razorpay)

### `payments/provider.ts`

```typescript
export interface PaymentProvider {
  name: string;
  createOrder(amount: number, currency: string, receipt: string): Promise<OrderResult>;
  verify(payment: unknown): Promise<VerifyResult>;
}

export function getPaymentProvider(): PaymentProvider {
  return (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    ? razorpayProvider
    : mockProvider;
}
```

Auto-detects based on env vars. No code change needed to switch from test to live.

### `payments/mock.ts`

```typescript
createOrder(amountPaise, currency, receipt) {
  return { orderId: `order_mock_${Date.now()}_${random}`, amount: amountPaise, currency };
}

verify(payment) {
  // Decline cards ending in 0002
  if (card.number.endsWith('0002')) return { ok: false, reason: "Card declined" };

  const result = validateCard(card);  // Luhn + expiry + CVV
  if (!result.valid) return { ok: false, reason: result.reason };

  return { ok: true, paymentId: `pay_mock_${Date.now()}`, method: "CARD", last4: result.last4 };
}
```

### `payments/razorpay.ts`

```typescript
verify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  // HMAC-SHA256 of "orderId|paymentId" using KEY_SECRET
  const expected = crypto.createHmac('sha256', KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const valid = timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
  if (!valid) return { ok: false, reason: "Invalid signature" };
  ...
}
```

`timingSafeEqual` prevents timing side-channel attacks: a naive `expected === signature` comparison leaks how many characters match by taking different amounts of time.

---

## 18. Security Summary

| Concern | Implementation |
|---------|----------------|
| Auth | JWT HS256, 7d expiry, Bearer + httpOnly cookie |
| Password storage | bcryptjs, 10 salt rounds |
| Passport numbers | AES-256-GCM, IV random per encrypt, key = SHA-256(JWT_SECRET) |
| Password reset | 256-bit random token, only hash stored in DB, 15min expiry, one-time use |
| Payment tamper | Server-side PaymentOrder record; booking validates amount+flight+seat |
| Race conditions | Atomic `updateMany` seat lock inside `prisma.$transaction` |
| Razorpay signature | HMAC-SHA256 + `timingSafeEqual` (constant-time) |
| Email enumeration | forgot-password always returns 200 regardless |
| Role authorization | `requireRole` middleware; ProtectedRoute checks role in React |
| Credentials | `.env` gitignored; never committed; Railway Variables in production |

---

## 19. End-to-End Data Flows

### A. User Registers

```
Browser           api.ts           /api/auth/register        DB
  │                 │                      │                   │
  ├─ register() ───►│                      │                   │
  │  POST /auth     │─── fetch POST ──────►│                   │
  │  /register      │                      │─── bcrypt.hash ──►│
  │                 │                      │─── user.create ──►│ (User + Passenger)
  │                 │                      │◄── { id, email } ─│
  │                 │◄── { token, user } ──│                   │
  │◄── setUser() ───│                      │                   │
  │   setToken()    │                      │                   │
```

### B. Flight Search

```
Browser         Search.tsx       useQuery         /api/flights
  │                │                │                  │
  ├─ form submit ─►│                │                  │
  │                ├── refetch() ──►│                  │
  │                │                ├─── GET /flights? ►│
  │                │                │   origin=DEL      │── Prisma findMany
  │                │                │   destination=BOM │   (now <= departAt)
  │                │                │   date=2026-11-23 │
  │                │                │◄── Flight[] ──────│
  │◄── render ─────│◄── data ───────│                  │
  │  FlightCard[]  │                │                  │
```

### C. Book a Flight (Full Flow)

```
1. User clicks "Select Flight" on FlightCard
   → Navigate to /book/:flightId?pax=N

2. Booking.tsx loads — useQuery fetches GET /api/flights/:id (seat map)
   Step indicator reads "Select N Seats / Passengers / Payment"

3. User selects N seats (SeatMap multi-select, FIFO replacement)
   Each seat shows its passenger number (1, 2, 3…)

4. User fills per-passenger forms (N forms, first pre-filled from profile)
   → orderMutation fires:
   POST /api/payments/order { flightId, seats: ["4A", "4B"] }
   Backend: validate seats available → compute fare per seat → store seatsJson → provider.createOrder
   Response: { orderId, amount (paise), provider }

5. Payment step (per-seat fare breakdown shown):
   MOCK path:
   - User enters card → luhnCheck + validateCardExpiry (client-side)
   - bookingMutation fires: POST /api/bookings {
       flightId,
       passengers: [{seatNo, fullName, email?, phone?, type, preferences}, ...],
       payment: { orderId, card }
     }
   
   RAZORPAY path:
   - Razorpay modal opens → user pays → handler fires POST /api/bookings with signature

6. POST /api/bookings:
   a. Validate PaymentOrder (amount tamper check, flightId match)
   b. provider.verify(payment) — BEFORE transaction
   c. prisma.$transaction:
      - For each seat: seat.updateMany({ status: "AVAILABLE" → "BOOKED" }) → TOCTOU-safe
      - paymentOrder.update({ used: true })
      - For each passenger: booking.create (pnr, passengerName, passengerType) + ticket.create
      - flight.update({ seatsBooked: +N })
   d. PDF generation (non-fatal)
   e. Confirmation email (fire-and-forget)

7. Response: { bookings: [{id, pnr, ...}, ...] }
   → navigate('/confirmation/:bookings[0].id')
```

### D. Password Reset

```
User              ForgotPassword.tsx     /api/auth/forgot-password       Resend
  │                      │                         │                        │
  ├─ enter email ────────►│                         │                        │
  ├─ submit ─────────────►│                         │                        │
  │                       ├─── POST /forgot ───────►│                        │
  │                       │                         ├─── randomBytes(32) ──► (raw token)
  │                       │                         ├─── sha256(raw) ───────► DB store
  │                       │                         ├─── sendMail() ─────────────────────►│
  │                       │                         │                        │  email with │
  │                       │                         │                        │  raw token  │
  │                       │◄─── { message } ────────│                        │             │
  │◄─── "Check inbox" ────│                         │                        │             │
  │                       │                         │                        │             │
  ├─ clicks email link ──────────────────────────────────────────────────────────────────► ResetPassword.tsx
  ├─ enters new password ─────────────────────────────────────────────────► POST /api/auth/reset-password
  │                                                                          sha256(token) lookup
  │                                                                          check: used? expired?
  │                                                                          bcrypt.hash(newPassword)
  │                                                                          mark token used
```

---

## SIMPLE EXPLANATION

> Plain English for anyone who needs to explain this project — even without deep technical knowledge.

---

### What Does This App Do?

Horizon Airways is a web-based flight booking system like a mini version of MakeMyTrip. Users can search for flights, pick a seat, pay for it, and get a ticket in their email. There's also an admin panel for airline staff to manage flights, aircraft, crew, and generate reports. The app works fully online — data is stored in a cloud database, emails are sent in real time, and flight statuses update automatically every minute.

---

### The Three Layers

**Frontend (what users see):** Built with React. It runs entirely in the user's browser. When a user opens the website, React downloads the page and handles all the clicking, form filling, and navigation without refreshing the page. It talks to the backend by sending HTTP requests (like phone calls to the server).

**Backend (the brain):** Built with Express (a Node.js framework). It runs on a server in the cloud (Railway). It handles all the business rules — checking passwords, processing payments, creating bookings, sending emails. The frontend is not trusted with sensitive logic.

**Database (the memory):** PostgreSQL hosted on Neon. All data lives here — users, flights, bookings, payments. The backend uses Prisma as a "translator" between JavaScript code and database SQL queries.

---

### How User Registration Works Step by Step

1. User fills in name, email, password, phone, passport number on the Register page
2. Browser calls `POST /api/auth/register` with this data
3. The backend receives it and runs it through Zod validation (checks email format, password ≥ 8 chars, etc.)
4. It checks if that email already exists in the database — if yes, returns "Email already registered"
5. The password is **hashed** with bcrypt — this means it's scrambled in a one-way direction so even database admins can't read it. `bcrypt.hash("mypassword123", 10)` → `"$2a$10$...48characters..."`
6. The passport number is **encrypted** with AES-256-GCM — this scrambles it but CAN be unscrambled with the right key. It's stored as `"iv:tag:ciphertext"` in the database.
7. Both User and Passenger records are created in the database in one atomic operation
8. A JWT token is created: `signToken({ id, role })` → a signed string the user carries around to prove their identity
9. The JWT is returned in the HTTP response AND set as a cookie in the browser. The browser stores it in localStorage.

---

### How Flight Search Works Step by Step

1. User picks origin (DEL), destination (BOM), date, passengers on the Search page
2. TanStack Query (the data-fetching library) sends `GET /api/flights?origin=DEL&destination=BOM&date=2026-11-23&pax=1`
3. The backend receives this, parses the query params with Zod
4. It computes `departFrom = max(now, midnight-of-date)` — if searching today, only show flights that haven't departed yet
5. Prisma runs: `flight.findMany({ where: { origin.code: "DEL", destination.code: "BOM", departAt: { gte: departFrom, lte: midnight+1day }, status: { not: "CANCELLED" } } })`
6. This generates SQL: `SELECT * FROM "Flight" JOIN "Airport" ... WHERE ... ORDER BY departAt ASC`
7. The backend serializes the result (converts database types to plain JavaScript objects) and returns JSON
8. TanStack Query stores this in its cache. React re-renders the Search page with the flight list.
9. Each flight appears as a `FlightCard` component.

There's also an **AI Search** mode: user types "morning flight from Delhi to Mumbai this Friday". This goes to `POST /api/ai/search`. A local keyword parser tries to extract the route. If it can find DEL→BOM it returns immediately. If not, it calls an LLM API (like OpenAI) for help. Then the same database query runs but filtered by time-of-day.

---

### How Booking Works Step by Step (Including Payment)

1. User clicks "Select Flight" (only shown if logged in — otherwise shows "Login to Book")
2. ProtectedRoute checks `user` from AuthContext — redirects to login if not logged in
3. Booking page loads at `/book/:flightId?pax=N` and fetches the flight including its full seat map from `GET /api/flights/:id`. The step indicator reads "Select N Seats / Passengers / Payment".
4. User clicks up to N seats on the seat map → each selected seat shows its passenger number (1, 2, 3…); clicking a new seat when at capacity replaces the oldest selection (FIFO)
5. User fills one passenger form per seat (name required, email, phone, ADULT/CHILD toggle, meal/assistance) — first form pre-filled from profile
6. User clicks "Proceed to Payment" → React sends `POST /api/payments/order { flightId, seats: ["4A","4B"] }`
7. Backend computes fare per seat: `baseFare × multiplier` (Economy=1×, Business=2×, First=3×), stores `seatsJson`, creates a PaymentOrder record in the DB, returns `{ orderId, amount }`
8. Payment step shows per-seat fare breakdown. Then:
   - **Mock mode:** credit card form. User enters card number. Browser runs Luhn check immediately.
   - **Razorpay mode:** "Pay with Razorpay" button which opens a Razorpay popup
9. User submits payment → React sends `POST /api/bookings { flightId, passengers: [{seatNo, fullName, email?, phone?, type, preferences}, ...], payment: {...} }`
10. Backend validates the PaymentOrder (checks the amount wasn't tampered with by comparing to its stored record)
11. Payment is verified with the payment provider (mock card check or Razorpay signature check)
12. Inside a database transaction: each seat changes from AVAILABLE to BOOKED; one Booking + Ticket record is created per passenger; flight's `seatsBooked` counter goes up by N
13. If two people click the same seat at the same time: only one wins because the SQL `UPDATE WHERE status='AVAILABLE'` can only succeed once — the second gets a 409 error
14. After the transaction: a PDF ticket is generated in memory and uploaded to S3; a confirmation email with PDF attachment is sent
15. Response: `{ bookings: [{id, pnr}, ...] }` → browser navigates to `/confirmation/:bookings[0].id`

---

### How Emails Get Sent

The app uses **Resend** (an email sending service). When configured (`RESEND_API_KEY` in environment variables):

```
Backend code calls:
sendMail({ to: "user@example.com", subject: "...", html: "..." })

This calls:
new Resend(RESEND_API_KEY).emails.send({ from: "Horizon Airways <onboarding@resend.dev>", to, subject, html })
```

Three kinds of emails:
1. **Password reset** — sent when user requests it; contains a one-time link
2. **Booking confirmation** — sent after successful booking; has PDF ticket attached
3. **Pre-flight reminders** — sent 24 hours and 2 hours before departure by a cron job

Emails are "fire-and-forget" for booking confirmation — the booking is already complete, so a mail failure should never make the user think their booking failed. The code uses `.catch(console.error)` to swallow errors silently.

---

### How JWT Auth Works Simply

JWT stands for JSON Web Token. Think of it like a signed VIP wristband at a concert:

1. When you log in, the server creates a token: it takes `{ id: "user-123", role: "PASSENGER" }` and signs it with a secret key (like a wax seal). The result looks like: `eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InVzZXItMTIzIn0.xxx`

2. The browser stores this token in localStorage.

3. Every API request includes `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...` in the HTTP headers.

4. The backend receives the token, verifies the signature using the same secret key. If the signature matches, it trusts the user ID inside. If the token was tampered with or expired (after 7 days), the signature doesn't match and the backend returns 401.

5. No database lookup needed to verify identity — the signature on the token is proof enough.

---

### How the Database Tables Relate to Each Other

Think of it like this family of related records for one booking:

```
User (login account)
 └── Passenger (personal details like name, passport)
      └── Booking (the booking record)
           ├── Flight (which flight)
           │    ├── Airport (origin)
           │    ├── Airport (destination)
           │    └── Aircraft (which plane)
           ├── Seat (which seat on that flight)
           ├── Payment (payment details)
           └── Ticket (PDF key for the e-ticket)
```

The key rule: each Booking references exactly one Seat, and each Seat can only be in one Booking (`seatId @unique`). This is how the system prevents double-booking.

---

### What Prisma Does

Prisma is an ORM (Object-Relational Mapper). Without it, you'd write raw SQL:
```sql
SELECT u.*, p.fullName FROM "User" u JOIN "Passenger" p ON p."userId" = u.id WHERE u.email = 'x@y.com';
```

With Prisma, you write:
```typescript
prisma.user.findUnique({ where: { email }, include: { passenger: true } })
```

Prisma generates the SQL for you, returns TypeScript-typed objects, and handles the database connection pool. The schema (`schema.prisma`) is the single source of truth — Prisma generates TypeScript types from it.

---

### What TanStack Query Does

TanStack Query (formerly React Query) is a data-fetching and caching library. Without it, you'd need to manually handle loading states, errors, and cache invalidation:

```typescript
// Without TanStack Query — tedious boilerplate
useEffect(() => {
  setLoading(true);
  fetch('/api/flights')
    .then(r => r.json())
    .then(data => { setFlights(data); setLoading(false); })
    .catch(err => { setError(err); setLoading(false); });
}, []);
```

With TanStack Query:
```typescript
const { data: flights, isLoading, isError } = useQuery({
  queryKey: ['flights', origin, destination, date],
  queryFn: () => api.get('/flights?...')
});
```

It automatically handles: loading state, error state, caching (don't re-fetch if data is fresh), refetching when the component re-mounts, and the `queryKey` determines when to re-fetch (if origin/destination/date changes, it fetches again automatically).

`useMutation` is for write operations (POST/PUT/DELETE) that shouldn't be cached.

---

### What Middleware Does

Middleware is code that runs between receiving a request and sending the response. In Express, it's a function with signature `(req, res, next)` that either processes the request and calls `next()` to pass it on, or returns a response directly.

Example chain for `POST /api/bookings`:
```
Request arrives
  → express.json()      (parses JSON body)
  → bookingsRouter.use(requireAuth)   (checks JWT, attaches req.user)
  → validate(createBookingSchema)     (Zod validates body)
  → actual route handler              (creates booking)
  → central error handler (if any next(err) was called)
```

If `requireAuth` finds no valid token, it calls `next(new HttpError(401, "Unauthorized"))` which skips the route handler and goes straight to the error handler.

---

### What Zod Does

Zod is a schema validation library. It ensures data has the right shape before your business logic runs.

```typescript
const createBookingSchema = z.object({
  flightId: z.string().min(1),
  seatNo: z.string().min(1),
  passenger: z.object({
    fullName: z.string().min(1),
    phone: z.string().optional(),
  }),
  payment: z.union([razorpaySchema, mockSchema]),
});
```

If the request body doesn't match, Zod throws a `ZodError` which the error handler catches and returns as a 400 with detailed error messages. This prevents garbage data from reaching the database or causing unexpected crashes.

---

### What bcrypt Does

bcrypt is a password hashing function. It's one-way: `bcrypt.hash("password123", 10)` → `"$2a$10$...48chars..."`. You can never reverse it back to "password123".

The `10` is the **salt rounds** — higher means slower to compute (intentionally!). This makes brute-force attacks impractical: each attempt takes ~100ms, so 1 million guesses would take ~27 hours.

When a user logs in: `bcrypt.compare("password123", storedHash)` runs the same algorithm and checks if the result matches. It's safe because even if two users have the same password, their stored hashes are different (bcrypt includes a random salt).

---

### What AES-256-GCM Encryption Is Doing

Passports are sensitive government IDs. Even if someone steals the database, we don't want them to read passport numbers.

AES-256-GCM is a symmetric encryption algorithm:
- **AES-256**: the cipher, using a 256-bit key
- **GCM**: mode that also produces an authentication tag (proves the data wasn't modified)

```
encrypt("A1234567"):
  key = SHA-256(JWT_SECRET)                    → 32 bytes
  iv = randomBytes(12)                         → 12 random bytes, different every time
  cipher.update("A1234567") + cipher.final()  → ciphertext
  cipher.getAuthTag()                          → 16 bytes of authentication tag
  stored: "iv_hex:tag_hex:ciphertext_hex"

decrypt("ab12...:cd34...:ef56..."):
  split on ":" to get iv, tag, ciphertext
  decipher with same key + iv
  verify auth tag matches (if not, throws — data was tampered with)
  returns "A1234567"
```

The key comes from `SHA-256(JWT_SECRET)` so no extra environment variable is needed.

---

### What the Cron Job Does

A cron job is a task that runs automatically on a schedule, like a timer.

The app has two cron schedules:

**Every 1 minute — flight status updater:**
```
Runs: "are there any SCHEDULED flights whose departure time has passed?"
  Yes → mark them DEPARTED
"Are there any DEPARTED flights whose arrival time has passed?"
  Yes → mark them ARRIVED
```
This is why a flight on the board changes from "SCHEDULED" to "DEPARTED" automatically at the departure time, without anyone manually updating it.

**Every 15 minutes — email reminders:**
```
Find all CONFIRMED bookings for flights departing in the next 25 hours
For each booking:
  - If 23-25 hours away: send "Your flight departs tomorrow" email
  - If 1.5-2.5 hours away: send "Your flight departs in 2 hours" email
```
Deduplication: once a reminder is sent for a booking, it's recorded in memory (`notified` Set) so it's never sent twice.

---

### What WebSocket Does for Flight Tracking

Normal HTTP is request-response: you ask, server answers, connection closes. WebSocket is a persistent two-way connection.

When an admin opens the Flight Map panel:
1. Browser opens a WebSocket connection: `ws://server/ws/track`
2. Browser sends `{ type: "track", callsign: "HAI101" }`
3. Server starts polling the OpenSky Network API every 30 seconds for the aircraft's GPS position
4. Every 30 seconds, server sends back `{ type: "position", data: { lat: 28.5, lon: 77.1, altitude: 10668, speed: 240 } }`
5. The map updates in real time, drawing the aircraft moving along its route
6. When the admin closes the panel: browser sends `{ type: "stop" }` → server clears the interval

Without WebSocket, the frontend would need to poll `GET /api/flight-position` every 30 seconds, creating N×requests for N users tracking flights.

---

### Common Professor Questions and Answers

**Q: What is REST and does this project follow it?**
A: REST (Representational State Transfer) is a style for designing APIs using HTTP methods for CRUD operations. Yes — `GET /api/flights` lists flights, `POST /api/flights` creates one, `PUT /api/flights/:id` updates, `DELETE /api/flights/:id` deletes. Resources are identified by URLs, stateless requests (each request carries the JWT), JSON responses.

**Q: How is data consistency maintained during concurrent seat booking?**
A: Using an atomic database transaction with an optimistic lock: `seat.updateMany({ where: { id, status: "AVAILABLE" }, data: { status: "BOOKED" } })`. Since both competing requests run this simultaneously, the database guarantees only one `UPDATE` can match the `status='AVAILABLE'` condition. The second gets `count=0` and throws a 409 conflict.

**Q: What's the difference between hashing and encryption?**
A: Hashing (bcrypt for passwords) is one-way — you can never get the original back. It's used when you only need to verify (compare passwords), never retrieve. Encryption (AES-256-GCM for passports) is two-way — you can decrypt with the right key. Used when you need to retrieve the original value later (displaying masked passport to user, sending on travel documents).

**Q: Why use JWT instead of server-side sessions?**
A: JWT is stateless — the server doesn't need to store session data. Any server instance can verify a JWT by checking the signature with the shared secret. This scales horizontally: if you add more servers, they all verify JWTs without a shared session store. The trade-off is that you can't instantly invalidate a JWT before expiry (this app uses 7-day tokens).

**Q: What is the N+1 query problem and does this project avoid it?**
A: N+1 is when you fetch N records then make 1 query per record for related data. This project uses Prisma's `include` to do JOINs: `findMany({ include: { origin: true, destination: true, aircraft: true } })` — one query instead of N+3 queries.

**Q: How does the payment flow prevent double-spending?**
A: Three-layer protection: (1) PaymentOrder record is created server-side with a computed amount — client can't send a fake lower amount. (2) The `used` flag on PaymentOrder prevents the same order from being used twice. (3) The `seatId @unique` constraint in the database means even if two requests race past the transaction, only one Booking record can exist per seat.

**Q: What is CORS and why is it needed?**
A: CORS (Cross-Origin Resource Sharing) is a browser security policy that blocks frontend code from calling APIs on different domains. The frontend at `localhost:5173` can't call the backend at `localhost:4000` without the backend explicitly allowing it via `Access-Control-Allow-Origin` header. The backend whitelists the CLIENT_URL. Without CORS config, browsers would block all requests.

**Q: How is the app deployed?**
A: Both frontend and backend deploy to a single Railway service. The build step runs `npm run build` in the web workspace, producing static files in `apps/web/dist`. The backend serves those static files using `express.static()`. All traffic goes to one URL — no separate hosting for frontend needed. Database is on Neon (serverless PostgreSQL). Environment variables (JWT_SECRET, DATABASE_URL, RESEND_API_KEY, etc.) are set in Railway Variables, never committed to git.

**Q: What is the role of Prisma's `$transaction`?**
A: `$transaction` wraps multiple database operations in a single atomic SQL transaction. Either ALL operations succeed and are committed, or if ANY fails, they ALL roll back. Used in the booking route to ensure: seat status update + payment record + booking record + ticket record all happen together. No partial state (booking without payment, or payment without seat being marked BOOKED) is possible.
