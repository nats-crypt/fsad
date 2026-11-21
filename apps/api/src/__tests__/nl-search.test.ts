import request from "supertest";
import { createApp } from "../app.js";
import { parseSearchLocal } from "../ai/local.js";

const app = createApp();

describe("parseSearchLocal (unit)", () => {
  it('"cheap morning flight to Delhi next Friday" → DEL, MORNING, CHEAPEST, dateFrom within 7 days', () => {
    const parsed = parseSearchLocal("cheap morning flight to Delhi next Friday");

    expect(parsed.destination).toBe("DEL");
    expect(parsed.timeOfDay).toBe("MORNING");
    expect(parsed.sort).toBe("CHEAPEST");

    // dateFrom should be set and within the next 7 days
    expect(parsed.dateFrom).toBeDefined();
    const dateFrom = new Date(parsed.dateFrom!);
    const today = new Date();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    // Allow ±1 day slack for timezone edge cases
    expect(dateFrom.getTime()).toBeGreaterThanOrEqual(
      today.getTime() - 24 * 60 * 60 * 1000
    );
    expect(dateFrom.getTime()).toBeLessThanOrEqual(
      sevenDaysLater.getTime() + 24 * 60 * 60 * 1000
    );
  });

  it('"flight from Mumbai to Chennai" → origin BOM, destination MAA', () => {
    const parsed = parseSearchLocal("flight from Mumbai to Chennai");
    expect(parsed.origin).toBe("BOM");
    expect(parsed.destination).toBe("MAA");
  });

  it('"fast flight today" → sort FASTEST, dateFrom today', () => {
    const parsed = parseSearchLocal("fast flight today");
    expect(parsed.sort).toBe("FASTEST");
    expect(parsed.dateFrom).toBe(new Date().toISOString().slice(0, 10));
  });

  it('"evening flight to Hyderabad tomorrow" → HYD, EVENING, dateTo tomorrow', () => {
    const parsed = parseSearchLocal(
      "evening flight to Hyderabad tomorrow"
    );
    expect(parsed.destination).toBe("HYD");
    expect(parsed.timeOfDay).toBe("EVENING");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(parsed.dateTo).toBe(tomorrow.toISOString().slice(0, 10));
  });

  it('"DEL to BOM" (IATA codes) → origin DEL, destination BOM', () => {
    const parsed = parseSearchLocal("DEL to BOM");
    expect(parsed.destination).toBe("BOM");
  });
});

describe("POST /api/ai/search", () => {
  it("returns 400 for missing text", async () => {
    const res = await request(app).post("/api/ai/search").send({});
    expect(res.status).toBe(400);
  });

  it('"cheap morning flight to Delhi next Friday" → parsed + flights array', async () => {
    const res = await request(app)
      .post("/api/ai/search")
      .send({ text: "cheap morning flight to Delhi next Friday" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("parsed");
    expect(res.body).toHaveProperty("flights");

    const { parsed, flights } = res.body as {
      parsed: {
        destination?: string;
        timeOfDay?: string;
        sort?: string;
        dateFrom?: string;
      };
      flights: unknown[];
    };

    expect(parsed.destination).toBe("DEL");
    expect(parsed.timeOfDay).toBe("MORNING");
    expect(parsed.sort).toBe("CHEAPEST");

    // dateFrom within next 7 days
    expect(parsed.dateFrom).toBeDefined();
    const dateFrom = new Date(parsed.dateFrom!);
    const today = new Date();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    expect(dateFrom.getTime()).toBeGreaterThanOrEqual(
      today.getTime() - 24 * 60 * 60 * 1000
    );
    expect(dateFrom.getTime()).toBeLessThanOrEqual(
      sevenDaysLater.getTime() + 24 * 60 * 60 * 1000
    );

    expect(Array.isArray(flights)).toBe(true);
  });

  it("returns flights array for a valid text with no specific filters", async () => {
    const res = await request(app)
      .post("/api/ai/search")
      .send({ text: "show me flights" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.flights)).toBe(true);
  });
});
