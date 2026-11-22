import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { validate } from "../lib/validate.js";
import { getProvider } from "../ai/provider.js";
import type { ParsedSearch } from "../ai/provider.js";

export const aiSearchRouter = Router();

const searchBodySchema = z.object({
  text: z.string().min(1),
});

/** Time-of-day hour ranges in IST (UTC+5:30) */
const TIME_RANGES: Record<string, [number, number]> = {
  MORNING: [5, 12],
  AFTERNOON: [12, 17],
  EVENING: [17, 21],
  NIGHT: [21, 24],
};

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function matchesTimeOfDay(
  departAt: Date,
  timeOfDay: ParsedSearch["timeOfDay"]
): boolean {
  if (!timeOfDay) return true;
  // Convert UTC to IST before checking hour ranges
  const istMinutes = departAt.getUTCHours() * 60 + departAt.getUTCMinutes() + IST_OFFSET_MINUTES;
  const hour = Math.floor((istMinutes % (24 * 60)) / 60);

  if (timeOfDay === "NIGHT") {
    return hour >= 21 || hour < 5;
  }

  const [start, end] = TIME_RANGES[timeOfDay];
  return hour >= start && hour < end;
}

/** POST /api/ai/search { text } → { parsed, flights } */
aiSearchRouter.post(
  "/",
  validate(searchBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { text } = req.body as z.infer<typeof searchBodySchema>;

      const provider = getProvider();
      const parsed = await provider.parseSearch(text);

      // Build Prisma where clause from parsed params
      type WhereClause = Parameters<typeof prisma.flight.findMany>[0] extends
        | { where?: infer W }
        | undefined
        ? W
        : never;

      const where: WhereClause = {
        status: { not: "CANCELLED" as const },
      };

      if (parsed.origin) {
        where.origin = { code: parsed.origin };
      }
      if (parsed.destination) {
        where.destination = { code: parsed.destination };
      }
      if (parsed.dateFrom || parsed.dateTo) {
        where.departAt = {};
        if (parsed.dateFrom) {
          (where.departAt as { gte?: Date; lte?: Date }).gte = new Date(
            `${parsed.dateFrom}T00:00:00.000Z`
          );
        }
        if (parsed.dateTo) {
          (where.departAt as { gte?: Date; lte?: Date }).lte = new Date(
            `${parsed.dateTo}T23:59:59.999Z`
          );
        }
      }

      let flights = await prisma.flight.findMany({
        where,
        include: {
          origin: true,
          destination: true,
          aircraft: true,
        },
        orderBy: { departAt: "asc" },
        take: 50,
      });

      // Apply time-of-day filter in JS (UTC hour)
      if (parsed.timeOfDay) {
        flights = flights.filter((f) =>
          matchesTimeOfDay(f.departAt, parsed.timeOfDay)
        );
      }

      // Apply sort
      if (parsed.sort === "CHEAPEST") {
        flights.sort((a, b) => Number(a.baseFare) - Number(b.baseFare));
      } else if (parsed.sort === "FASTEST") {
        flights.sort(
          (a, b) =>
            a.arriveAt.getTime() -
            a.departAt.getTime() -
            (b.arriveAt.getTime() - b.departAt.getTime())
        );
      } else if (parsed.sort === "EARLIEST") {
        flights.sort((a, b) => a.departAt.getTime() - b.departAt.getTime());
      }

      const result = flights.map((f) => ({
        id: f.id,
        flightNo: f.flightNo,
        origin: {
          code: f.origin.code,
          city: f.origin.city,
          name: f.origin.name,
        },
        destination: {
          code: f.destination.code,
          city: f.destination.city,
          name: f.destination.name,
        },
        departAt: f.departAt,
        arriveAt: f.arriveAt,
        baseFare: Number(f.baseFare),
        capacity: f.capacity,
        seatsBooked: f.seatsBooked,
        seatsLeft: f.capacity - f.seatsBooked,
        status: f.status,
        aircraft: {
          model: f.aircraft.model,
          registration: f.aircraft.registration,
        },
      }));

      res.json({ parsed, flights: result });
    } catch (err) {
      next(err);
    }
  }
);
