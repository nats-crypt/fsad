import { Router, type Request, type Response, type NextFunction } from "express";
import type { ZodSchema } from "zod";
import { requireAuth, requireRole } from "./auth.js";
import { validate } from "./validate.js";
import { HttpError } from "./http-error.js";

/**
 * Minimal interface that covers any Prisma model delegate we need:
 * findMany, findUnique, create, update, delete.
 */
interface ModelDelegate {
  findMany(args?: object): Promise<unknown[]>;
  findUnique(args: { where: { id: string } }): Promise<unknown | null>;
  create(args: { data: unknown }): Promise<unknown>;
  update(args: { where: { id: string }; data: unknown }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
}

interface CrudOptions {
  /** Roles allowed to perform write operations (POST, PUT, DELETE) */
  roles: string[];
}

/**
 * Creates a generic Express router with standard CRUD endpoints:
 *
 *   GET    /          list all records
 *   GET    /:id       get one record (404 if not found)
 *   POST   /          create (requires auth + role)
 *   PUT    /:id       update (requires auth + role; 404 if not found)
 *   DELETE /:id       delete (requires auth + role; 404 if not found)
 */
export function makeCrudRouter(
  modelDelegate: ModelDelegate,
  zodSchema: ZodSchema,
  options: CrudOptions
): Router {
  const router = Router();
  const writeGuard = [requireAuth, requireRole(...options.roles)];

  // GET / — list all
  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const records = await modelDelegate.findMany();
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id — get one
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await modelDelegate.findUnique({ where: { id: req.params.id } });
      if (!record) {
        throw new HttpError(404, "Record not found");
      }
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  // POST / — create
  router.post(
    "/",
    ...writeGuard,
    validate(zodSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const record = await modelDelegate.create({ data: req.body as unknown });
        res.status(201).json(record);
      } catch (err) {
        next(err);
      }
    }
  );

  // PUT /:id — update
  router.put(
    "/:id",
    ...writeGuard,
    validate((zodSchema as any).partial?.() ?? zodSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await modelDelegate.findUnique({ where: { id: req.params.id } });
        if (!existing) {
          throw new HttpError(404, "Record not found");
        }
        const record = await modelDelegate.update({
          where: { id: req.params.id },
          data: req.body as unknown,
        });
        res.json(record);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /:id — delete
  router.delete(
    "/:id",
    ...writeGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await modelDelegate.findUnique({ where: { id: req.params.id } });
        if (!existing) {
          throw new HttpError(404, "Record not found");
        }
        await modelDelegate.delete({ where: { id: req.params.id } });
        res.json({ message: "Deleted" });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
