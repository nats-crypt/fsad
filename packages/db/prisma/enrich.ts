// Demo-data enrichment: adds daily flights on major routes + bookings, payments,
// attendance and duty records so every screen/report is populated. Idempotent-ish:
// skips flights whose flightNo already exists. Run: npm run db:demo
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// 12 directed major routes, with 2 daily departure slots (morning + evening)
const ROUTES: [string, string][] = [
  ["DEL", "BOM"], ["BOM", "DEL"], ["DEL", "BLR"], ["BLR", "DEL"],
  ["DEL", "HYD"], ["HYD", "DEL"], ["DEL", "MAA"], ["MAA", "DEL"],
  ["DEL", "CCU"], ["BOM", "BLR"], ["BLR", "BOM"], ["BOM", "HYD"],
];
const SLOTS = [
  { h: 7, m: 30, dur: 135 },   // morning
  { h: 18, m: 15, dur: 140 },  // evening
];
const DAYS = 14;

function seatsForCapacity(cap: number) {
  // rows of 6 (A-F). row1 FIRST, rows2-3 BUSINESS, rest ECONOMY
  const cols = ["A", "B", "C", "D", "E", "F"];
  const rows = Math.ceil(cap / 6);
  const seats: { seatNo: string; cabinClass: string }[] = [];
  for (let r = 1; r <= rows; r++) {
    for (const c of cols) {
      if (seats.length >= cap) break;
      const cabinClass = r === 1 ? "FIRST" : r <= 3 ? "BUSINESS" : "ECONOMY";
      seats.push({ seatNo: `${r}${c}`, cabinClass });
    }
  }
  return seats;
}

