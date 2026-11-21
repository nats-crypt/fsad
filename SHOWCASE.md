# ✈️ Horizon Airways — Full-Stack Airline Reservation & Operations System

A complete airline platform: passengers search, book, pay for, and manage flights; staff run
operations (scheduling, crew, attendance, reports) — with **4 AI features** and **real-time
flight data**. Built as a TypeScript monorepo.

**Repo:** https://github.com/nats-crypt/fsad

---

## ✨ Highlights

**For passengers**
- 🔎 **Smart flight search** — classic filters **and** natural-language ("cheap morning flight to Delhi next Friday")
- 💺 **Visual seat map** with First / Business / Economy classes
- 💳 **Checkout** — Razorpay (test mode) with a mock-gateway fallback (16-digit Luhn validation)
- 🎫 **Boarding-pass e-ticket** — printable + downloadable, stored in S3
- 📋 **My Bookings** — cancel anytime with **AI rebooking suggestions**
- 🌍 **Live Fares** — real-time Google Flights prices (via SerpApi), with a rich DB fallback

**For staff / admin**
- 🛩️ Aircraft & employee management, flight & crew scheduling
- 🕐 Attendance + duty reporting
- 🤖 **AI Demand & Crew Optimizer** — predicts load factor, flags over/under-crewed flights
- 📊 **Reports dashboard** — revenue, reservations, cancellations, salary, performance (charts + CSV)

## 🧠 The 4 AI features
1. **Natural-language flight search** — free text → a real structured query
2. **Demand & crew optimizer** — load-factor prediction + crew/aircraft recommendations
3. **Fare forecast** — rising / steady / falling + book-now vs wait advice
4. **Smart rebooking** — ranked alternatives when a flight is cancelled

> AI runs on offline heuristics by default and upgrades to an LLM (NVIDIA `kimi-k3.1-pro`,
> OpenAI-compatible) when a key is present — with graceful fallback either way.

## 🛠️ Tech stack
- **Frontend:** React + TypeScript (Vite), Tailwind, TanStack Query, Recharts — a custom
  "Meridian Blue" aviation design system (animated hero, glass cards, responsive)
- **Backend:** Express + TypeScript, Prisma ORM, JWT auth, Zod validation
- **Database:** PostgreSQL (local Docker for dev; Neon serverless ready)
- **Integrations:** S3-compatible object storage (e-tickets), Razorpay (payments),
  SerpApi Google Flights (live data), NVIDIA LLM (AI)
- **Tests:** 103 backend tests (Vitest + Supertest), all green ✅

## 🚀 Run it locally
```bash
git clone https://github.com/nats-crypt/fsad && cd fsad
npm install
docker run -d --name horizon-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=horizon -p 5432:5432 postgres:16-alpine
cp .env.example .env            # fill in keys (or leave blank — sensible fallbacks)
npm run db:generate && npm run db:migrate && npm run db:seed
npm run db:demo                 # rich demo data: flights, bookings, attendance, reports
npm run dev                     # UI http://localhost:5173  +  API http://localhost:4000
```

**Demo logins** (password `Passw0rd!`):
- Admin — `admin@horizon.air`
- Passenger — `demo@horizon.air`

## 📈 What's inside the demo data
336 flights across 6 Indian metros (next 2 weeks), 459 bookings, ₹27L+ revenue,
130 attendance records, crew assignments, duty logs — so every screen and report is alive.

---
*Built with a spec → plan → test-driven, reviewed implementation across auth, booking,
admin, AI, and a polished React UI.*
