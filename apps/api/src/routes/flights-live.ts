import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { fetchLiveFlights, type LiveFlight } from "../lib/serpapi.js";

export const flightsLiveRouter = Router();

const querySchema = z.object({
  departureId: z.string().min(3).max(4),
  arrivalId: z.string().min(3).max(4),
  outboundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().min(3).max(3).optional(),
});

// Fallback: map internal (bookable) Horizon flights to the LiveFlight shape so the
// Live Fares view still shows rich results when the realtime API is unavailable.
async function dbFallback(departureId: string, arrivalId: string, outboundDate: string): Promise<LiveFlight[]> {
  const dayStart = new Date(`${outboundDate}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const flights = await prisma.flight.findMany({
    where: {
      origin: { code: departureId },
      destination: { code: arrivalId },
      departAt: { gte: dayStart, lt: dayEnd },
    },
    include: { origin: true, destination: true },
    orderBy: { departAt: "asc" },
  });
  return flights.map((f) => ({
    airlines: ["Horizon Airways"],
    flightNumbers: [f.flightNo.split("-")[0]],
    departAirport: f.origin.code,
    arriveAirport: f.destination.code,
    departTime: f.departAt.toISOString(),
    arriveTime: f.arriveAt.toISOString(),
    totalDurationMin: Math.round((f.arriveAt.getTime() - f.departAt.getTime()) / 60000),
    stops: 0,
    price: Number(f.baseFare),
    currency: "INR",
  }));
}

// GET /api/flights/live?departureId=CDG&arrivalId=AUS&outboundDate=2026-11-22&currency=USD
flightsLiveRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = querySchema.parse({
      departureId: req.query.departureId,
      arrivalId: req.query.arrivalId,
      outboundDate: req.query.outboundDate,
      currency: req.query.currency,
    });
    const depId = q.departureId.toUpperCase();
    const arrId = q.arrivalId.toUpperCase();

    const live = await fetchLiveFlights({
      departureId: depId,
      arrivalId: arrId,
      outboundDate: q.outboundDate,
      currency: q.currency?.toUpperCase(),
    });

    if (live.available && live.flights.length > 0) {
      res.json({ available: true, source: "serpapi", flights: live.flights });
      return;
    }

    // Realtime unavailable (no key / error / empty) → fall back to internal DB flights.
    const flights = await dbFallback(depId, arrId, q.outboundDate);
    res.json({
      available: flights.length > 0,
      source: "local",
      flights,
      message: live.message ?? "Showing Horizon Airways flights (live fares unavailable).",
    });
  } catch (err) {
    next(err);
  }
});