async function main() {
  const airports = await prisma.airport.findMany();
  const byCode = Object.fromEntries(airports.map((a) => [a.code, a]));
  const aircraft = await prisma.aircraft.findMany();
  const employees = await prisma.employee.findMany();
  if (!airports.length || !aircraft.length) throw new Error("Run base seed first (npm run db:seed).");

  // --- 1. Flights (daily, both slots, next 14 days) ---
  const CAP = 60;
  let flightsCreated = 0, seatsCreated = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (let d = 0; d < DAYS; d++) {
    const day = new Date(today.getTime() + d * 86400000);
    for (let ri = 0; ri < ROUTES.length; ri++) {
      const [o, dest] = ROUTES[ri];
      for (let si = 0; si < SLOTS.length; si++) {
        const slot = SLOTS[si];
        const flightNo = `HA${200 + ri}${si}-${ymd(day)}`;
        const existing = await prisma.flight.findFirst({ where: { flightNo } });
        if (existing) continue;
        const depart = new Date(day); depart.setHours(slot.h, slot.m, 0, 0);
        const arrive = new Date(depart.getTime() + slot.dur * 60000);
        const ac = pick(aircraft);
        const baseFare = rand(30, 95) * 100; // ₹3000–9500
        const flight = await prisma.flight.create({
          data: {
            flightNo, originId: byCode[o].id, destinationId: byCode[dest].id,
            aircraftId: ac.id, departAt: depart, arriveAt: arrive,
            baseFare, capacity: CAP, seatsBooked: 0, status: "SCHEDULED",
          },
        });
        await prisma.seat.createMany({
          data: seatsForCapacity(CAP).map((s) => ({ ...s, flightId: flight.id, status: "AVAILABLE" })),
        });
        flightsCreated++; seatsCreated += CAP;
      }
    }
  }

  // --- 2. Synthetic passengers (for varied bookings) ---
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.default.hash("Passw0rd!", 10);
  const names = ["Aarav Sharma", "Diya Patel", "Vihaan Rao", "Ananya Iyer", "Kabir Nair", "Myra Gupta", "Arjun Menon", "Sara Khan"];
  const paxIds: string[] = [];
  const demo = await prisma.passenger.findFirst({ where: { user: { email: "demo@horizon.air" } } });
  if (demo) paxIds.push(demo.id);
  for (let i = 0; i < names.length; i++) {
    const email = `pax${i}@horizon.air`;
    let u = await prisma.user.findUnique({ where: { email } });
    if (!u) u = await prisma.user.create({ data: { email, passwordHash: hash, role: "PASSENGER" } });
    let p = await prisma.passenger.findFirst({ where: { userId: u.id } });
    if (!p) p = await prisma.passenger.create({ data: { userId: u.id, fullName: names[i], phone: `9${rand(100000000, 999999999)}` } });
    paxIds.push(p.id);
  }

  // --- 3. Bookings + payments (future flights, ~15% cancelled) ---
  const futureFlights = await prisma.flight.findMany({
    where: { departAt: { gte: today } }, include: { seats: true }, take: 120,
  });
  let bookings = 0, cancelled = 0, revenue = 0;
  const genPnr = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[rand(0, 31)]).join("");
  for (const f of futureFlights) {
    const avail = f.seats.filter((s) => s.status === "AVAILABLE");
    const n = Math.min(rand(2, 7), avail.length);
    for (let k = 0; k < n; k++) {
      const seat = avail[k];
      const isCancelled = Math.random() < 0.15;
      const fare = Number(f.baseFare);
      try {
        const bk = await prisma.booking.create({
          data: {
            pnr: genPnr(), passengerId: pick(paxIds), flightId: f.id, seatId: seat.id,
            farePaid: fare, status: isCancelled ? "CANCELLED" : "CONFIRMED",
            cancelledAt: isCancelled ? new Date() : null,
            payment: { create: { amount: fare, cardLast4: "4242", status: isCancelled ? "REFUNDED" : "PAID", method: "CARD" } },
            ticket: { create: {} },
          },
        });
        if (!isCancelled) {
          await prisma.seat.update({ where: { id: seat.id }, data: { status: "BOOKED" } });
          revenue += fare; bookings++;
        } else { cancelled++; }
        void bk;
      } catch { /* seat race / unique – skip */ }
    }
    const booked = await prisma.seat.count({ where: { flightId: f.id, status: "BOOKED" } });
    await prisma.flight.update({ where: { id: f.id }, data: { seatsBooked: booked } });
  }

  // --- 4. Attendance (past 14 days, weekdays) ---
  let att = 0;
  for (const e of employees) {
    for (let d = 1; d <= 14; d++) {
      const day = new Date(today.getTime() - d * 86400000);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const roll = Math.random();
      const status = roll < 0.08 ? "ABSENT" : roll < 0.18 ? "LATE" : "PRESENT";
      const ci = new Date(day); ci.setHours(status === "LATE" ? 10 : 9, rand(0, 55), 0, 0);
      const co = new Date(day); co.setHours(18, rand(0, 55), 0, 0);
      try {
        await prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: e.id, date: day } },
          update: {},
          create: { employeeId: e.id, date: day, checkIn: status === "ABSENT" ? null : ci, checkOut: status === "ABSENT" ? null : co, status },
        });
        att++;
      } catch { /* skip */ }
    }
  }

  // --- 5. Duty reports ---
  let duty = 0;
  const areas = ["Check-in Counter A", "Gate 14", "Baggage", "Ramp", "Operations Control", "Boarding Gate 22"];
  for (const e of employees) {
    for (let d = 1; d <= 3; d++) {
      const day = new Date(today.getTime() - d * 86400000);
      const start = new Date(day); start.setHours(8, 0, 0, 0);
      const end = new Date(day); end.setHours(16, 0, 0, 0);
      await prisma.dutyReport.create({ data: { employeeId: e.id, dutyArea: pick(areas), startAt: start, endAt: end } });
      duty++;
    }
  }

  console.log("Demo data added:");
  console.table({
    flightsCreated, seatsCreated, bookings, cancelled,
    revenue: `₹${revenue.toLocaleString("en-IN")}`, attendance: att, dutyReports: duty,
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
