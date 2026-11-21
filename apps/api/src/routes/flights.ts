import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { HttpError } from "../lib/http-error.js";

export const flightsRouter = Router();

const searchSchema = z.object({
  origin: z.string().min(2).max(5).toUpperCase(),
  destination: z.string().min(2).max(5).toUpperCase(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  pax: z.coerce.number().int().min(1).optional().default(1),
});

/** GET /api/flights?origin=DEL&destination=BOM&date=2026-11-22&pax=1 */
flightsRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = searchSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new HttpError(400, "Invalid query parameters");
      }
      const { origin, destination, date } = parsed.data;

      // Whole-day range in UTC
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);

      const flights = await prisma.flight.findMany({
        where: {
          origin: { code: origin },
          destination: { code: destination },
          departAt: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: { not: "CANCELLED" },
        },
        include: {
          origin: true,
          destination: true,
          aircraft: true,
        },
        orderBy: { departAt: "asc" },
      });

      const result = flights.map((f) => ({
        id: f.id,
        flightNo: f.flightNo,
        origin: { code: f.origin.code, city: f.origin.city, name: f.origin.name },
        destination: { code: f.destination.code, city: f.destination.city, name: f.destination.name },
        departAt: f.departAt,
        arriveAt: f.arriveAt,
        baseFare: Number(f.baseFare),
        capacity: f.capacity,
        seatsBooked: f.seatsBooked,
        seatsLeft: f.capacity - f.seatsBooked,
        status: f.status,
        aircraft: { model: f.aircraft.model, registration: f.aircraft.registration },
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/flights/:id — includes seat map */
flightsRouter.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flight = await prisma.flight.findUnique({
        where: { id: req.params.id },
        include: {
          origin: true,
          destination: true,
          aircraft: true,
          seats: {
            orderBy: [
              { cabinClass: "asc" },
              { seatNo: "asc" },
            ],
          },
        },
      });

      if (!flight) {
        throw new HttpError(404, "Flight not found");
      }

      res.json({
        id: flight.id,
        flightNo: flight.flightNo,
        origin: { code: flight.origin.code, city: flight.origin.city, name: flight.origin.name },
        destination: { code: flight.destination.code, city: flight.destination.city, name: flight.destination.name },
        departAt: flight.departAt,
        arriveAt: flight.arriveAt,
        baseFare: Number(flight.baseFare),
        capacity: flight.capacity,
        seatsBooked: flight.seatsBooked,
        seatsLeft: flight.capacity - flight.seatsBooked,
        status: flight.status,
        aircraft: { model: flight.aircraft.model, registration: flight.aircraft.registration },
        seats: flight.seats.map((s) => ({
          id: s.id,
          seatNo: s.seatNo,
          cabinClass: s.cabinClass,
          status: s.status,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);
