import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../lib/validate.js";

export const attendanceRouter = Router();

const authGuard = [requireAuth, requireRole("ADMIN", "STAFF")];

const markAttendanceSchema = z.object({
  employeeId: z.string(),
  type: z.enum(["IN", "OUT"]),
});

/** POST /api/attendance/mark — mark check-in or check-out for an employee */
attendanceRouter.post(
  "/mark",
  ...authGuard,
  validate(markAttendanceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId, type } = req.body as z.infer<typeof markAttendanceSchema>;
      const now = new Date();
      const date = new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");

      const record = await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId, date } },
        create: {
          employeeId,
          date,
          checkIn: type === "IN" ? now : undefined,
          checkOut: type === "OUT" ? now : undefined,
        },
        update: {
          checkIn: type === "IN" ? now : undefined,
          checkOut: type === "OUT" ? now : undefined,
        },
      });

      res.json(record);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/attendance — list attendance records with optional filters */
attendanceRouter.get(
  "/",
  ...authGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId, from, to } = req.query;

      // Build date filter
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (from && typeof from === "string") {
        dateFilter.gte = new Date(from);
      }
      if (to && typeof to === "string") {
        dateFilter.lte = new Date(to);
      }

      const records = await prisma.attendance.findMany({
        where: {
          ...(employeeId && typeof employeeId === "string" ? { employeeId } : {}),
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
        include: {
          employee: { select: { fullName: true, empCode: true } },
        },
        orderBy: { date: "desc" },
      });

      res.json(records);
    } catch (err) {
      next(err);
    }
  }
);
