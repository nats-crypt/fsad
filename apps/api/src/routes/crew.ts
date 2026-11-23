import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@horizon/db";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { validate } from "../lib/validate.js";

export const crewRouter = Router();

const writeGuard = [requireAuth, requireRole("ADMIN", "STAFF")];

const createCrewSchema = z.object({
  flightId: z.string().min(1),
  employeeId: z.string().min(1),
  role: z.string().min(1),
});

/** POST /api/crew — assign an employee to a flight */
crewRouter.post(
  "/",
  ...writeGuard,
  validate(createCrewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId, employeeId, role } = req.body as z.infer<typeof createCrewSchema>;

      const assignment = await prisma.crewAssignment.create({
        data: { flightId, employeeId, role },
        include: {
          employee: { select: { id: true, fullName: true, empCode: true, designation: true } },
        },
      });

      res.status(201).json(assignment);
    } catch (err: unknown) {
      // Prisma unique constraint violation → 409
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        next(new HttpError(409, "Employee is already assigned to this flight"));
        return;
      }
      // Prisma FK not found → 422
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        next(new HttpError(422, "Invalid flightId or employeeId"));
        return;
      }
      next(err);
    }
  }
);

/** GET /api/crew?flightId=... — list crew assignments; flightId is optional */
crewRouter.get(
  "/",
  ...writeGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId } = req.query;

      const assignments = await prisma.crewAssignment.findMany({
        where: {
          ...(flightId && typeof flightId === "string" ? { flightId } : {}),
        },
        include: {
          employee: { select: { id: true, fullName: true, empCode: true, designation: true } },
          flight: { select: { flightNo: true } },
        },
        orderBy: { id: "asc" },
      });

      res.json(assignments);
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /api/crew/:id — remove a crew assignment */
crewRouter.delete(
  "/:id",
  ...writeGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.crewAssignment.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        throw new HttpError(404, "Crew assignment not found");
      }

      await prisma.crewAssignment.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
