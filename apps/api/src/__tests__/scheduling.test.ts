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

describe("Flight scheduling – admin writes", () => {
  let adminToken: string;
  let aircraftId: string;
  let originId: string;
  let destinationId: string;
  let createdFlightId: string | undefined;
  let createdCrewIds: string[] = [];
  let employeeId: string;
  let createdEmployeeId: string | undefined;

  beforeAll(async () => {
    adminToken = await getAdminToken();

    // Get a valid aircraft
    const aircraft = await prisma.aircraft.findFirst();
    expect(aircraft).not.toBeNull();
    aircraftId = aircraft!.id;

    // Get airports DEL and BOM
    const origin = await prisma.airport.findUnique({ where: { code: "DEL" } });
    const destination = await prisma.airport.findUnique({ where: { code: "BOM" } });
    expect(origin).not.toBeNull();
    expect(destination).not.toBeNull();
    originId = origin!.id;
    destinationId = destination!.id;

    // Create an employee for crew assignment tests
    const empCode = `CREW${Date.now()}`;
    const employee = await prisma.employee.create({
      data: {
        empCode,
        fullName: "Test Crew Member",
        designation: "Pilot",
      },
    });
    createdEmployeeId = employee.id;
    employeeId = employee.id;
  });

  afterAll(async () => {
    // Clean up any remaining crew assignments
    if (createdCrewIds.length > 0) {
      await prisma.crewAssignment.deleteMany({ where: { id: { in: createdCrewIds } } });
    }
    // Clean up flight and its seats
    if (createdFlightId) {
      await prisma.crewAssignment.deleteMany({ where: { flightId: createdFlightId } });
      await prisma.seat.deleteMany({ where: { flightId: createdFlightId } });
      await prisma.flight.deleteMany({ where: { id: createdFlightId } });
    }
    // Clean up employee
    if (createdEmployeeId) {
      await prisma.employee.deleteMany({ where: { id: createdEmployeeId } });
    }
  });

  it("Admin creates flight → seats generated count = capacity", async () => {
    const departAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const arriveAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post("/api/flights")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        flightNo: "HA999",
        originId,
        destinationId,
        aircraftId,
        departAt,
        arriveAt,
        baseFare: "5000",
        capacity: 12,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    createdFlightId = res.body.id as string;

    // GET /api/flights/:id → seats array length should equal capacity (12)
    const getRes = await request(app).get(`/api/flights/${createdFlightId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.seats).toBeDefined();
    expect(Array.isArray(getRes.body.seats)).toBe(true);
    expect(getRes.body.seats.length).toBe(12);
  });

  it("Assign crew → crew appears in GET /api/crew?flightId=...", async () => {
    expect(createdFlightId).toBeDefined();

    const res = await request(app)
      .post("/api/crew")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        flightId: createdFlightId,
        employeeId,
        role: "PILOT",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    createdCrewIds.push(res.body.id as string);

    // GET crew for this flight
    const getRes = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ flightId: createdFlightId });

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
    expect(getRes.body.length).toBeGreaterThan(0);

    const assignment = getRes.body.find(
      (c: { employeeId: string }) => c.employeeId === employeeId
    );
    expect(assignment).toBeDefined();
  });

  it("Duplicate crew assignment → 409", async () => {
    expect(createdFlightId).toBeDefined();

    const res = await request(app)
      .post("/api/crew")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        flightId: createdFlightId,
        employeeId,
        role: "PILOT",
      });

    expect(res.status).toBe(409);
  });

  it("DELETE crew removes it", async () => {
    expect(createdCrewIds.length).toBeGreaterThan(0);
    const crewId = createdCrewIds[0];

    const res = await request(app)
      .delete(`/api/crew/${crewId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify it's gone from the crew list
    const getRes = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ flightId: createdFlightId });

    expect(getRes.status).toBe(200);
    const found = getRes.body.find((c: { id: string }) => c.id === crewId);
    expect(found).toBeUndefined();

    // Remove from tracking since it's already deleted
    createdCrewIds = createdCrewIds.filter((id) => id !== crewId);
  });
});
