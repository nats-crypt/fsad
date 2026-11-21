import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";
import { signToken } from "../lib/auth.js";
import { optimizeFlights } from "../ai/optimizer.js";

const app = createApp();

async function getAdminToken(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@horizon.air" },
  });
  return signToken({ id: user.id, role: user.role });
}

// ── Pure function unit tests ──────────────────────────────────────────────────

describe("optimizeFlights (unit)", () => {
  it("near-full near-departure flight → high predictedLoadFactor and recommendedCrew ≥ baseline", () => {
    const nearFull = {
      id: "f1",
      flightNo: "HA-TEST-1",
      capacity: 150,
      seatsBooked: 140,
      departAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
    };

    const results = optimizeFlights([nearFull], {});
    expect(results).toHaveLength(1);
    const r = results[0];

    // 140/150 ≈ 0.93, × seasonality(≈0.125 days) = 1.3 → clamp(1.21, 0, 1) = 1.0
    expect(r.predictedLoadFactor).toBeGreaterThan(0.8);
    // baseline for capacity 150 (< 200) = 6
    expect(r.recommendedCrew).toBeGreaterThanOrEqual(4);
    expect(r.recommendedCrew).toBe(6);
  });

  it("empty far-out flight → low predictedLoadFactor", () => {
    const empty = {
      id: "f2",
      flightNo: "HA-TEST-2",
      capacity: 200,
      seatsBooked: 15,
      departAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days out
    };

    const results = optimizeFlights([empty], {});
    const r = results[0];

    // 15/200 = 0.075, × seasonality(90 days) = 0.8 → 0.06
    expect(r.predictedLoadFactor).toBeLessThan(0.3);
  });

  it("assigned crew > recommended → flag OVER", () => {
    const flight = {
      id: "f3",
      flightNo: "HA-TEST-3",
      capacity: 80,
      seatsBooked: 40,
      departAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    // baseline for capacity 80 (< 100) = 4; assigning 10
    const results = optimizeFlights([flight], { f3: 10 });
    expect(results[0].flag).toBe("OVER");
  });

  it("assigned crew < recommended → flag UNDER", () => {
    const flight = {
      id: "f4",
      flightNo: "HA-TEST-4",
      capacity: 200,
      seatsBooked: 100,
      departAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    // baseline for capacity 200 (>= 200) = 8; assigning 2
    const results = optimizeFlights([flight], { f4: 2 });
    expect(results[0].flag).toBe("UNDER");
  });

  it("assigned crew = recommended → flag OK", () => {
    const flight = {
      id: "f5",
      flightNo: "HA-TEST-5",
      capacity: 80,
      seatsBooked: 40,
      departAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    // baseline = 4; assign exactly 4
    const results = optimizeFlights([flight], { f5: 4 });
    expect(results[0].flag).toBe("OK");
  });

  it("result has all required fields", () => {
    const flight = {
      id: "f6",
      flightNo: "HA-TEST-6",
      capacity: 100,
      seatsBooked: 50,
      departAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    const [r] = optimizeFlights([flight], {});
    expect(r).toHaveProperty("flightId", "f6");
    expect(r).toHaveProperty("flightNo", "HA-TEST-6");
    expect(r).toHaveProperty("predictedLoadFactor");
    expect(r).toHaveProperty("recommendedCrew");
    expect(r).toHaveProperty("recommendedAircraftSize");
    expect(r).toHaveProperty("flag");
    expect(r).toHaveProperty("rationale");
    expect(["OVER", "UNDER", "OK"]).toContain(r.flag);
    expect(["SMALL", "MEDIUM", "LARGE"]).toContain(r.recommendedAircraftSize);
  });
});

// ── Route integration tests ───────────────────────────────────────────────────

describe("GET /api/ai/optimizer", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/api/ai/optimizer");
    expect(res.status).toBe(401);
  });

  it("returns 403 for PASSENGER role", async () => {
    const email = `pass-opt-${Date.now()}@test.horizon`;
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "Passw0rd!", fullName: "Opt Passenger" });
    const passengerToken = regRes.body.token as string;

    const res = await request(app)
      .get("/api/ai/optimizer")
      .set("Authorization", `Bearer ${passengerToken}`);
    expect(res.status).toBe(403);

    // cleanup
    await prisma.passenger.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns optimizer results array for ADMIN", async () => {
    const adminToken = await getAdminToken();
    const res = await request(app)
      .get("/api/ai/optimizer")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const item = res.body[0] as Record<string, unknown>;
      expect(item).toHaveProperty("flightId");
      expect(item).toHaveProperty("flightNo");
      expect(item).toHaveProperty("predictedLoadFactor");
      expect(item).toHaveProperty("recommendedCrew");
      expect(item).toHaveProperty("recommendedAircraftSize");
      expect(item).toHaveProperty("flag");
      expect(item).toHaveProperty("rationale");
    }
  });
});
