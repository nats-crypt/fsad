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
    expect(res.body.summary.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.series)).toBe(true);
  });

  it("cancellations report: 200 with { summary: { total }, series: array }", async () => {
    const res = await request(app)
      .get("/api/reports/cancellations")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("series");
    expect(typeof res.body.summary.total).toBe("number");
    expect(res.body.summary.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.series)).toBe(true);
  });
});
