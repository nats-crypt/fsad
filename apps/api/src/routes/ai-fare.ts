import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "@horizon/db";
import { HttpError } from "../lib/http-error.js";
import { forecastFare } from "../ai/fare.js";

export const aiFareRouter = Router();

/** GET /api/ai/fare-forecast/:flightId → { trend, advice, confidence } */
aiFareRouter.get(
  "/:flightId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flight = await prisma.flight.findUnique({
        where: { id: req.params.flightId },
      });

      if (!flight) {
        throw new HttpError(404, "Flight not found");
      }

      const forecast = forecastFare({
        capacity: flight.capacity,
        seatsBooked: flight.seatsBooked,
        departAt: flight.departAt,
      });

      res.json(forecast);
    } catch (err) {
      next(err);
    }
  }
);
