import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";
import { forecastFare } from "../ai/fare.js";

const app = createApp();

// ── Pure function unit tests ──────────────────────────────────────────────────

describe("forecastFare (unit)", () => {
  it("high occupancy + near departure → RISING / BOOK_NOW", () => {
    const flight = {
      capacity: 100,
      seatsBooked: 85,
      departAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days out
    };
    const result = forecastFare(flight);
    expect(result.trend).toBe("RISING");
    expect(result.advice).toBe("BOOK_NOW");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("low occupancy + far departure → FALLING / WAIT", () => {
    const flight = {
      capacity: 200,
      seatsBooked: 20,
      departAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days out
    };
    const result = forecastFare(flight);
    expect(result.trend).toBe("FALLING");
    expect(result.advice).toBe("WAIT");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("medium occupancy → STEADY / BOOK_NOW", () => {
    const flight = {
      capacity: 100,
      seatsBooked: 50,
      departAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days out
    };
    const result = forecastFare(flight);
    expect(result.trend).toBe("STEADY");
    expect(result.advice).toBe("BOOK_NOW");
  });

  it("result has trend, advice, confidence fields", () => {
    const flight = {
      capacity: 100,
      seatsBooked: 60,
      departAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    };
    const result = forecastFare(flight);
    expect(["RISING", "STEADY", "FALLING"]).toContain(result.trend);
    expect(["BOOK_NOW", "WAIT"]).toContain(result.advice);
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ── Route integration tests ───────────────────────────────────────────────────

describe("GET /api/ai/fare-forecast/:flightId", () => {
  it("returns 404 for unknown flight id", async () => {
    const res = await request(app).get(
      "/api/ai/fare-forecast/nonexistent-flight-id"
    );
    expect(res.status).toBe(404);
  });

  it("returns trend, advice, confidence for a seeded flight", async () => {
    const flight = await prisma.flight.findFirst({
      where: {
        origin: { code: "DEL" },
        destination: { code: "BOM" },
        status: "SCHEDULED",
      },
    });
    expect(flight).not.toBeNull();

    const res = await request(app).get(
      `/api/ai/fare-forecast/${flight!.id}`
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("trend");
    expect(res.body).toHaveProperty("advice");
    expect(res.body).toHaveProperty("confidence");
    expect(["RISING", "STEADY", "FALLING"]).toContain(res.body.trend);
    expect(["BOOK_NOW", "WAIT"]).toContain(res.body.advice);
  });
});
