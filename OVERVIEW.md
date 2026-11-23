# Horizon Airways — Comprehensive Project Overview

---

## 1. Project Objective & Summary

**Horizon Airways** is a full-stack airline management and booking system built as a full-stack application development (FSAD) project. It simulates a real airline's digital platform end-to-end: passengers can register, search flights, pick seats, pay, and receive e-tickets via email. Staff and admins manage aircraft, employees, crew rosters, attendance, duty reports, and analytics. The system also includes AI-assisted features (natural-language search, fare forecasting, crew optimizer, smart rebooking) and real-time flight tracking via OpenSky Network.

**Live deployment:** Railway (single service, API + frontend static files served together).  
**Database:** Neon serverless PostgreSQL.  
**Email:** Resend (transactional, HTTPS API — no SMTP).

---

## 2. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | 5.6 | Type safety |
| Vite | 6.0 | Build tool, dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| TanStack Query | 5.62 | Server state, caching, mutations |
| React Router v6 | 6.28 | Client-side routing, nested routes |
| Lucide React | 0.468 | Icon library |
| React Leaflet + Leaflet | 4.2 / 1.9 | Interactive flight tracking map |
| Recharts | 2.13 | Admin analytics charts |
| QRCode | 1.5 | PNR QR code on e-ticket |
| react-to-print | 3.0 | Print e-ticket from browser |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 26 | Runtime |
| Express | 4.21 | HTTP server, routing |
| TypeScript | 5.6 | Type safety |
| tsx | 4.19 | Runtime TypeScript execution (no compile step) |
| Zod | 3.23 | Request validation schemas |
| bcryptjs | 2.4 | Password hashing (10 rounds) |
| jsonwebtoken | 9.0 | JWT signing/verification |
| cookie-parser | 1.4 | httpOnly cookie support |
| cors | 2.8 | CORS with explicit origin whitelist |
| node-cron | 4.6 | Scheduled notification jobs |
| PDFKit | 0.21 | In-memory PDF generation for e-tickets |
| ws | 8.23 | WebSocket server for real-time flight tracking |
| Resend SDK | 6.39 | Transactional email delivery |
| Razorpay SDK | 2.9 | Payment gateway (optional) |
| AWS SDK v3 (S3) | 3.1173 | PDF storage (optional) |
| Vitest | 2.1 | Unit/integration test runner |
| Supertest | 7.0 | HTTP integration testing |

### Database / ORM
| Technology | Purpose |
|---|---|
| PostgreSQL (Neon) | Serverless production database |
| Prisma ORM 5.22 | Schema, migrations, type-safe queries |

### Infrastructure
| Service | Purpose |
|---|---|
| Railway | Production hosting — single service, auto-deploy on git push to main |
| Neon | Serverless PostgreSQL with connection pooling |
| GitHub | Source control, CI trigger for Railway |

---

## 3. All APIs & External Services

| Service | Key Required | Status | What It Does |
|---|---|---|---|
| **Resend** | `RESEND_API_KEY` | Active | Sends confirmation emails and pre-flight reminders via HTTPS API (not SMTP). Free tier only allows verified email addresses. |
| **Razorpay** | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | Optional (mock used if absent) | Real payment gateway; order creation + HMAC signature verification |
| **OpenSky Network** | None required (or `OPENSKY_USER` + `OPENSKY_PASS`) | Active (anonymous) | Live aircraft position (lat/lon/altitude/heading/velocity) for flight tracking map |
| **AviationStack** | `AVIATIONSTACK_KEY` | Optional | Real-time flight status (gate, delay, actual departure). Falls back to DB data if unset |
| **SerpAPI** | `SERPAPI_KEY` | Optional | Google Flights live fares for the "Live Fares" tab in search. No-op if unset |
| **AWS S3** | `AWS_ENDPOINT_URL_S3` + `S3_BUCKET` | Optional | Stores PDF e-tickets; presigned download URLs. Falls back to in-memory generation + email attachment if unset |
| **Neon PostgreSQL** | `DATABASE_URL` | Required | Production database with connection pooling |

---

## 4. Database Schema

### Models and Relationships

