/**
 * Seed script for Horizon Airways
 * Run via: npm run seed (in packages/db)
 * Idempotent: safe to run multiple times.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DB_URL = process.env.DATABASE_URL ?? "not-set";
const SALT_ROUNDS = 10;

async function hashPw(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// ── 1. Airports ───────────────────────────────────────────────────────────────

const AIRPORT_DATA = [
  { code: "DEL", name: "Indira Gandhi International Airport", city: "New Delhi",   country: "India" },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai",    country: "India" },
  { code: "BLR", name: "Kempegowda International Airport", city: "Bengaluru",  country: "India" },
  { code: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad",  country: "India" },
  { code: "MAA", name: "Chennai International Airport", city: "Chennai",    country: "India" },
  { code: "CCU", name: "Netaji Subhas Chandra Bose International Airport", city: "Kolkata",    country: "India" },
] as const;

// ── 2. Aircraft ───────────────────────────────────────────────────────────────

const AIRCRAFT_DATA = [
  { registration: "VT-HA001", model: "Boeing 737-800",   capacity: 162 },
  { registration: "VT-HA002", model: "Boeing 737-800",   capacity: 162 },
  { registration: "VT-HA003", model: "Airbus A320neo",   capacity: 150 },
  { registration: "VT-HA004", model: "Airbus A320neo",   capacity: 150 },
  { registration: "VT-HA005", model: "Boeing 777-300ER", capacity: 364 },
  { registration: "VT-HA006", model: "ATR 72-600",       capacity:  70 },
] as const;

// ── 3. Routes → flights ───────────────────────────────────────────────────────

type RouteSpec = {
  flightNoBase: string;
  origin: string;
  dest: string;
  departHour: number;
  durationMin: number;
  baseFare: number;
  aircraftIdx: number; // index into aircraft array
};

const ROUTES: RouteSpec[] = [
  // DEL ↔ BOM
  { flightNoBase: "HA101", origin: "DEL", dest: "BOM", departHour:  6, durationMin: 120, baseFare: 4500, aircraftIdx: 0 },
  { flightNoBase: "HA102", origin: "BOM", dest: "DEL", departHour: 10, durationMin: 120, baseFare: 4500, aircraftIdx: 1 },
  // DEL ↔ BLR
  { flightNoBase: "HA201", origin: "DEL", dest: "BLR", departHour:  7, durationMin: 165, baseFare: 5200, aircraftIdx: 2 },
  { flightNoBase: "HA202", origin: "BLR", dest: "DEL", departHour: 14, durationMin: 165, baseFare: 5200, aircraftIdx: 3 },
  // DEL ↔ MAA
  { flightNoBase: "HA301", origin: "DEL", dest: "MAA", departHour:  8, durationMin: 175, baseFare: 5500, aircraftIdx: 4 },
  { flightNoBase: "HA302", origin: "MAA", dest: "DEL", departHour: 15, durationMin: 175, baseFare: 5500, aircraftIdx: 4 },
  // DEL ↔ HYD
  { flightNoBase: "HA303", origin: "DEL", dest: "HYD", departHour:  9, durationMin: 155, baseFare: 5000, aircraftIdx: 2 },
  { flightNoBase: "HA304", origin: "HYD", dest: "DEL", departHour: 16, durationMin: 155, baseFare: 5000, aircraftIdx: 3 },
  // DEL ↔ CCU
  { flightNoBase: "HA501", origin: "DEL", dest: "CCU", departHour:  7, durationMin: 135, baseFare: 4800, aircraftIdx: 0 },
  { flightNoBase: "HA502", origin: "CCU", dest: "DEL", departHour: 13, durationMin: 135, baseFare: 4800, aircraftIdx: 1 },
  // BOM ↔ BLR
  { flightNoBase: "HA401", origin: "BOM", dest: "BLR", departHour:  9, durationMin:  85, baseFare: 3200, aircraftIdx: 2 },
  { flightNoBase: "HA402", origin: "BLR", dest: "BOM", departHour: 12, durationMin:  85, baseFare: 3200, aircraftIdx: 3 },
  // BOM ↔ HYD
  { flightNoBase: "HA601", origin: "BOM", dest: "HYD", departHour: 11, durationMin:  80, baseFare: 3000, aircraftIdx: 5 },
  { flightNoBase: "HA602", origin: "HYD", dest: "BOM", departHour: 14, durationMin:  80, baseFare: 3000, aircraftIdx: 5 },
  // BOM ↔ MAA
  { flightNoBase: "HA701", origin: "BOM", dest: "MAA", departHour: 10, durationMin: 110, baseFare: 3800, aircraftIdx: 0 },
  { flightNoBase: "HA702", origin: "MAA", dest: "BOM", departHour: 15, durationMin: 110, baseFare: 3800, aircraftIdx: 1 },
  // BOM ↔ CCU
  { flightNoBase: "HA703", origin: "BOM", dest: "CCU", departHour:  8, durationMin: 155, baseFare: 5100, aircraftIdx: 4 },
  { flightNoBase: "HA704", origin: "CCU", dest: "BOM", departHour: 14, durationMin: 155, baseFare: 5100, aircraftIdx: 4 },
  // BLR ↔ HYD
  { flightNoBase: "HA801", origin: "BLR", dest: "HYD", departHour: 11, durationMin:  60, baseFare: 2500, aircraftIdx: 5 },
  { flightNoBase: "HA802", origin: "HYD", dest: "BLR", departHour: 13, durationMin:  60, baseFare: 2500, aircraftIdx: 5 },
  // BLR ↔ MAA
  { flightNoBase: "HA803", origin: "BLR", dest: "MAA", departHour:  7, durationMin:  65, baseFare: 2600, aircraftIdx: 5 },
  { flightNoBase: "HA804", origin: "MAA", dest: "BLR", departHour: 10, durationMin:  65, baseFare: 2600, aircraftIdx: 5 },
  // BLR ↔ CCU
  { flightNoBase: "HA805", origin: "BLR", dest: "CCU", departHour:  9, durationMin: 190, baseFare: 5800, aircraftIdx: 2 },
  { flightNoBase: "HA806", origin: "CCU", dest: "BLR", departHour: 16, durationMin: 190, baseFare: 5800, aircraftIdx: 3 },
  // HYD ↔ MAA
  { flightNoBase: "HA901", origin: "HYD", dest: "MAA", departHour:  8, durationMin:  70, baseFare: 2800, aircraftIdx: 5 },
  { flightNoBase: "HA902", origin: "MAA", dest: "HYD", departHour: 11, durationMin:  70, baseFare: 2800, aircraftIdx: 5 },
  // HYD ↔ CCU
  { flightNoBase: "HA903", origin: "HYD", dest: "CCU", departHour: 10, durationMin: 170, baseFare: 5300, aircraftIdx: 0 },
  { flightNoBase: "HA904", origin: "CCU", dest: "HYD", departHour: 15, durationMin: 170, baseFare: 5300, aircraftIdx: 1 },
  // MAA ↔ CCU
  { flightNoBase: "HA905", origin: "MAA", dest: "CCU", departHour:  9, durationMin: 150, baseFare: 4900, aircraftIdx: 4 },
  { flightNoBase: "HA906", origin: "CCU", dest: "MAA", departHour: 14, durationMin: 150, baseFare: 4900, aircraftIdx: 4 },
];

// ── 4. Employees ──────────────────────────────────────────────────────────────

const EMPLOYEE_DATA = [
  { empCode: "EMP001", fullName: "Rahul Sharma",    designation: "Pilot",          dutyArea: "Flight Deck", salary: 150000 },
  { empCode: "EMP002", fullName: "Priya Nair",      designation: "Co-Pilot",       dutyArea: "Flight Deck", salary: 110000 },
  { empCode: "EMP003", fullName: "Anita Kapoor",    designation: "Cabin Crew",     dutyArea: "Cabin",       salary:  55000 },
  { empCode: "EMP004", fullName: "Suresh Menon",    designation: "Cabin Crew",     dutyArea: "Cabin",       salary:  55000 },
  { empCode: "EMP005", fullName: "Deepa Reddy",     designation: "Cabin Crew",     dutyArea: "Cabin",       salary:  55000 },
  { empCode: "EMP006", fullName: "Vikram Singh",    designation: "Pilot",          dutyArea: "Flight Deck", salary: 145000 },
  { empCode: "EMP007", fullName: "Meena Pillai",    designation: "Co-Pilot",       dutyArea: "Flight Deck", salary: 108000 },
  { empCode: "EMP008", fullName: "Arun Kumar",      designation: "Ground Staff",   dutyArea: "Terminal",    salary:  40000 },
  { empCode: "EMP009", fullName: "Lakshmi Iyer",    designation: "Ground Staff",   dutyArea: "Terminal",    salary:  40000 },
  { empCode: "EMP010", fullName: "Kiran Joshi",     designation: "Technician",     dutyArea: "Maintenance", salary:  65000 },
  { empCode: "EMP011", fullName: "Sanjay Patel",    designation: "Cabin Crew",     dutyArea: "Cabin",       salary:  55000 },
  { empCode: "EMP012", fullName: "Ritu Bose",       designation: "Operations Mgr", dutyArea: "Operations",  salary:  90000 },
];

// Generate seat numbers: rows 1-N (based on capacity ÷ 6), cols A-F
// Row 1 → FIRST, rows 2–3 → BUSINESS, rows 4+ → ECONOMY (#1 cabinClass integration)
function generateSeatNos(capacity: number): Array<{ seatNo: string; cabinClass: string }> {
  const cols = ["A", "B", "C", "D", "E", "F"] as const;
  const rows = Math.ceil(capacity / 6);
  const seats: Array<{ seatNo: string; cabinClass: string }> = [];
  for (let r = 1; r <= rows; r++) {
    const cabinClass = r === 1 ? "FIRST" : r <= 3 ? "BUSINESS" : "ECONOMY";
    for (const col of cols) {
      seats.push({ seatNo: `${r}${col}`, cabinClass });
    }
  }
  return seats;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting Horizon Airways seed…");
  const pw = await hashPw("Passw0rd!");

  // ── Users: admin + demo ──────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@horizon.air" },
    update: {},
    create: { email: "admin@horizon.air", passwordHash: pw, role: "ADMIN" },
  });

  // Admin also gets an Employee record (no userId link mandatory by schema, but link it)
  await prisma.employee.upsert({
    where: { empCode: "EMP000" },
    update: {},
    create: {
      empCode: "EMP000",
      fullName: "System Administrator",
      designation: "Administrator",
      dutyArea: "Administration",
      salary: 0,
      userId: adminUser.id,
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@horizon.air" },
    update: {},
    create: { email: "demo@horizon.air", passwordHash: pw, role: "PASSENGER" },
  });

  await prisma.passenger.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      fullName: "Demo Passenger",
      phone: "+91-9000000000",
      preferences: { meal: "vegetarian", seat: "window" },
    },
  });

  // ── Airports ─────────────────────────────────────────────────────────────
  for (const ap of AIRPORT_DATA) {
    await prisma.airport.upsert({
      where: { code: ap.code },
      update: {},
      create: { ...ap },
    });
  }

  // ── Aircraft ──────────────────────────────────────────────────────────────
  for (const ac of AIRCRAFT_DATA) {
    await prisma.aircraft.upsert({
      where: { registration: ac.registration },
      update: {},
      create: { ...ac, status: "ACTIVE" },
    });
  }

  // ── Employees ─────────────────────────────────────────────────────────────
  for (const emp of EMPLOYEE_DATA) {
    await prisma.employee.upsert({
      where: { empCode: emp.empCode },
      update: {},
      create: {
        empCode: emp.empCode,
        fullName: emp.fullName,
        designation: emp.designation,
        dutyArea: emp.dutyArea,
        salary: emp.salary,
        contact: `+91-800000${emp.empCode.slice(-3)}`,
      },
    });
  }

  // ── Flights + Seats ───────────────────────────────────────────────────────
  // Generate flights for the next 14 days (2 repetitions per route ≈ 24 flights)
  const airports = await prisma.airport.findMany();
  const aircraft = await prisma.aircraft.findMany();
  const airportByCode = Object.fromEntries(airports.map((a) => [a.code, a]));
  const aircraftList = aircraft.sort((a, b) =>
    a.registration.localeCompare(b.registration)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Every route runs every day for the next 14 days
  const flightSchedule: Array<{ route: RouteSpec; dayOffset: number }> = [];
  for (const route of ROUTES) {
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      flightSchedule.push({ route, dayOffset });
    }
  }

  // Collect employees for crew rotation
  const allEmployees = await prisma.employee.findMany();
  const pilots = allEmployees.filter((e) => e.designation === "Pilot");
  const coPilots = allEmployees.filter((e) => e.designation === "Co-Pilot");
  const cabinCrew = allEmployees.filter((e) => e.designation === "Cabin Crew");

  // Build all desired flights in memory
  type FlightSpec = {
    flightNo: string; originId: string; destinationId: string; aircraftId: string;
    departAt: Date; arriveAt: Date; baseFare: number; capacity: number;
    aircraftIdx: number; dayOffset: number;
  };
  const desired: FlightSpec[] = [];
  for (const { route, dayOffset } of flightSchedule) {
    const originAp = airportByCode[route.origin];
    const destAp = airportByCode[route.dest];
    const ac = aircraftList[route.aircraftIdx % aircraftList.length];
    if (!originAp || !destAp || !ac) continue;
    const departAt = new Date(today);
    departAt.setDate(today.getDate() + dayOffset);
    departAt.setHours(route.departHour, 0, 0, 0);
    const arriveAt = new Date(departAt.getTime() + route.durationMin * 60 * 1000);
    const dateStr = departAt.toISOString().slice(0, 10).replace(/-/g, "");
    desired.push({
      flightNo: `${route.flightNoBase}-${dateStr}`,
      originId: originAp.id, destinationId: destAp.id, aircraftId: ac.id,
      departAt, arriveAt, baseFare: route.baseFare, capacity: ac.capacity,
      aircraftIdx: route.aircraftIdx, dayOffset,
    });
  }

  // Fetch all existing flight numbers in one query
  const existingFlightNos = new Set(
    (await prisma.flight.findMany({ select: { flightNo: true } })).map((f) => f.flightNo)
  );

  // Batch-create new flights
  const newFlights = desired.filter((f) => !existingFlightNos.has(f.flightNo));
  if (newFlights.length > 0) {
    await prisma.flight.createMany({
      data: newFlights.map(({ flightNo, originId, destinationId, aircraftId, departAt, arriveAt, baseFare, capacity }) => ({
        flightNo, originId, destinationId, aircraftId, departAt, arriveAt, baseFare, capacity, status: "SCHEDULED",
      })),
      skipDuplicates: true,
    });
  }
  const flightCount = newFlights.length;

  // Fetch all flights (new + existing) to get their IDs
  const allFlights = await prisma.flight.findMany({ select: { id: true, flightNo: true, capacity: true } });
  const flightByNo = Object.fromEntries(allFlights.map((f) => [f.flightNo, f]));

  // Batch-create seats for all flights that have none
  const flightsWithSeats = new Set(
    (await prisma.seat.findMany({ select: { flightId: true }, distinct: ["flightId"] })).map((s) => s.flightId)
  );
  let seatCount = 0;
  const allSeats: Array<{ flightId: string; seatNo: string; cabinClass: string; status: "AVAILABLE" }> = [];
  for (const spec of desired) {
    const flight = flightByNo[spec.flightNo];
    if (!flight || flightsWithSeats.has(flight.id)) continue;
    for (const { seatNo, cabinClass } of generateSeatNos(flight.capacity)) {
      allSeats.push({ flightId: flight.id, seatNo, cabinClass, status: "AVAILABLE" });
    }
  }
  // Insert seats in chunks of 1000
  for (let i = 0; i < allSeats.length; i += 1000) {
    const chunk = allSeats.slice(i, i + 1000);
    const r = await prisma.seat.createMany({ data: chunk, skipDuplicates: true });
    seatCount += r.count;
  }

  // Batch-create crew assignments
  const allCrew: Array<{ flightId: string; employeeId: string; role: string }> = [];
  for (const spec of desired) {
    const flight = flightByNo[spec.flightNo];
    if (!flight) continue;
    const crew = [
      { emp: pilots[spec.dayOffset % pilots.length], role: "PILOT" },
      { emp: coPilots[spec.dayOffset % coPilots.length], role: "CO_PILOT" },
      { emp: cabinCrew[spec.dayOffset % cabinCrew.length], role: "CABIN_CREW" },
      { emp: cabinCrew[(spec.dayOffset + 1) % cabinCrew.length], role: "CABIN_CREW" },
    ];
    for (const { emp, role } of crew) {
      if (emp) allCrew.push({ flightId: flight.id, employeeId: emp.id, role });
    }
  }
  const crewResult = await prisma.crewAssignment.createMany({ data: allCrew, skipDuplicates: true });
  const crewCount = crewResult.count;

  // ── Final counts ──────────────────────────────────────────────────────────
  const counts = {
    users:      await prisma.user.count(),
    passengers: await prisma.passenger.count(),
    employees:  await prisma.employee.count(),
    airports:   await prisma.airport.count(),
    aircraft:   await prisma.aircraft.count(),
    flights:    await prisma.flight.count(),
    seats:      await prisma.seat.count(),
    crew:       await prisma.crewAssignment.count(),
  };

  console.log("\nSeed complete. Row counts:");
  console.table(counts);
  console.log(`  New flights created this run : ${flightCount}`);
  console.log(`  New seats created this run   : ${seatCount}`);
  console.log(`  Crew assignments this run    : ${crewCount}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
