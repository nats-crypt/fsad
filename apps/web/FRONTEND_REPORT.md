# Horizon Airways — Frontend Report (Phase 6)

## What Was Built

A complete, production-grade React SPA for the Horizon Airways airlines reservation system.

### Stack
- **Vite 6** + **React 18** + **TypeScript 5.6** (strict)
- **Tailwind CSS 3** (custom design tokens, dark mode via `class`)
- **React Router 6** (nested routes, browser history)
- **TanStack Query v5** (server state, caching, optimistic updates)
- **Recharts 2** (reports dashboard charts)
- **Lucide React** (icon system)
- **react-to-print** (boarding pass print/PDF)

### File structure
```
apps/web/
├── index.html              — HTML shell with Google Fonts CDN
├── vite.config.ts          — /api proxy → localhost:4000
├── tsconfig.json           — extends tsconfig.base.json, vite/client types
├── tailwind.config.ts      — full custom design token set
├── postcss.config.js
└── src/
    ├── main.tsx             — QueryClient + AuthProvider + ToastProvider
    ├── App.tsx              — Navbar + Footer shell (hidden in /admin)
    ├── router.tsx           — Full route tree with ProtectedRoute
    ├── index.css            — Meridian Blue design system (CSS layer)
    ├── types/index.ts       — All domain types (Flight, Booking, etc.)
    ├── lib/
    │   ├── api.ts           — Fetch wrapper + Bearer token + Luhn/card utils
    │   ├── auth.tsx         — AuthContext (login/register/logout/refreshUser)
    │   └── utils.ts         — formatCurrency, formatDate, downloadCSV, cn()
    ├── components/
    │   ├── Navbar.tsx        — Responsive navbar with user menu, scroll state
    │   ├── ProtectedRoute.tsx — Role-gated redirect to /login
    │   ├── Toast.tsx         — Toast context + animated notification stack
    │   ├── ThemeToggle.tsx   — Dark/light mode toggle with localStorage
    │   ├── FlightCard.tsx    — Expandable flight card with FareBadge
    │   ├── FareBadge.tsx     — AI fare forecast badge (BOOK_NOW/Price Dropping)
    │   ├── SeatMap.tsx       — Visual seat map (First/Business/Economy + aisle)
    │   ├── ETicket.tsx       — Boarding-pass e-ticket with QR, print, PDF
    │   ├── DataTable.tsx     — Generic sortable/paginated/searchable table
    │   ├── CrudModal.tsx     — Reusable CRUD modal with error state
    │   ├── ReportChart.tsx   — Recharts bar/line/area wrappers
    │   └── RebookingSuggestions.tsx — AI rebooking alternatives panel
    └── pages/
        ├── Landing.tsx       — Hero, NL/classic search, featured routes, CTA
        ├── Login.tsx         — Auth form with demo credentials hint
        ├── Register.tsx      — Registration + password strength checker
        ├── Search.tsx        — Classic + NL flight search with filter chips
        ├── Booking.tsx       — 3-step: Seat Map → Passenger → Payment
        ├── Confirmation.tsx  — PNR confirmation + ETicket
        ├── MyBookings.tsx    — Booking list, ticket view, cancel + rebooking
        └── admin/
            ├── AdminLayout.tsx    — Sidebar navigation layout
            ├── AdminDashboard.tsx — Stat cards + quick action links
            ├── AircraftAdmin.tsx  — Full CRUD with DataTable + CrudModal
            ├── EmployeesAdmin.tsx — Full CRUD with salary, designation, etc.
            ├── FlightsAdmin.tsx   — Schedule + manage flights
            ├── CrewAdmin.tsx      — Assign crew to flights, filter by flight
            ├── Attendance.tsx     — Mark check-in/out + history with filters
            ├── Duty.tsx           — Start/end duty reports
            ├── Optimizer.tsx      — AI optimizer table (flags + load factor)
            └── Reports.tsx        — Type + date range → Recharts + CSV export
```

---

## Design System Summary — "Meridian Blue"

**Aesthetic direction:** Refined luxury aviation — Art Deco geometric patterns meet modern fintech. Inspired by the golden age of TWA meets contemporary SaaS.

### Typography (3-font stack)
| Role | Font | Characteristic |
|------|------|----------------|
| Display/hero | Cormorant Garamond | Elegant serif, italic, luxury |
| Headings/UI | Barlow Condensed | Geometric, aerospace, uppercase |
| Body/data | Plus Jakarta Sans | Clean, modern, readable |
| Monospace | JetBrains Mono | Flight codes, PNRs, prices |

### Colour Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--sky-dark` | `#070F22` | Page backgrounds |
| `--sky` | `#0A1628` | Cards, components |
| `--horizon` | `#1E5F8A` | Interactive blue |
| `--gold` | `#C9A040` | Primary accent, CTAs |
| `--gold-light` | `#E8C87A` | Hover states |
| `--cloud` | `#F0F4F8` | Primary text |
| `--runway` | `#8B9BB4` | Secondary text, borders |
| `--ember` | `#E84545` | Errors, cancel actions |
| `--jade` | `#27AE60` | Success, confirmed states |

