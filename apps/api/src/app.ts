import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { HttpError } from "./lib/http-error.js";
import { authRouter } from "./routes/auth.js";
import { flightsRouter } from "./routes/flights.js";
import { flightsLiveRouter } from "./routes/flights-live.js";
import { paymentsRouter } from "./routes/payments.js";
import { bookingsRouter } from "./routes/bookings.js";
import { aircraftRouter } from "./routes/aircraft.js";
import { employeesRouter } from "./routes/employees.js";
import { crewRouter } from "./routes/crew.js";
import { attendanceRouter } from "./routes/attendance.js";
import { dutyRouter } from "./routes/duty.js";
import { reportsRouter } from "./routes/reports.js";
import { aiSearchRouter } from "./routes/ai-search.js";
import { aiOptimizerRouter } from "./routes/ai-optimizer.js";
import { aiFareRouter } from "./routes/ai-fare.js";
import { aiRebookingRouter } from "./routes/ai-rebooking.js";
import { isMailConfigured, sendMail } from "./lib/mailer.js";
import { flightStatusRouter } from "./routes/flight-status.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: [
        process.env.CLIENT_URL ?? "http://localhost:5173",
        "https://fsad-production.up.railway.app",
      ],
      credentials: true,
    })
  );
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, mail: isMailConfigured() });
  });

  // Mail test (dev/debug only)
  app.get("/api/health/mail-test", async (_req: Request, res: Response, next: NextFunction) => {
    if (!isMailConfigured()) {
      return res.json({ ok: false, reason: "RESEND_API_KEY not set" });
    }
    try {
      const to = process.env.RESEND_FROM_EMAIL ?? "test@horizon.air";
      const sent = await sendMail({ to, subject: "Horizon Airways — Mail Test", html: "<p>Mail is working!</p>" });
      res.json({ ok: sent, to });
    } catch (err) {
      next(err);
    }
  });

  // Mount routers
  app.use("/api/auth", authRouter);
  app.use("/api/flights/live", flightsLiveRouter);
  app.use("/api/flights", flightsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/aircraft", aircraftRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/crew", crewRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/duty", dutyRouter);
  app.use("/api/reports", reportsRouter);

  // AI feature routes
  app.use("/api/ai/search", aiSearchRouter);
  app.use("/api/ai/optimizer", aiOptimizerRouter);
  app.use("/api/ai/fare-forecast", aiFareRouter);
  app.use("/api/ai/rebooking", aiRebookingRouter);

  // Real-time flight status (AviationStack + DB fallback)
  app.use("/api/flight-status", flightStatusRouter);

  // Serve the built frontend (single-process mode) when apps/web/dist exists.
  // Non-/api GET requests fall back to index.html for client-side routing.
  const here = dirname(fileURLToPath(import.meta.url));
  const webDist = resolve(here, "../../web/dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
      res.sendFile(join(webDist, "index.html"));
    });
  }

  // Central error middleware (must be last, 4-arg signature)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ message: "Validation error", issues: err.issues });
      return;
    }
    // Prisma: record not found → 404
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ message: "Record not found" });
      return;
    }
    // Prisma: unique constraint violated → 409
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const field = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      res.status(409).json({ message: `Duplicate value for ${field}` });
      return;
    }
    // Prisma: FK constraint (related record missing) → 422
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      res.status(422).json({ message: "Related record not found" });
      return;
    }
    // Prisma connection / query failures
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[Prisma]", err.code, err.message);
      res.status(500).json({ message: "Database error" });
      return;
    }
    console.error("[Unhandled]", err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}
