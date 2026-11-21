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

describe("Attendance & Duty reporting", () => {
  let adminToken: string;
  let employeeId: string;
  let createdDutyIds: string[] = [];

  beforeAll(async () => {
    adminToken = await getAdminToken();

    // Get a seeded employee
    const employee = await prisma.employee.findFirst();
    expect(employee).not.toBeNull();
    employeeId = employee!.id;
  });

  afterAll(async () => {
    // Clean up duty reports created during tests
    if (createdDutyIds.length > 0) {
      await prisma.dutyReport.deleteMany({ where: { id: { in: createdDutyIds } } });
    }
    // Clean up today's attendance record for the employee
    const today = new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");
    await prisma.attendance.deleteMany({
      where: { employeeId, date: today },
    });
  });

  describe("Attendance", () => {
    it("Mark IN then OUT same day → single row with both checkIn and checkOut", async () => {
      // Mark IN
      const inRes = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ employeeId, type: "IN" });

      expect(inRes.status).toBe(200);
      expect(inRes.body.employeeId).toBe(employeeId);
      expect(inRes.body.checkIn).not.toBeNull();

      // Mark OUT
      const outRes = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ employeeId, type: "OUT" });

      expect(outRes.status).toBe(200);
      expect(outRes.body.employeeId).toBe(employeeId);
      expect(outRes.body.checkOut).not.toBeNull();

      // GET attendance and find today's record
      const getRes = await request(app)
        .get("/api/attendance")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ employeeId });

      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body)).toBe(true);

      const today = new Date().toISOString().split("T")[0];
      const todayRecord = getRes.body.find(
        (r: { date: string; checkIn: string | null; checkOut: string | null }) =>
          r.date.startsWith(today)
      );

      expect(todayRecord).toBeDefined();
      expect(todayRecord.checkIn).not.toBeNull();
      expect(todayRecord.checkOut).not.toBeNull();
    });

    it("GET /api/attendance without filter returns records", async () => {
      const res = await request(app)
        .get("/api/attendance")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("Unauthenticated request returns 401", async () => {
      const res = await request(app)
        .post("/api/attendance/mark")
        .send({ employeeId, type: "IN" });

      expect(res.status).toBe(401);
    });
  });

  describe("Duty", () => {
    it("Duty start then end sets endAt", async () => {
      const startAt = new Date().toISOString();

      // POST /api/duty - start duty
      const startRes = await request(app)
        .post("/api/duty")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ employeeId, dutyArea: "GATE-A", startAt });

      expect(startRes.status).toBe(201);
      expect(startRes.body.id).toBeDefined();
      expect(startRes.body.dutyArea).toBe("GATE-A");
      expect(startRes.body.endAt).toBeNull();

      const dutyId = startRes.body.id as string;
      createdDutyIds.push(dutyId);

      // POST /api/duty/:id/end - end duty
      const endRes = await request(app)
        .post(`/api/duty/${dutyId}/end`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(endRes.status).toBe(200);
      expect(endRes.body.id).toBe(dutyId);
      expect(endRes.body.endAt).not.toBeNull();
    });

    it("GET /api/duty returns duty reports", async () => {
      const res = await request(app)
        .get("/api/duty")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/duty?employeeId=... filters by employee", async () => {
      const res = await request(app)
        .get("/api/duty")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ employeeId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // All returned records should belong to the queried employee
      res.body.forEach((r: { employeeId: string }) => {
        expect(r.employeeId).toBe(employeeId);
      });
    });

    it("POST /api/duty/:id/end on non-existent duty → 404", async () => {
      const res = await request(app)
        .post("/api/duty/nonexistent-id/end")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(404);
    });

    it("Unauthenticated duty request returns 401", async () => {
      const res = await request(app)
        .get("/api/duty");

      expect(res.status).toBe(401);
    });
  });
});
