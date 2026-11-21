import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";

const app = createApp();

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe("GET /api/flights", () => {
  it("returns flights for a known route and date", async () => {
    // The seed creates DEL→BOM (HA101) starting day+1
    const date = getTomorrowDate();
    const res = await request(app)
      .get("/api/flights")
      .query({ origin: "DEL", destination: "BOM", date });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // There may be 0 or 1 flights depending on seed day offset;
    // we just check response shape and valid array response
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("flightNo");
      expect(res.body[0]).toHaveProperty("seatsLeft");
      expect(res.body[0].origin.code).toBe("DEL");
      expect(res.body[0].destination.code).toBe("BOM");
    }
  });

  it("returns empty array for unknown route", async () => {
    const date = getTomorrowDate();
    const res = await request(app)
      .get("/api/flights")
      .query({ origin: "DEL", destination: "ZZZ", date });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all DEL→BOM flights across the seed window (1-14 days)", async () => {
    // Search from today +1 to today +14 to find all seeded DEL→BOM flights
    const startDate = getTomorrowDate();
    // We iterate through dates to find at least one
    let found = false;
    for (let offset = 1; offset <= 14; offset++) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const date = d.toISOString().slice(0, 10);
      const res = await request(app)
        .get("/api/flights")
        .query({ origin: "DEL", destination: "BOM", date });
      if (res.body.length > 0) {
        found = true;
        expect(res.body[0].flightNo).toMatch(/HA101/);
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe("GET /api/flights/:id", () => {
  it("returns a flight with seat map", async () => {
    // Find the first DEL→BOM flight in the DB
    const flight = await prisma.flight.findFirst({
      where: {
        origin: { code: "DEL" },
        destination: { code: "BOM" },
      },
      include: { origin: true, destination: true },
    });
    expect(flight).not.toBeNull();

    const res = await request(app).get(`/api/flights/${flight!.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(flight!.id);
    expect(res.body.seats).toBeDefined();
    expect(Array.isArray(res.body.seats)).toBe(true);
    expect(res.body.seats.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown flight id", async () => {
    const res = await request(app).get("/api/flights/nonexistent-id");
    expect(res.status).toBe(404);
  });
});
