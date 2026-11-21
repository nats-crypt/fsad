import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { fetchLiveFlights } from "../lib/serpapi.js";

export const flightsLiveRouter = Router();

const querySchema = z.object({
  departureId: z.string().min(3).max(4),
  arrivalId: z.string().min(3).max(4),
  outboundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().min(3).max(3).optional(),
});

// GET /api/flights/live?departureId=CDG&arrivalId=AUS&outboundDate=2026-11-22&currency=USD
flightsLiveRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = querySchema.parse({
      departureId: req.query.departureId,
      arrivalId: req.query.arrivalId,
      outboundDate: req.query.outboundDate,
      currency: req.query.currency,
    });
    const result = await fetchLiveFlights({
      departureId: q.departureId.toUpperCase(),
      arrivalId: q.arrivalId.toUpperCase(),
      outboundDate: q.outboundDate,
      currency: q.currency?.toUpperCase(),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
