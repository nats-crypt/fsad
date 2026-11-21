import { z } from "zod";
import { prisma } from "@horizon/db";
import { makeCrudRouter } from "../lib/crud.js";

const aircraftSchema = z.object({
  registration: z.string().min(1),
  model: z.string().min(1),
  capacity: z.coerce.number().int().positive(),
  status: z.string().optional().default("ACTIVE"),
});

export const aircraftRouter = makeCrudRouter(
  prisma.aircraft,
  aircraftSchema,
  { roles: ["ADMIN", "STAFF"] }
);
