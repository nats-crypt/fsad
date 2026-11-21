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
  { flightNoBase: "HA101", origin: "DEL", dest: "BOM", departHour:  6, durationMin: 120, baseFare: 4500, aircraftIdx: 0 },
  { flightNoBase: "HA102", origin: "BOM", dest: "DEL", departHour: 10, durationMin: 120, baseFare: 4500, aircraftIdx: 1 },
  { flightNoBase: "HA201", origin: "DEL", dest: "BLR", departHour:  7, durationMin: 165, baseFare: 5200, aircraftIdx: 2 },
  { flightNoBase: "HA202", origin: "BLR", dest: "DEL", departHour: 14, durationMin: 165, baseFare: 5200, aircraftIdx: 3 },
  { flightNoBase: "HA301", origin: "DEL", dest: "MAA", departHour:  8, durationMin: 175, baseFare: 5500, aircraftIdx: 4 },
  { flightNoBase: "HA302", origin: "MAA", dest: "DEL", departHour: 15, durationMin: 175, baseFare: 5500, aircraftIdx: 4 },
  { flightNoBase: "HA401", origin: "BOM", dest: "BLR", departHour:  9, durationMin:  85, baseFare: 3200, aircraftIdx: 2 },
  { flightNoBase: "HA402", origin: "BLR", dest: "BOM", departHour: 12, durationMin:  85, baseFare: 3200, aircraftIdx: 3 },
  { flightNoBase: "HA501", origin: "DEL", dest: "CCU", departHour:  7, durationMin: 135, baseFare: 4800, aircraftIdx: 0 },
  { flightNoBase: "HA502", origin: "CCU", dest: "DEL", departHour: 13, durationMin: 135, baseFare: 4800, aircraftIdx: 1 },
  { flightNoBase: "HA601", origin: "BOM", dest: "HYD", departHour: 11, durationMin:  80, baseFare: 3000, aircraftIdx: 5 },
  { flightNoBase: "HA602", origin: "HYD", dest: "BOM", departHour: 14, durationMin:  80, baseFare: 3000, aircraftIdx: 5 },
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
function generateSeatNos(capacity: number): Array<{ seatNo: string; cabinClass: string }> {
  const cols = ["A", "B", "C", "D", "E", "F"] as const;
  const rows = Math.ceil(capacity / 6);
  const seats: Array<{ seatNo: string; cabinClass: string }> = [];
  for (let r = 1; r <= rows; r++) {
    for (const col of cols) {
      const cabinClass = r <= Math.ceil(rows * 0.15) ? "BUSINESS" : "ECONOMY";
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

  // Days 1-7 and 8-14 → each route runs twice (once per week)
  const dayOffsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  // Assign routes to days: stagger so each route runs on 2 different days
  const flightSchedule: Array<{ route: RouteSpec; dayOffset: number }> = [];
  for (const route of ROUTES) {
    // Each route gets 2 occurrences ~7 days apart
    const baseDay = (ROUTES.indexOf(route) % 7) + 1;
    flightSchedule.push({ route, dayOffset: baseDay });
    flightSchedule.push({ route, dayOffset: baseDay + 7 });
  }

  let flightCount = 0;
  let seatCount = 0;
  let crewCount = 0;

  // Collect employees for crew rotation
  const allEmployees = await prisma.employee.findMany();
  const pilots = allEmployees.filter((e) => e.designation === "Pilot");
  const coPilots = allEmployees.filter((e) => e.designation === "Co-Pilot");
  const cabinCrew = allEmployees.filter((e) => e.designation === "Cabin Crew");

  for (const { route, dayOffset } of flightSchedule) {
    const originAp = airportByCode[route.origin];
    const destAp = airportByCode[route.dest];
    if (!originAp || !destAp) continue;

    const ac = aircraftList[route.aircraftIdx % aircraftList.length];
    if (!ac) continue;

    const departAt = new Date(today);
    departAt.setDate(today.getDate() + dayOffset);
    departAt.setHours(route.departHour, 0, 0, 0);

    const arriveAt = new Date(departAt.getTime() + route.durationMin * 60 * 1000);

    // Build a deterministic flight number per day
    const dateStr = departAt.toISOString().slice(0, 10).replace(/-/g, "");
    const flightNo = `${route.flightNoBase}-${dateStr}`;

    // Idempotency: skip if this exact flight already exists
    const existing = await prisma.flight.findFirst({ where: { flightNo } });

    let flightId: string;
    if (existing) {
      flightId = existing.id;
    } else {
      const created = await prisma.flight.create({
        data: {
          flightNo,
          originId: originAp.id,
          destinationId: destAp.id,
          aircraftId: ac.id,
          departAt,
          arriveAt,
          baseFare: route.baseFare,
          capacity: ac.capacity,
          status: "SCHEDULED",
        },
      });
      flightId = created.id;
      flightCount++;
    }

    // Seats — upsert on [flightId, seatNo]
    const seatNos = generateSeatNos(ac.capacity);
    for (const { seatNo, cabinClass } of seatNos) {
      const existingSeat = await prisma.seat.findUnique({
        where: { flightId_seatNo: { flightId, seatNo } },
      });
      if (!existingSeat) {
        await prisma.seat.create({ data: { flightId, seatNo, cabinClass, status: "AVAILABLE" } });
        seatCount++;
      }
    }

    // Crew — assign pilot, co-pilot, 2 cabin crew (upsert on unique[flightId, employeeId])
    const crewToAssign = [
      { emp: pilots[dayOffset % pilots.length],    role: "PILOT" },
      { emp: coPilots[dayOffset % coPilots.length], role: "CO_PILOT" },
      { emp: cabinCrew[dayOffset % cabinCrew.length],       role: "CABIN_CREW" },
      { emp: cabinCrew[(dayOffset + 1) % cabinCrew.length], role: "CABIN_CREW" },
    ];

    for (const { emp, role } of crewToAssign) {
      if (!emp) continue;
      await prisma.crewAssignment.upsert({
        where: { flightId_employeeId: { flightId, employeeId: emp.id } },
        update: {},
        create: { flightId, employeeId: emp.id, role },
      });
      crewCount++;
    }
  }

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