```
User (id, email, passwordHash, role: PASSENGER|STAFF|ADMIN, createdAt)
  ├── Passenger (1:1) — passenger profile + PII
  ├── Employee (1:1) — staff/admin employee record
  ├── PaymentOrder[] — orders created by this user
  └── PasswordResetToken[] — active reset tokens

Passenger (id, userId, fullName, phone, dob, nationality, passportEnc[AES-256-GCM], address, preferences[JSON])
  └── Booking[]

Employee (id, userId?, empCode[unique], fullName, designation, dutyArea, salary, contact)
  ├── CrewAssignment[]
  ├── Attendance[]
  └── DutyReport[]

Airport (id, code[unique IATA], name, city, country)
  ├── departures: Flight[] (origin)
  └── arrivals: Flight[] (destination)

Aircraft (id, registration[unique], model, capacity, status)
  └── Flight[]

Flight (id, flightNo, originId, destinationId, aircraftId, departAt, arriveAt, baseFare, capacity, seatsBooked, status: SCHEDULED|DEPARTED|ARRIVED|CANCELLED)
  ├── Seat[]
  ├── Booking[]
  ├── CrewAssignment[]
  └── PaymentOrder[]

Seat (id, flightId, seatNo, cabinClass: FIRST|BUSINESS|ECONOMY, status: AVAILABLE|HELD|BOOKED)
  └── Booking (0:1)
  @@unique([flightId, seatNo])

Booking (id, pnr[unique], passengerId, flightId, seatId[unique], farePaid, status: CONFIRMED|CANCELLED, createdAt, cancelledAt?, passengerName?, passengerEmail?, passengerType: ADULT|CHILD)
  ├── Payment (1:1)
  └── Ticket (1:1)

Payment (id, bookingId[unique], orderId, paymentId, cardLast4, amount[rupees], status, method)

Ticket (id, bookingId[unique], issuedAt, pdfKey?)

PaymentOrder (id, orderId[unique], flightId, seatNo, amount[rupees], userId, used, createdAt, seatsJson[JSONB]?)
  — Server-computed order binding flight+seats+amount+user; prevents fare tampering; seatsJson stores per-seat fare breakdown for multi-pax orders

Attendance (id, employeeId, date, checkIn?, checkOut?, status)
  @@unique([employeeId, date])

DutyReport (id, employeeId, dutyArea, startAt, endAt?)

PasswordResetToken (id, userId, tokenHash[unique SHA-256], expiresAt, used)
```

**Key design decisions:**
- `Seat.seatId` on `Booking` is `@unique` — one booking per seat, enforced at DB level
- `PaymentOrder` model prevents client-side fare manipulation (server computes amount per seat, stored in `seatsJson`)
- `passportEnc` stored as AES-256-GCM ciphertext — never raw plaintext in DB
- `flightNo` is NOT `@unique` on Flight (same route number runs every day with date+slot suffix like `HA101A-20261124`)
- `Booking.passengerName/Email/Type` stored directly — avoids joins for multi-pax display

---

## 5. Backend Architecture

### Entry Point
`server.ts` → creates Express app, starts HTTP server + WebSocket, starts notification scheduler

### App Structure (`app.ts`)
- JSON body parser, CORS (whitelist: localhost:5173 + Railway domain), cookie-parser
- Central error middleware: catches `HttpError` (typed status codes), `ZodError` (400), anything else (500)
- Serves built frontend static files from `apps/web/dist` in production (single-process mode)

### API Routes

| Route | Auth | Description |
|---|---|---|
| `POST /api/auth/register` | None | Register + create Passenger profile; returns JWT |
| `POST /api/auth/login` | None | Login; returns JWT + sets httpOnly cookie |
| `GET /api/auth/me` | JWT | Current user |
| `GET /api/auth/profile` | JWT | Passenger profile (passport masked) |
| `PATCH /api/auth/profile` | JWT | Update profile + preferences |
| `POST /api/auth/change-password` | JWT | Verify current password, set new |
| `POST /api/auth/forgot-password` | None | Generate reset token (SHA-256 hash stored) |
| `POST /api/auth/reset-password` | None | Consume reset token, set new password |
| `POST /api/auth/logout` | None | Clear cookie |
| `GET /api/flights` | None | Search flights (origin?, dest?, date, pax) — hides past departures today |
| `GET /api/flights/board` | None | Departure board (next 72h, SCHEDULED+DEPARTED) |
| `GET /api/flights/:id` | None | Single flight with full seat map |
| `POST /api/flights` | ADMIN | Create flight + generate seats |
| `PUT /api/flights/:id` | ADMIN | Update flight |
| `DELETE /api/flights/:id` | ADMIN | Delete flight (cascades bookings, seats, crew) |
| `GET /api/flights/live` | None | SerpAPI live fares (requires SERPAPI_KEY) |
| `GET /api/flight-status/:flightNo` | None | AviationStack status + DB merge |
| `POST /api/payments/order` | JWT | Create PaymentOrder (server-computes fare) |
| `POST /api/bookings` | JWT | Create booking: verify payment → atomic seat lock → record |
| `GET /api/bookings/mine` | JWT | Passenger's own bookings |
| `GET /api/bookings/:id` | JWT | Single booking (ownership check) |
| `POST /api/bookings/:id/cancel` | JWT | Cancel + release seat + refund status |
| `GET /api/bookings/:id/ticket` | JWT | Full ticket payload + presigned PDF URL |
| `GET /api/aircraft` | None | List aircraft |
| `POST/PUT/DELETE /api/aircraft` | ADMIN | CRUD aircraft |
| `GET /api/employees` | STAFF/ADMIN | List employees |
| `POST/PUT/DELETE /api/employees` | ADMIN | CRUD employees |
| `GET/POST /api/crew` | STAFF/ADMIN | Crew assignments |
| `GET/POST /api/attendance` | STAFF/ADMIN | Attendance records |
| `GET/POST /api/duty` | STAFF/ADMIN | Duty reports |
| `GET /api/reports/revenue` | ADMIN | Revenue aggregation with time filter |
| `GET /api/reports/flights` | ADMIN | Flight stats |
| `GET /api/reports/bookings` | ADMIN | Booking stats |
| `POST /api/ai/search` | None | NL flight search via LLM |
| `GET /api/ai/fare-forecast/:flightId` | None | Rule-based fare trend (buy now/wait) |
| `GET /api/ai/optimizer` | STAFF/ADMIN | Flag underbooked/no-crew flights |
| `POST /api/ai/rebooking` | None | Suggest alternatives for a flight |
| `GET /api/health` | None | `{ok, mail}` health check |

