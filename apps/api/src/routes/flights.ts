import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../lib/validate.js";

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

// ─── Seat generation helper ─────────────────────────────────────────────────

function buildSeatData(
  flightId: string,
  capacity: number
): Array<{ flightId: string; seatNo: string; cabinClass: string; status: string }> {
  const columns = ["A", "B", "C", "D", "E", "F"];
  const totalRows = Math.ceil(capacity / 6);
  const seats: Array<{ flightId: string; seatNo: string; cabinClass: string; status: string }> = [];

  let count = 0;
  for (let row = 1; row <= totalRows && count < capacity; row++) {
    const cabinClass = row <= 2 ? "BUSINESS" : "ECONOMY";
    for (const col of columns) {
      if (count >= capacity) break;
      seats.push({ flightId, seatNo: `${row}${col}`, cabinClass, status: "AVAILABLE" });
      count++;
    }
  }

  return seats;
}

// ─── Admin writes ────────────────────────────────────────────────────────────

const createFlightSchema = z.object({
  flightNo: z.string().min(1),
  originId: z.string().min(1),
  destinationId: z.string().min(1),
  aircraftId: z.string().min(1),
  departAt: z.string().datetime(),
  arriveAt: z.string().datetime(),
  baseFare: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  capacity: z.coerce.number().int().positive(),
  status: z.enum(["SCHEDULED", "DEPARTED", "ARRIVED", "CANCELLED"]).optional().default("SCHEDULED"),
});

const updateFlightSchema = createFlightSchema.partial();

/** POST /api/flights — admin creates a flight and generates seats */
flightsRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validate(createFlightSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightNo, originId, destinationId, aircraftId, departAt, arriveAt, baseFare, capacity, status } =
        req.body as z.infer<typeof createFlightSchema>;

      const flight = await prisma.flight.create({
        data: {
          flightNo,
          originId,
          destinationId,
          aircraftId,
          departAt: new Date(departAt),
          arriveAt: new Date(arriveAt),
          baseFare,
          capacity,
          status,
        },
      });

      // Generate seat records
      const seatData = buildSeatData(flight.id, capacity);
      await prisma.seat.createMany({ data: seatData });

      res.status(201).json({
        id: flight.id,
        flightNo: flight.flightNo,
        originId: flight.originId,
        destinationId: flight.destinationId,
        aircraftId: flight.aircraftId,
        departAt: flight.departAt,
        arriveAt: flight.arriveAt,
        baseFare: Number(flight.baseFare),
        capacity: flight.capacity,
        seatsBooked: flight.seatsBooked,
        status: flight.status,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** PUT /api/flights/:id — admin updates a flight */
flightsRouter.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate(updateFlightSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.flight.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        throw new HttpError(404, "Flight not found");
      }

      const body = req.body as z.infer<typeof updateFlightSchema>;
      const data: Record<string, unknown> = { ...body };
      if (body.departAt) data.departAt = new Date(body.departAt);
      if (body.arriveAt) data.arriveAt = new Date(body.arriveAt);

      const flight = await prisma.flight.update({
        where: { id: req.params.id },
        data,
      });

      res.json({
        id: flight.id,
        flightNo: flight.flightNo,
        originId: flight.originId,
        destinationId: flight.destinationId,
        aircraftId: flight.aircraftId,
        departAt: flight.departAt,
        arriveAt: flight.arriveAt,
        baseFare: Number(flight.baseFare),
        capacity: flight.capacity,
        seatsBooked: flight.seatsBooked,
        status: flight.status,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /api/flights/:id — admin deletes a flight */
flightsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const existing = await prisma.flight.findUnique({ where: { id } });
      if (!existing) {
        throw new HttpError(404, "Flight not found");
      }

      // Delete dependent records before deleting the flight (FK constraints)
      // 1. Find booking IDs for this flight
      const bookings = await prisma.booking.findMany({ where: { flightId: id }, select: { id: true } });
      const bookingIds = bookings.map((b) => b.id);
      // 2. Delete in FK order
      if (bookingIds.length > 0) {
        await prisma.ticket.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await prisma.seat.deleteMany({ where: { flightId: id } });
      await prisma.crewAssignment.deleteMany({ where: { flightId: id } });
      await prisma.flight.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
