import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../lib/validate.js";

export const dutyRouter = Router();

const authGuard = [requireAuth, requireRole("ADMIN", "STAFF")];

const createDutySchema = z.object({
  employeeId: z.string(),
  dutyArea: z.string(),
  startAt: z.string().datetime(),
});

/** POST /api/duty — start a duty report */
dutyRouter.post(
  "/",
  ...authGuard,
  validate(createDutySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId, dutyArea, startAt } = req.body as z.infer<typeof createDutySchema>;

      const report = await prisma.dutyReport.create({
        data: {
          employeeId,
          dutyArea,
          startAt: new Date(startAt),
        },
      });

      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/duty/:id/end — end a duty report */
dutyRouter.post(
  "/:id/end",
  ...authGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const existing = await prisma.dutyReport.findUnique({ where: { id } });
      if (!existing) {
        throw new HttpError(404, "Duty report not found");
      }

      const report = await prisma.dutyReport.update({
        where: { id },
        data: { endAt: new Date() },
      });

      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/duty — list duty reports with optional employeeId filter */
dutyRouter.get(
  "/",
  ...authGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = req.query;

      const reports = await prisma.dutyReport.findMany({
        where: {
          ...(employeeId && typeof employeeId === "string" ? { employeeId } : {}),
        },
        include: {
          employee: { select: { fullName: true, empCode: true } },
        },
        orderBy: { startAt: "desc" },
      });

      res.json(reports);
    } catch (err) {
      next(err);
    }
  }
);
