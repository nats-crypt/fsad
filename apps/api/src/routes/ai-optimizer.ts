import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "@horizon/db";
import { requireAuth, requireRole } from "../lib/auth.js";
import { optimizeFlights } from "../ai/optimizer.js";

export const aiOptimizerRouter = Router();

/** GET /api/ai/optimizer — returns optimizer analysis of upcoming flights (ADMIN or STAFF only) */
aiOptimizerRouter.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "STAFF"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();

      const flights = await prisma.flight.findMany({
        where: {
          departAt: { gte: now },
          status: { not: "CANCELLED" },
        },
        orderBy: { departAt: "asc" },
        take: 50,
      });

      // Aggregate crew counts per flight
      const crewAgg = await prisma.crewAssignment.groupBy({
        by: ["flightId"],
        where: { flightId: { in: flights.map((f) => f.id) } },
        _count: { flightId: true },
      });

      const crewCounts: Record<string, number> = Object.fromEntries(
        crewAgg.map((c) => [c.flightId, c._count.flightId])
      );

      const results = optimizeFlights(flights, crewCounts);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
);
