import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { HttpError } from "./lib/http-error.js";
import { authRouter } from "./routes/auth.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: process.env.CLIENT_URL ?? "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Mount routers
  app.use("/api/auth", authRouter);

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
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}
