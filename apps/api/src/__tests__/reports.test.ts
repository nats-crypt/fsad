import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";
import { signToken } from "../lib/auth.js";

const app = createApp();

async function getAdminToken(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@horizon.air" },
  });
  return signToken({ id: user.id, role: user.role });
}

describe("GET /api/reports/:type", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();

    // Create test bookings so reports have real data to aggregate
    const flight = await prisma.flight.findFirst({
      where: { status: "SCHEDULED" },
    });
    if (!flight) throw new Error("No SCHEDULED flight found in seed data");

    const seat = await prisma.seat.findFirst({
      where: { flightId: flight.id, status: "AVAILABLE" },
    });
    if (!seat) throw new Error("No AVAILABLE seat found for flight");

    const seat2 = await prisma.seat.findFirst({
      where: { flightId: flight.id, status: "AVAILABLE", id: { not: seat.id } },
    });
    if (!seat2) throw new Error("No second AVAILABLE seat found for flight");

    const passenger = await prisma.passenger.findFirst();
    if (!passenger) throw new Error("No passenger found in seed data");

    await prisma.booking.create({
      data: {
        pnr: `TEST-${Date.now()}`,
        passengerId: passenger.id,
        flightId: flight.id,
        seatId: seat.id,
        farePaid: 5000,
        status: "CONFIRMED",
      },
    });

    await prisma.booking.create({
      data: {
        pnr: `TEST-CANCEL-${Date.now()}`,
        passengerId: passenger.id,
        flightId: flight.id,
        seatId: seat2.id,
        farePaid: 3000,
        status: "CANCELLED",
      },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { pnr: { startsWith: "TEST-" } } });
  });

  it("unauthenticated request → 401", async () => {
    const res = await request(app).get("/api/reports/revenue");
    expect(res.status).toBe(401);
  });

  it("unknown report type → 400", async () => {
    const res = await request(app)
      .get("/api/reports/unknown-type")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("revenue report: 200 with { summary: { total, count }, series: array }", async () => {
    const res = await request(app)
      .get("/api/reports/revenue")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("series");
    expect(typeof res.body.summary.total).toBe("number");
    expect(typeof res.body.summary.count).toBe("number");
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.series)).toBe(true);
    expect(res.body.series.length).toBeGreaterThan(0);
  });

  it("cancellations report: 200 with { summary: { total }, series: array }", async () => {
    const res = await request(app)
      .get("/api/reports/cancellations")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("series");
    expect(typeof res.body.summary.total).toBe("number");
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.series)).toBe(true);
  });
});
