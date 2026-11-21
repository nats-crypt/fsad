import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";

const app = createApp();

describe("POST /api/ai/rebooking", () => {
  it("returns 400 for missing flightId", async () => {
    const res = await request(app).post("/api/ai/rebooking").send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown flight id", async () => {
    const res = await request(app)
      .post("/api/ai/rebooking")
      .send({ flightId: "nonexistent-id" });
    expect(res.status).toBe(404);
  });

  it("returns same-route alternatives sorted by time proximity, excluding the input flight", async () => {
    // Use the first scheduled DEL→BOM flight from seed data
    const flight = await prisma.flight.findFirst({
      where: {
        origin: { code: "DEL" },
        destination: { code: "BOM" },
        status: "SCHEDULED",
      },
      orderBy: { departAt: "asc" },
    });
    expect(flight).not.toBeNull();

    const res = await request(app)
      .post("/api/ai/rebooking")
      .send({ flightId: flight!.id });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    for (const alt of res.body as Array<{
      id: string;
      origin: { code: string };
      destination: { code: string };
    }>) {
      // All alternatives must be on the same route
      expect(alt.origin.code).toBe("DEL");
      expect(alt.destination.code).toBe("BOM");
      // The cancelled flight must NOT appear in alternatives
      expect(alt.id).not.toBe(flight!.id);
    }
  });

  it("alternatives are sorted by time proximity (ascending diff from original departure)", async () => {
    const flight = await prisma.flight.findFirst({
      where: {
        origin: { code: "DEL" },
        destination: { code: "BOM" },
        status: "SCHEDULED",
      },
      orderBy: { departAt: "asc" },
    });
    if (!flight) return; // skip if seed data absent

    const res = await request(app)
      .post("/api/ai/rebooking")
      .send({ flightId: flight!.id });

    expect(res.status).toBe(200);
    const alts = res.body as Array<{ departAt: string }>;

    // Verify non-decreasing time-proximity order
    for (let i = 1; i < alts.length; i++) {
      const aDiff = Math.abs(
        new Date(alts[i - 1].departAt).getTime() - flight!.departAt.getTime()
      );
      const bDiff = Math.abs(
        new Date(alts[i].departAt).getTime() - flight!.departAt.getTime()
      );
      expect(aDiff).toBeLessThanOrEqual(bDiff);
    }
  });
});
