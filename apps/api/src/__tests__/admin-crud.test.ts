import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";
import { signToken } from "../lib/auth.js";

const app = createApp();

// Unique registration suffix per run
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function getAdminToken(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@horizon.air" },
  });
  return signToken({ id: user.id, role: user.role });
}

describe("Aircraft CRUD – /api/aircraft", () => {
  let createdAircraftId: string | undefined;
  let staffAircraftId: string | undefined;
  let adminToken: string;
  let passengerToken: string;
  let staffToken: string;
  let staffUserId: string | undefined;

  // Track registered passenger for cleanup
  const passengerEmails: string[] = [];

  beforeAll(async () => {
    adminToken = await getAdminToken();
    // Register a fresh passenger
    const email = `pass+${uid()}@horizon.test`;
    passengerEmails.push(email);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "Passw0rd!", fullName: "Test Passenger" });
    passengerToken = res.body.token as string;

    // Create a temporary STAFF user for role tests
    const staffEmail = `staff+${uid()}@horizon.test`;
    const staffUser = await prisma.user.create({
      data: { email: staffEmail, passwordHash: "x", role: "STAFF" },
    });
    staffUserId = staffUser.id;
    staffToken = signToken({ id: staffUser.id, role: "STAFF" });
  });

  afterAll(async () => {
    // Clean up created aircraft
    if (createdAircraftId) {
      await prisma.aircraft.deleteMany({ where: { id: createdAircraftId } });
    }
    if (staffAircraftId) {
      await prisma.aircraft.deleteMany({ where: { id: staffAircraftId } });
    }
    // Clean up registered passengers
    for (const email of passengerEmails) {
      await prisma.passenger.deleteMany({ where: { user: { email } } });
      await prisma.user.deleteMany({ where: { email } });
    }
    // Clean up STAFF user
    if (staffUserId) {
      await prisma.user.deleteMany({ where: { id: staffUserId } });
    }
  });

  it("ADMIN token can create an aircraft → 200 or 201", async () => {
    const reg = `TEST-${uid().slice(0, 6).toUpperCase()}`;
    const res = await request(app)
      .post("/api/aircraft")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        registration: reg,
        model: "Boeing 737",
        capacity: 180,
        status: "ACTIVE",
      });

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body.registration).toBe(reg);

    createdAircraftId = res.body.id as string;
  });

  it("STAFF token creates aircraft → 201", async () => {
    const reg = `STAFF-${uid().slice(0, 5).toUpperCase()}`;
    const res = await request(app)
      .post("/api/aircraft")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        registration: reg,
        model: "Airbus A320",
        capacity: 150,
        status: "ACTIVE",
      });

    expect(res.status).toBe(201);
    expect(res.body.registration).toBe(reg);

    staffAircraftId = res.body.id as string;
  });

  it("PASSENGER token gets 403 when creating an aircraft", async () => {
    const res = await request(app)
      .post("/api/aircraft")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        registration: `REJ-${uid().slice(0, 6).toUpperCase()}`,
        model: "Airbus A320",
        capacity: 150,
        status: "ACTIVE",
      });

    expect(res.status).toBe(403);
  });

  it("GET /api/aircraft returns a list that includes the created aircraft", async () => {
    // We rely on createdAircraftId being set by the first test.
    // If the first test was skipped/failed, we skip this check.
    if (!createdAircraftId) return;

    const res = await request(app)
      .get("/api/aircraft");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const found = (res.body as Array<{ id: string }>).find(
      (a) => a.id === createdAircraftId
    );
    expect(found).toBeDefined();
  });

  it("GET /api/aircraft/:id returns the aircraft", async () => {
    if (!createdAircraftId) return;

    const res = await request(app).get(`/api/aircraft/${createdAircraftId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdAircraftId);
  });

  it("GET /api/aircraft/:id returns 404 for unknown id", async () => {
    const res = await request(app).get("/api/aircraft/nonexistent-id-xyz");

    expect(res.status).toBe(404);
  });

  it("ADMIN token can update an aircraft → 200", async () => {
    if (!createdAircraftId) return;

    const res = await request(app)
      .put(`/api/aircraft/${createdAircraftId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ model: "Boeing 737 MAX", capacity: 190, status: "ACTIVE" });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe("Boeing 737 MAX");
  });

  it("PASSENGER token gets 403 when updating an aircraft", async () => {
    if (!createdAircraftId) return;

    const res = await request(app)
      .put(`/api/aircraft/${createdAircraftId}`)
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ model: "Hacked", capacity: 999, status: "ACTIVE" });

    expect(res.status).toBe(403);
  });

  it("ADMIN token can delete an aircraft → 200 or 204", async () => {
    if (!createdAircraftId) return;

    const res = await request(app)
      .delete(`/api/aircraft/${createdAircraftId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    // Mark as cleaned up
    createdAircraftId = undefined;
  });
});

describe("Employee CRUD – /api/employees", () => {
  let createdEmployeeId: string | undefined;
  let adminToken: string;
  let passengerToken: string;

  const passengerEmails: string[] = [];

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const email = `pass+${uid()}@horizon.test`;
    passengerEmails.push(email);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "Passw0rd!", fullName: "Test Passenger" });
    passengerToken = res.body.token as string;
  });

  afterAll(async () => {
    if (createdEmployeeId) {
      await prisma.employee.deleteMany({ where: { id: createdEmployeeId } });
    }
    for (const email of passengerEmails) {
      await prisma.passenger.deleteMany({ where: { user: { email } } });
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it("ADMIN token can create an employee → 200 or 201", async () => {
    const empCode = `EMP${uid().slice(0, 5).toUpperCase()}`;
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        empCode,
        fullName: "Jane Doe",
        designation: "Pilot",
        dutyArea: "Cockpit",
        salary: 120000,
        contact: "+91-9999999999",
      });

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body.empCode).toBe(empCode);

    createdEmployeeId = res.body.id as string;
  });

  it("PASSENGER token gets 403 when creating an employee", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        empCode: `REJ${uid().slice(0, 5).toUpperCase()}`,
        fullName: "Bad Actor",
        designation: "Hacker",
        salary: 0,
      });

    expect(res.status).toBe(403);
  });

  it("GET /api/employees returns a list that includes the created employee", async () => {
    if (!createdEmployeeId) return;

    const res = await request(app)
      .get("/api/employees");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const found = (res.body as Array<{ id: string }>).find(
      (e) => e.id === createdEmployeeId
    );
    expect(found).toBeDefined();
  });

  it("ADMIN token can delete an employee → 200 or 204", async () => {
    if (!createdEmployeeId) return;

    const res = await request(app)
      .delete(`/api/employees/${createdEmployeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    createdEmployeeId = undefined;
  });
});
