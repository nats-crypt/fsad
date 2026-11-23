import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../lib/validate.js";

export const flightsRouter = Router();

const searchSchema = z.object({
  origin: z.string().min(2).max(5).toUpperCase().optional(),
  destination: z.string().min(2).max(5).toUpperCase().optional(),
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

      // Whole-day range in IST (UTC+5:30) — seed data is stored in local IST time
      const dayStart = new Date(`${date}T00:00:00.000+05:30`);
      const dayEnd = new Date(`${date}T23:59:59.999+05:30`);

      const now = new Date();
      // For today's search, hide flights that have already departed
      const departFrom = dayStart <= now ? now : dayStart;

      const flights = await prisma.flight.findMany({
        where: {
          ...(origin ? { origin: { code: origin } } : {}),
          ...(destination ? { destination: { code: destination } } : {}),
          departAt: { gte: departFrom, lte: dayEnd },
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

/** GET /api/flights/board — all upcoming and currently in-flight Horizon flights */
flightsRouter.get(
  "/board",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const horizon = new Date(now.getTime() + 72 * 60 * 60 * 1000); // next 72 h

      const flights = await prisma.flight.findMany({
        where: {
          status: { in: ["SCHEDULED", "DEPARTED"] },
          departAt: { lte: horizon },
          arriveAt: { gte: now }, // not yet landed
        },
        include: { origin: true, destination: true, aircraft: true },
        orderBy: { departAt: "asc" },
      });

      res.json(
        flights.map((f) => ({
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
        }))
      );
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/flights/all — admin: list every flight (no search params required) */
flightsRouter.get(
  "/all",
  requireAuth,
  requireRole("ADMIN", "STAFF"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const flights = await prisma.flight.findMany({
        include: { origin: true, destination: true, aircraft: true },
        orderBy: { departAt: "asc" },
      });

      res.json(
        flights.map((f) => ({
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
        }))
      );
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
          fare: Math.round(Number(flight.baseFare) * (s.cabinClass === "FIRST" ? 3 : s.cabinClass === "BUSINESS" ? 2 : 1)),
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Seat generation helper ─────────────────────────────────────────────────

/**
 * Generates seat records for a flight.
 * Row 1       → FIRST (premium rows at the front)
 * Rows 2–3    → BUSINESS
 * Rows 4+     → ECONOMY
 * #1: assigns FIRST|BUSINESS|ECONOMY cabin classes so GET /api/flights/:id
 * returns all three classes for frontend cabin-class filtering.
 */
function buildSeatData(
  flightId: string,
  capacity: number
): Array<{ flightId: string; seatNo: string; cabinClass: string; status: string }> {
  const columns = ["A", "B", "C", "D", "E", "F"];
  const totalRows = Math.ceil(capacity / 6);
  const seats: Array<{ flightId: string; seatNo: string; cabinClass: string; status: string }> = [];

  let count = 0;
  for (let row = 1; row <= totalRows && count < capacity; row++) {
    const cabinClass = row === 1 ? "FIRST" : row <= 3 ? "BUSINESS" : "ECONOMY";
    for (const col of columns) {
      if (count >= capacity) break;
      seats.push({ flightId, seatNo: `${row}${col}`, cabinClass, status: "AVAILABLE" });
      count++;
    }
  }

  return seats;
}

// ─── Admin writes ────────────────────────────────────────────────────────────

/**
 * #3: Admin flight-create/update accepts either airport UUIDs (originId/destinationId)
 * or IATA codes (originCode/destinationCode). At least one of each pair is required
 * for POST; both are optional for PUT (partial update).
 */
const createFlightSchema = z
  .object({
    flightNo: z.string().min(1),
    originId: z.string().optional(),
    originCode: z.string().min(2).max(5).optional(),
    destinationId: z.string().optional(),
    destinationCode: z.string().min(2).max(5).optional(),
    aircraftId: z.string().min(1),
    departAt: z.string().datetime(),
    arriveAt: z.string().datetime(),
    baseFare: z.union([z.string(), z.number()]).transform((v) => Number(v)),
    capacity: z.coerce.number().int().positive(),
    status: z.enum(["SCHEDULED", "DEPARTED", "ARRIVED", "CANCELLED"]).optional().default("SCHEDULED"),
  })
  .refine((d) => d.originId || d.originCode, {
    message: "originId or originCode is required",
  })
  .refine((d) => d.destinationId || d.destinationCode, {
    message: "destinationId or destinationCode is required",
  });

const updateFlightSchema = z.object({
  flightNo: z.string().min(1).optional(),
  originId: z.string().optional(),
  originCode: z.string().min(2).max(5).optional(),
  destinationId: z.string().optional(),
  destinationCode: z.string().min(2).max(5).optional(),
  aircraftId: z.string().optional(),
  departAt: z.string().datetime().optional(),
  arriveAt: z.string().datetime().optional(),
  baseFare: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .optional(),
  capacity: z.coerce.number().int().positive().optional(),
  status: z.enum(["SCHEDULED", "DEPARTED", "ARRIVED", "CANCELLED"]).optional(),
});

/**
 * Resolves an airport by id or IATA code. Returns the airport id.
 * Throws HttpError 404 if the airport cannot be found.
 */
async function resolveAirportId(
  id: string | undefined,
  code: string | undefined,
  label: string
): Promise<string | undefined> {
  if (id) return id;
  if (code) {
    const airport = await prisma.airport.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!airport) {
      throw new HttpError(404, `Airport with IATA code '${code.toUpperCase()}' not found (${label})`);
    }
    return airport.id;
  }
  return undefined;
}

/** POST /api/flights — admin creates a flight and generates seats */
flightsRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validate(createFlightSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createFlightSchema>;
      const { flightNo, aircraftId, departAt, arriveAt, baseFare, capacity, status } = body;

      // #3: resolve originId/destinationId from code if only code was supplied
      const originId = await resolveAirportId(body.originId, body.originCode, "origin");
      const destinationId = await resolveAirportId(body.destinationId, body.destinationCode, "destination");

      if (!originId) throw new HttpError(400, "originId or originCode is required");
      if (!destinationId) throw new HttpError(400, "destinationId or destinationCode is required");

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

      // Generate seat records with FIRST/BUSINESS/ECONOMY cabin classes
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

      // #3: resolve airport codes if provided
      const originId = await resolveAirportId(body.originId, body.originCode, "origin");
      const destinationId = await resolveAirportId(body.destinationId, body.destinationCode, "destination");

      // Build the update payload — omit code fields; replace with resolved ids
      const { originId: _oId, originCode: _oCode, destinationId: _dId, destinationCode: _dCode, ...rest } = body;
      const data: Record<string, unknown> = { ...rest };
      if (originId) data.originId = originId;
      if (destinationId) data.destinationId = destinationId;
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
      await prisma.paymentOrder.deleteMany({ where: { flightId: id } });
      await prisma.seat.deleteMany({ where: { flightId: id } });
      await prisma.crewAssignment.deleteMany({ where: { flightId: id } });
      await prisma.flight.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