### Middleware
- `requireAuth` — validates Bearer JWT (`Authorization` header) or falls back to httpOnly cookie; attaches `req.user = { id, role }`
- `requireRole(...roles)` — checks `req.user.role` against allowed list; throws 403
- `validate(schema)` — Zod `safeParse` on `req.body`; throws 400 with issue list on failure

### Error Handling
- `HttpError` class with `.status` and `.message` — thrown anywhere, caught by central middleware
- `ZodError` → 400 with full issues list
- Uncaught errors → 500 "Internal server error" (error logged to console, not leaked to client)
- Non-fatal operations (PDF generation, email, S3 upload) wrapped in try/catch — booking succeeds even if these fail
- `process.on('unhandledRejection')` and `process.on('uncaughtException')` in `server.ts` — prevents Railway process restarts on transient errors
- WebSocket poll errors caught per-connection; `ws.on('error', ...)` handler on each socket
- `storage.ts`: `putObject` and `presignGet` return `null` on S3 failure rather than throwing

---

## 6. Frontend Architecture

### Pages

| Page | Route | Auth | Description |
|---|---|---|---|
| Landing | `/` | None | Hero, features, quick search entry |
| Login | `/login` | None | Email/password, redirects to `from` location after success |
| Register | `/register` | None | Full registration with optional PII fields |
| ForgotPassword | `/forgot-password` | None | Requests reset token |
| ResetPassword | `/reset-password` | None | Consumes token, sets new password |
| Search | `/search` | None | Classic form + NL mode + Live Fares tab |
| Booking | `/book/:flightId` | Protected | 3-step: Select N Seats → Passengers → Payment; multi-pax support (1–9 passengers) |
| Confirmation | `/confirmation/:bookingId` | Protected | Success banner + ETicket component |
| MyBookings | `/my-bookings` | Protected | List, view ticket, cancel, flight map, rebooking |
| Profile | `/profile` | Protected | View/edit passenger details, change password |
| AdminDashboard | `/admin` | ADMIN/STAFF | Stats tiles, optimizer flag count |
| AircraftAdmin | `/admin/aircraft` | ADMIN/STAFF | CRUD aircraft |
| EmployeesAdmin | `/admin/employees` | ADMIN/STAFF | CRUD employees |
| FlightsAdmin | `/admin/flights` | ADMIN/STAFF | CRUD flights |
| CrewAdmin | `/admin/crew` | ADMIN/STAFF | Assign crew to flights |
| Attendance | `/admin/attendance` | ADMIN/STAFF | Mark/view attendance |
| Duty | `/admin/duty` | ADMIN/STAFF | Duty report management |
| Optimizer | `/admin/optimizer` | ADMIN/STAFF | AI optimizer flags |
| Reports | `/admin/reports` | ADMIN/STAFF | Revenue/booking/flight charts (Recharts) |

