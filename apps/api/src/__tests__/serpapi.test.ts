import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { fetchLiveFlights } from "../lib/serpapi.js";

describe("SerpApi live flights (no key configured in tests)", () => {
  it("fetchLiveFlights returns available:false and makes no network call when SERPAPI_KEY unset", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await fetchLiveFlights({ departureId: "CDG", arrivalId: "AUS", outboundDate: "2026-11-22" });
    expect(res.available).toBe(false);
    expect(res.flights).toEqual([]);
    expect(res.message).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("GET /api/flights/live returns 200 with available:false when not configured", async () => {
    const res = await request(createApp()).get(
      "/api/flights/live?departureId=CDG&arrivalId=AUS&outboundDate=2026-11-22&currency=USD"
    );
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(Array.isArray(res.body.flights)).toBe(true);
  });

  it("GET /api/flights/live validates query params", async () => {
    const res = await request(createApp()).get("/api/flights/live?departureId=CDG");
    expect(res.status).toBe(400);
  });
});