### Key visual treatments
- **Glassmorphism cards**: `backdrop-filter: blur(16px)` with semi-transparent dark backgrounds
- **Hero section**: Radial gradient mesh + floating gold particles + geometric arc outlines
- **Art Deco geometry**: Rotating circles, diagonal horizon lines, compass-rose arcs
- **Typography shimmer**: Gold gradient animation on hero headline
- **Stagger-reveal**: CSS animation with `animation-delay` increments for lists
- **Gold accent lines**: Gradient dividers (`from-transparent via-gold/60 to-transparent`)
- **Seat map**: Custom grid layout with aircraft nose/tail decoration, cabin-class color coding

---

## Build & Typecheck Output

```
> @horizon/web@0.1.0 typecheck
> tsc --noEmit

(exit 0 — zero errors)

> @horizon/web@0.1.0 build
> tsc --noEmit && vite build

vite v6.4.6 building for production...
✓ 2075 modules transformed.
dist/index.html                   1.06 kB │ gzip:   0.55 kB
dist/assets/index-Lpq9-E9N.css   55.75 kB │ gzip:   8.52 kB
dist/assets/index-DuBDpWSh.js   833.70 kB │ gzip: 230.45 kB
✓ built in 9.94s
```

> Note: The 833 kB JS bundle is a warning, not an error. It's caused by recharts + react-dom in a single chunk. Code splitting via `rollupOptions.manualChunks` would reduce this in a follow-up.

---

## API Contract Assumptions & Integration Notes

### Auth
- Expects `POST /api/auth/login` and `/register` to return `{ token: string, user: { id, email, role } }`.
- `GET /api/auth/me` must return `{ user: {...} }`.
- Bearer token sent as `Authorization: Bearer <token>` on every request; httpOnly cookie sent via `credentials: 'include'`.

### Flights / Search
- `GET /api/flights` returns `Flight[]` where `seatsLeft` is computed server-side.
- `GET /api/flights/:id` must include `seats: Seat[]` for the seat map (cabinClass on each seat).
- `POST /api/ai/search { text }` must return `{ parsed: ParsedSearch, flights: Flight[] }`.

### Payments
- `POST /api/payments/order` returns `{ orderId, amount, currency, keyId?, provider: 'razorpay'|'mock' }`.
- Amount in paise (smallest unit) for Razorpay; divides by 100 for display.
- Mock provider: card form with Luhn validation; passes `{ orderId, card: { number, expiry, cvv } }` to `POST /api/bookings`.
- Razorpay provider: loads `checkout.razorpay.com/v1/checkout.js` dynamically and passes `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`.

### Bookings
- `POST /api/bookings` returns `{ id, pnr }`.
- `GET /api/bookings/mine` returns `Booking[]` with nested `flight.origin`, `flight.destination`, `flight.flightNo`, `flight.departAt/arriveAt`, `seat.seatNo`, `seat.cabinClass`.
- `GET /api/bookings/:id/ticket` returns `{ ticket: {...}, pdfUrl?: string }` where ticket has nested `flight`, `seat`, `passenger`.
- Cancel: `POST /api/bookings/:id/cancel`.

### Admin
- `/api/aircraft`, `/api/employees` standard REST CRUD.
- `/api/flights` admin write endpoints accept `originCode`/`destinationCode` as IATA strings (not IDs) — backend should resolve airports.
- `/api/crew` accepts `{ flightId, employeeId, role }` and returns assignments with nested `employee` and `flight`.
- `/api/attendance/mark` accepts `{ employeeId, type: 'IN'|'OUT' }`.
- `/api/reports/:type?from&to` returns `{ summary: Record<string, unknown>, series: { label, value }[] }`.
- Optimizer: `GET /api/ai/optimizer` returns `OptimizerResult[]` with `predictedLoadFactor` as 0–1 float.

### Gaps / Follow-up
1. **Seat map cabin classes**: Backend must populate `cabinClass` on `Seat` records ('FIRST', 'BUSINESS', 'ECONOMY') for the visual map to work correctly.
2. **Booking passenger info**: `GET /api/bookings/mine` should include `passenger.fullName` for the UI cards.
3. **Ticket route nesting**: The confirmation page hits `/api/bookings/:id/ticket`, not `/api/tickets/:id` — confirm routing in express.
4. **Fare forecast**: `GET /api/ai/fare-forecast/:flightId` — if unavailable the FareBadge silently renders nothing (`retry: false`).
5. **Bundle splitting**: Recharts + vendor could be split to reduce initial load.
6. **QR code**: ETicket uses `api.qrserver.com` as a free placeholder — replace with a self-hosted or server-rendered QR in production.

---

Generated by Horizon Airways Frontend Agent · 2026-11-21
