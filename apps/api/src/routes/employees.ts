import { z } from "zod";
import { prisma } from "@horizon/db";
import { makeCrudRouter } from "../lib/crud.js";

const employeeSchema = z.object({
  empCode: z.string().min(1),
  fullName: z.string().min(1),
  designation: z.string().min(1),
  dutyArea: z.string().optional(),
  salary: z.coerce.number().optional().default(0),
  contact: z.string().optional(),
});

export const employeesRouter = makeCrudRouter(
  prisma.employee,
  employeeSchema,
  { roles: ["ADMIN", "STAFF"] }
);
