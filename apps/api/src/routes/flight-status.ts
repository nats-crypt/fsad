import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "@horizon/db";
import { fetchFlightStatus } from "../lib/aviationstack.js";

export const flightStatusRouter = Router();

/** GET /api/flight-status/:flightNo
 *  Returns real-time status from AviationStack merged with our DB record.
 *  Falls back to DB-only data when AVIATIONSTACK_KEY is not set.
 */
flightStatusRouter.get(
  "/:flightNo",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flightNo = req.params.flightNo.toUpperCase();

      // Always fetch our DB record
      const dbFlight = await prisma.flight.findFirst({
        where: { flightNo: { contains: flightNo } },
        include: { origin: true, destination: true, aircraft: true },
        orderBy: { departAt: "desc" },
      });

      // Try live data
      const live = await fetchFlightStatus(flightNo);

      if (live.available && live.flight) {
        res.json({
          source: "live",
          flightNo: live.flight.flightNo,
          airline: live.flight.airline,
          status: live.flight.status,
          departure: live.flight.departure,
          arrival: live.flight.arrival,
          aircraft: live.flight.aircraft,
          livePosition: live.flight.live,
          // Enrich with our DB booking data if we have it
          dbRecord: dbFlight
            ? {
                id: dbFlight.id,
                status: dbFlight.status,
                seatsBooked: dbFlight.seatsBooked,
                capacity: dbFlight.capacity,
              }
            : null,
        });
        return;
      }

      // Fallback: return DB data only
      if (dbFlight) {
        res.json({
          source: "db",
          flightNo: dbFlight.flightNo,
          airline: "Horizon Airways",
          status: dbFlight.status.toLowerCase(),
          departure: {
            airport: dbFlight.origin.name ?? dbFlight.origin.city,
            iata: dbFlight.origin.code,
            scheduled: dbFlight.departAt.toISOString(),
            estimated: null,
            actual: null,
            delay: null,
            gate: null,
            terminal: null,
          },
          arrival: {
            airport: dbFlight.destination.name ?? dbFlight.destination.city,
            iata: dbFlight.destination.code,
            scheduled: dbFlight.arriveAt.toISOString(),
            estimated: null,
            actual: null,
            delay: null,
            gate: null,
            terminal: null,
          },
          aircraft: { registration: dbFlight.aircraft.registration, model: dbFlight.aircraft.model },
          livePosition: null,
          message: live.message,
        });
        return;
      }

      res.status(404).json({ error: "Flight not found", message: live.message });
    } catch (err) {
      next(err);
    }
  }
);