### Key Components
- `ProtectedRoute` — redirects to `/login?from=...` if no user; role check for admin routes
- `SeatMap` — visual cabin layout (FIRST/BUSINESS/ECONOMY), window/middle/aisle tooltip, AVAILABLE/BOOKED/SELECTED states; multi-select mode: `selectedSeats?: string[]`, `maxSelectable?: number`, shows passenger number on each selected seat
- `FlightCard` — expandable card; "Login to Book" vs "Select Flight" based on auth state
- `ErrorBoundary` — React class component wrapping the entire app; catches render errors and shows a friendly "Go to Homepage" screen instead of a blank page
- `ETicket` — full boarding pass UI with QR code (PNR), print button, PDF download link if S3 configured
- `FlightMap` — Leaflet map showing origin → destination arc + live aircraft marker (OpenSky WebSocket)
- `RebookingSuggestions` — AI-powered alternative flight suggestions on booking page
- `FareBadge` — real-time fare trend badge (↑RISING / ↓DROPPING / →STABLE) per flight
- `LiveFlights` — SerpAPI live fare tab in Search
- `Toast` — global toast notification system

### State Management
- **TanStack Query** for all server state: flights, bookings, profile, admin data — with `staleTime`, `retry: 1`
- **AuthContext** (`useAuth`) — user, token, loading state; login/register/logout/refreshUser
- **Local state** (useState) for form fields, step navigation, modal visibility
- Token stored in `localStorage` as `hz_token`; also set as httpOnly cookie for server reads

---

## 7. Complete User Workflows

### Registration & Login
1. User fills register form (email, password, fullName; optional: phone, DOB, nationality, passport, address)
2. POST `/api/auth/register` → bcrypt hash password (10 rounds) → create User + Passenger in transaction → AES-256-GCM encrypt passport if provided → return JWT
3. Token stored in localStorage + httpOnly cookie set
4. On refresh: `GET /api/auth/me` using stored token → restore session

### Flight Search (3 modes)
**Classic:** Select origin (optional), destination (optional), date, pax count, trip type (one-way / round-trip) → `GET /api/flights` for outbound; second query for return leg when round-trip. Flights sorted by departure time. Filters panel: sort (cheapest/fastest/earliest/latest), departure/arrival time slots (morning/afternoon/evening/night, IST), max fare slider. All filtering client-side. Round-trip combined total card shown when both legs selected. Flights already departed today are hidden (server uses `now` as lower bound). Live Fares (SerpAPI) tab removed.

**Natural Language (AI):** Type e.g. "cheapest morning flight from Delhi to Mumbai next Friday" → POST `/api/ai/search` → LLM parses to `{ origin, destination, dateFrom, dateTo, timeOfDay, sort }` → DB query with IST time-of-day filter → sorted results returned with `parsed` context shown to user.

**Live Fares:** Select airports + date → SerpAPI Google Flights → real airline prices displayed (view-only, cannot book live fares).

### Booking Flow (3 steps)
1. **Seat Selection:** Visual seat map → select N seats (N = `?pax=` URL param, 1–9); FIFO replacement when at capacity; each selected seat shows its passenger number (1, 2, 3…); colour: FIRST=gold, BUSINESS=blue, ECONOMY=default; tooltip `4A — Window — ₹4,500`
2. **Passengers:** One form per seat; first form auto-filled from profile; fill/confirm name + email + phone + ADULT/CHILD toggle + meal preference + assistance flag; seat summary card shows chosen seats and per-seat fare
3. **Payment:** POST `/api/payments/order { flightId, seats: ["4A","4B"] }` (server computes fare with cabin multiplier: FIRST=3×, BUSINESS=2×, ECONOMY=1×, stores `seatsJson`) → per-seat fare breakdown shown → mock card form (Luhn validation, real-time format) or Razorpay checkout → POST `/api/bookings { flightId, passengers: [...], payment: {...} }` → atomic DB transaction → one Booking row per passenger → confirmation

### Booking Confirmation
- Redirect to `/confirmation/:bookingId` → fetch `/api/bookings/:id/ticket` → display ETicket with PNR, QR code, seat details
- Fire-and-forget email: PDF e-ticket generated in-memory (PDFKit) → attached to Resend email → sent to user's email address

### My Bookings
- List all bookings ordered by newest first
- Expand any booking to view full ETicket
- Cancel booking → confirmation modal → atomic cancellation (seat released, seatsBooked decremented, payment → REFUNDED)
- Inline Leaflet map showing flight route arc
- AI rebooking suggestions for cancelled flights

### Pre-flight Notifications
- `node-cron` runs every 15 minutes
- Finds CONFIRMED bookings with flights departing in next 25h
- Sends 24h reminder when 23–25h before departure
- Sends 2h reminder when 1.5–2.5h before departure
- In-memory dedup set prevents double-sending within a process lifetime

---

## 8. Admin Workflows

| Workflow | Description |
|---|---|
| **Dashboard** | Counts: fleet size, employee count, flagged flights (optimizer), total AI flags |
| **Aircraft CRUD** | Add/edit/remove aircraft with registration, model, capacity, status |
| **Employee CRUD** | Manage employees with empCode, designation, dutyArea, salary, contact |
| **Flights CRUD** | Create flights (auto-generates full seat map), update status, delete with cascade |
| **Crew Assignments** | Assign pilot/co-pilot/cabin crew to flights; view per-flight crew |
| **Attendance** | Mark employee check-in/check-out; view daily attendance |
| **Duty Reports** | Log duty start/end for employees; view by employee or date |
| **AI Optimizer** | Flags: UNDERBOOKED (< 20% capacity), NO_CREW (0 assigned), FULL (≥ 95%) |
| **Reports** | Revenue by flight (bar chart), bookings over time, flight count — filterable by date range |

---

## 9. Email & Notification System

**Provider:** Resend SDK (not Nodemailer/SMTP — Railway blocks outbound SMTP).  
**From address:** `Horizon Airways <onboarding@resend.dev>` (Resend's shared domain).  
**Limitation:** Resend free tier can only deliver to verified email addresses. Recipients must be added in the Resend dashboard unless a custom domain is verified.

### Emails Sent

| Trigger | Subject | Attachment |
|---|---|---|
| Booking confirmed | `Booking Confirmed — {flightNo} · PNR: {PNR}` | PDF e-ticket |
| 24h before departure | `Reminder: Your Horizon flight {flightNo} departs tomorrow` | None |
| 2h before departure | `Heads up! Your Horizon flight {flightNo} departs in 2 hours` | None |

### Notification Scheduler
```
startNotificationScheduler() in lib/notifications.ts
└── node-cron: "*/15 * * * *"
    └── runNotifications()
        ├── Query CONFIRMED bookings with flights in next 25h
        ├── For each: compute hoursUntil from now
        ├── 23–25h window → send 24h reminder (key: `{bookingId}:24h`)
        └── 1.5–2.5h window → send 2h reminder (key: `{bookingId}:2h`)
```
Dedup set is **in-memory** — restarts will re-send. For production, persist notification state to DB.

---

## 10. Payment Flow

### Payment Order Binding (Anti-Tampering)
1. Frontend selects seat → POST `/api/payments/order` with `{flightId, seatNo}`
2. Server looks up flight + seat → computes `fare = baseFare × cabinMultiplier` → creates `PaymentOrder` record (binds flight+seat+amount+userId)
3. Returns `{orderId, amount[paise], currency, provider}`
4. Frontend cannot manipulate the amount — booking route validates against `PaymentOrder.amount`

### Mock Provider (default — no Razorpay keys)
- Creates `order_mock_{timestamp}_{random}` orderId
- Validation: Luhn check (16-digit), expiry (MM/YY not past), CVV (3 digits), test decline card (ends in `0002`)
- Luhn check duplicated client-side for instant feedback before API call
- Returns `{ok, paymentId, method: "CARD", last4}`

### Razorpay Provider (when keys set)
- Creates real Razorpay order
- Verifies HMAC signature: `HMAC-SHA256(orderId + "|" + paymentId, keySecret)`
- Returns `{ok, paymentId, method: "RAZORPAY", last4: null}`

### Booking Transaction (atomic)
```
prisma.$transaction:
1. seat.updateMany WHERE id=seatId AND status=AVAILABLE → count===0 → 409 (race condition safe)
2. paymentOrder.update → used=true (prevents replay)
3. booking.create (generate unique PNR with retry loop)
4. payment.create (amount in RUPEES)
5. ticket.create
6. flight.update seatsBooked++
7. passenger.update preferences (if provided)
```

---

## 11. Real-time Features

### WebSocket Flight Tracking (OpenSky)
- Server starts `ws` server on the same HTTP port
- Client connects to `/ws` with `?flightNo=HA101`
- Server polls OpenSky Network REST API every 10 seconds: `GET /api/states/all?callsign={flightNo}`
- Returns `{latitude, longitude, altitude, velocity, heading, onGround}` or error
- Client renders Leaflet map with:
  - Origin and destination markers
  - Great-circle arc line
  - Live aircraft marker at current position, rotated to heading
  - Altitude/speed/heading overlay
- No API key needed (anonymous rate limit: 10 req/min)
- Optional: `OPENSKY_USER` + `OPENSKY_PASS` for 100 req/min authenticated

### AviationStack Flight Status
- `GET /api/flight-status/:flightNo` — real-time gate, delay, actual departure time
- Merged with DB record for seating data
- Falls back to DB-only if `AVIATIONSTACK_KEY` not set
- Used in My Bookings "Track Flight" feature

---

## 12. Validation & Exception Handling

### Backend Validation (Zod)
Every mutating route has a Zod schema:
- `registerSchema` — email format, password min 8, fullName required, optional PII fields
- `loginSchema` — email + password
- `searchSchema` — optional origin/destination, date regex `YYYY-MM-DD`, coerce pax to int
- `createBookingSchema` — discriminated union for payment (razorpay proof vs mock card+orderId)
- `createFlightSchema` — requires either originId or originCode (`.refine()`), datetime strings
- All profile/change-password/forgot/reset schemas validated

### Client-side Validation
- Card number: Luhn check (mirrors server), 16 digits
- Card expiry: MM/YY regex + not in past
- CVV: 3 digits
- Form `required` attributes + React state guards
- `isError` guards on all queries before rendering data

### API Error Handling
```typescript
class HttpError extends Error { constructor(status: number, message: string) }
// Thrown anywhere in route handlers
// Caught by central middleware → res.status(err.status).json({ message })
```
Client `ApiError` class mirrors this — `status` + `message` from response body.

### Frontend Error Boundaries
- `isError || !data` guards on every query result before rendering
- Booking page: guard for `!flight.origin || !flight.destination`
- Null-safe optional chaining throughout components
- Toast notifications for mutation errors
- **`ErrorBoundary` class component** wraps entire app — catches unhandled render errors; shows friendly "Go to Homepage" screen instead of blank page; uses inline styles so it renders even if Tailwind CSS bundle fails
- **Smart `QueryClient` retry** in `main.tsx`: no retry on 401/403/404 (`ApiError.status`); one retry on transient errors; mutations never retry; `staleTime: 30s`
- **`MyBookings` ticket sub-query**: `retry: false`; shows loading spinner while fetching ticket; inline error message if ticket fetch fails

---

## 13. Security

| Mechanism | Implementation |
|---|---|
| **Password hashing** | bcryptjs, 10 salt rounds |
| **JWT auth** | HS256, `JWT_SECRET` env var, 7-day expiry; sent as Bearer header + httpOnly cookie |
| **Passport encryption** | AES-256-GCM, key derived from `JWT_SECRET` via SHA-256, random 12-byte IV per encryption, GCM auth tag, stored as `iv:tag:ciphertext` hex |
| **Passport display** | Masked on read (`A****567`) — raw plaintext never returned to client |
| **Route protection** | `requireAuth` middleware + `ProtectedRoute` component; all booking/profile routes require valid JWT |
| **Role-based access** | `requireRole("ADMIN", "STAFF")` on admin routes; `requireRole("ADMIN")` on destructive ops |
| **Ownership checks** | Booking routes verify `booking.passenger.userId === req.user.id` before returning data |
| **Payment anti-tampering** | Server-computed `PaymentOrder` with `used` flag prevents replay and client fare manipulation |
| **CORS** | Explicit origin whitelist (`CLIENT_URL` env + Railway domain) with `credentials: true` |
| **Email enumeration** | `forgot-password` always returns 200 regardless of whether email exists |
| **Password reset tokens** | SHA-256 hash stored (not raw token), 15-minute TTL, single-use (`used: true` after consume) |
| **HTTPS** | Enforced by Railway in production; cookie `secure: true` in production |
| **`.env` never committed** | `.gitignore` enforced; Railway Variables for all production secrets |

---

## 14. UI/UX Design

### Design System: "Art Deco Aviation"
Custom Tailwind CSS theme with:
- **Colour palette:** `sky-darkest` (#0a0f1e) background, `gold` (#b8972a) accents, `cloud` (#e8dfc8) text, `ember` for errors, `jade` for success, `horizon-bright` for info
- **Typography:** `font-heading` (serif) for headings, `font-mono` for PNR/codes, `font-display` italic for taglines
- **CSS classes:** `.card`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.badge`, `.badge-gold/.badge-blue/.badge-gray/.badge-green`, `.input`, `.label`, `.step`, `.flight-card`, `.seat`, `.seat-first`, `.seat-booked`, `.gold-line`

### Responsiveness
- Mobile-first grid layouts with `sm:` breakpoints
- Collapsible navigation, stacked flight card at mobile, full horizontal at desktop
- Seat map scrollable horizontally on small screens

### Accessibility
- `aria-label`, `aria-pressed` on seat buttons
- `title` tooltips on all seats
- `disabled` state on booked seats
- `role` attributes on modals (implicit via `<dialog>`-style divs)

### UX Decisions
- **Step indicator** shows current booking step with ✓ for completed steps
- **Seat summary card** on passenger step shows chosen seat with cabin + position badges
- **Login to Book** on flight cards for unauthenticated users (with redirect-back after login)
- **Fire-and-forget email** — booking confirms instantly, email arrives in background
- **Past flights hidden** — today's search only shows upcoming departures
- **Pre-fill from profile** — passenger form auto-fills name/phone/preferences from stored profile

---

## 15. Testing

### What Exists: Backend Integration Tests (Vitest + Supertest)

| Test File | Coverage |
|---|---|
| `auth.test.ts` | Register (success, duplicate), login (valid, wrong password), /me, profile CRUD, change-password, forgot/reset-password |
| `bookings.test.ts` | Full booking flow (order → book → confirm), duplicate seat prevention, ownership checks |
| `bookings-cancel.test.ts` | Cancel booking, seat released, double-cancel prevention |
| `auth-mw.test.ts` | requireAuth middleware: missing token, invalid token, valid token |
| `admin-crud.test.ts` | Aircraft/employee CRUD, role-based access (403 for non-admin) |
| `flights.test.ts` | Flight search, board, single flight endpoint |
| `payments.test.ts` | Payment order creation, validation |
| `card.test.ts` | Luhn check, expiry validation, CVV, test decline card |
| `fare.test.ts` | Fare forecast rules (rising/stable/dropping based on occupancy) |
| `health.test.ts` | Health endpoint returns `{ok: true}` |
| `nl-search.test.ts` | NL search parsing + flight results |
| `optimizer.test.ts` | Optimizer flags (UNDERBOOKED, NO_CREW, FULL, OK) |
| `rebooking.test.ts` | Rebooking suggestions query |
| `reports.test.ts` | Revenue/flights/bookings report aggregations |
| `scheduling.test.ts` | Crew scheduling logic |
| `serpapi.test.ts` | SerpAPI mock/fallback |
| `storage.test.ts` | S3 put/presign (mocked) |
| `attendance-duty.test.ts` | Attendance and duty report endpoints |

### Test Setup
- `setup.ts` loads `.env.test` — tests run against a real test database (or the same DB with cleanup)
- Tests self-cleanup created records after each test

### What Is NOT Tested
- **Frontend (React):** No component tests, no E2E tests (Cypress/Playwright not set up)
- **Email delivery:** Mailer is not tested (Resend SDK not mocked in tests)
- **WebSocket/real-time:** No WS integration tests
- **PDF generation:** Not directly tested (exercised indirectly via booking)
- **Cron/scheduler:** Not tested in automated suite
- **Full browser flow:** No E2E — all testing is API-level

---

## 16. Optimization

| Optimization | Detail |
|---|---|
| **Batch seeding** | `createMany` with `skipDuplicates` for flights (1,260 base + 140 demo) and seats (100k+) — avoids per-row round trips over Neon; seats chunked in 1000-row batches; seed generates 3 departures per route per day (morning A / afternoon B / evening C) with flight number suffixes |
| **Fire-and-forget email** | `Promise.all(...).then(...).catch(...)` — booking response returned immediately, email sent in background; zero latency impact |
| **IST timezone fix** | Flight search uses `new Date(\`${date}T00:00:00.000+05:30\`)` — seed data stored in IST, search window matches correctly |
| **Today's search lower bound** | For today's date, `departFrom = max(now, dayStart)` — avoids returning already-departed flights |
| **Atomic seat lock** | `seat.updateMany WHERE status=AVAILABLE` returns count; zero count = already booked — prevents TOCTOU race without SELECT FOR UPDATE |
| **PaymentOrder binding** | Avoids extra DB reads during booking; fare pre-computed and stored server-side |
| **TanStack Query staleTime** | Profile cached 60s; flight queries cached 30s — reduces redundant requests during booking flow |
| **Single-process deployment** | Express serves both API + built frontend static files — no separate CDN or Nginx needed on Railway |
| **tsx runtime** | Skips TypeScript compilation step entirely — faster deploys, pre-existing TS errors don't block production |
| **OpenSky anonymous** | No API key required for tracking — works out of box; optional credentials for higher rate limit |

---

## 17. What's Complete vs Incomplete vs Future Scope

### Complete ✓
- Full passenger registration/login/profile/password reset flow
- Classic + NL flight search with round-trip support
- Filter panel: sort (cheapest/fastest/earliest/latest), departure/arrival time slots (IST), max fare slider
- Multi-passenger booking (1–9 pax): seat selection → per-pax forms → payment → one Booking row per passenger
- 3-step booking: seat selection → passenger details → mock payment
- Atomic seat locking (no double-booking, multi-seat race-condition safe)
- Booking confirmation page with ETicket + QR code
- Booking cancellation with seat release
- Confirmation email with PDF e-ticket attachment (Resend)
- Pre-flight reminders (24h + 2h via cron)
- Real-time flight tracking map (OpenSky WebSocket)
- AviationStack flight status integration
- SerpAPI live fares integration (backend only — tab removed from frontend)
- Full admin panel: aircraft, employees, crew, attendance, duty, flights CRUD
- AI optimizer (rule-based flagging)
- AI fare forecast badge
- AI rebooking suggestions
- Revenue/booking/flight analytics reports (Recharts)
- 30 bidirectional Indian routes, 3 departures per route per day, 14 days of flights (1,260 total); extra BLR↔DEL and BLR↔HYD demo data (140 flights)
- Seed script: idempotent, batch inserts (`createMany` + `skipDuplicates`), fully repeatable
- Railway production deployment (auto-deploy on push to main)
- Vitest integration test suite (backend only)
- Comprehensive exception handling: `ErrorBoundary`, smart QueryClient retry, process-level unhandledRejection/uncaughtException, WS error handling, S3 null-on-failure

### Incomplete / Partial ⚠️
- **Password reset email:** Token returned in API response (dev-friendly) but NOT emailed — in production it should be sent via Resend
- **Resend domain verification:** Free tier only delivers to verified addresses — real users won't receive emails until a custom domain is verified
- **S3 PDF storage:** Configured but no S3 credentials in production — PDFs generated in-memory and attached to email only; presigned URL feature inactive
- **Notification dedup:** In-memory set — restarts will re-send 24h/2h reminders
- **Flight status auto-update:** Flights remain `SCHEDULED` status in DB even after departure — no cron to auto-advance status based on time
- **Razorpay:** Keys not in production — mock provider used; real payments not live
- **HELD seat status:** Schema has `HELD` enum value but no hold/release mechanism implemented

### Future Scope
- **Email for password reset** — wire up `forgot-password` to send reset link via Resend
- **Custom Resend domain** — verify a domain so any email address can receive
- **Real Razorpay** — set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in Railway Variables
- **S3 PDF storage** — add AWS credentials; presigned download URLs will auto-activate
- **Persistent notification dedup** — add `NotificationLog` model to track sent reminders in DB
- **Auto-flight-status cron** — advance flight status (SCHEDULED → DEPARTED → ARRIVED) based on `departAt`/`arriveAt`
- **Seat hold/timeout** — temporarily hold seat for 10 minutes during checkout, release if payment not completed
- **Admin booking management** — no admin UI to view/manage all bookings; only self-bookings visible
- **Frontend tests** — Vitest + React Testing Library or Playwright E2E
- **Refund processing** — cancellation marks payment REFUNDED but no actual refund API call to Razorpay
- **Baggage and add-ons** — no ancillary services
- **Check-in flow** — no online check-in, seat upgrade, or boarding pass generation beyond the PDF
- **Multi-language / internationalisation** — English only

---

## 18. Known Gaps / Technical Debt

| Issue | Severity | Notes |
|---|---|---|
| `flightNo` not `@unique` on Flight | Medium | Same flightNo can appear multiple times across dates (intentional, flight number reused daily). Seed appends `-YYYYMMDD-{A/B/C}` suffix. `upsert` by flightNo is not possible — use `findFirst + create`. |
| Pre-existing TypeScript errors in `apps/web` | Low | Leaflet/react-leaflet missing type declarations. `tsx` runtime bypasses `tsc` so they don't block deploys. |
| In-memory notification dedup | Medium | Process restart re-sends notifications. Fix: `NotificationLog` DB table. |
| Password reset not emailed | High | Only suitable for demo. Must wire up Resend before real users. |
| No frontend tests | Medium | No component, unit, or E2E tests. Entire frontend is manually tested. |
| `mail-test` endpoint exposed in production | Low | `/api/health/mail-test` is a debug endpoint with no auth guard — harmless but should be gated. |
| Payment amount currency inconsistency | Low | `provider.createOrder` receives paise, `PaymentOrder.amount` and `Payment.amount` stored in rupees. Comment explains this but it's a footgun. |
| `seatsBooked` counter | Low | Incremented/decremented in transactions but could drift if direct DB manipulation occurs — no DB trigger enforces it. |
| Soft delete not implemented | Low | Flight delete cascades hard-deletes all bookings — no audit trail for deleted flights. |
| Session-only WebSocket | Low | WS connection carries no auth — any client can subscribe to any flight's position. Acceptable for read-only tracking. |
| `notified` set leaks memory | Very Low | Grows indefinitely for a long-running process (bounded by number of bookings × 2). Negligible in practice. |
