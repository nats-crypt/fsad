import request from "supertest";
import express from "express";
import { signToken } from "../lib/auth.js";
import { requireAuth, requireRole } from "../lib/auth.js";

function makeApp(handler: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.get("/test", handler);
  return app;
}

describe("requireAuth", () => {
  it("sets req.user with a valid Bearer token", async () => {
    const token = signToken({ id: "user-1", role: "PASSENGER" });
    const app = makeApp((req, res) => {
      res.json((req as unknown as { user: unknown }).user);
    });

    const mw = express();
    mw.use(express.json());
    mw.get("/test", requireAuth, (req, res) => {
      res.json((req as unknown as { user: unknown }).user);
    });

    const res = await request(mw)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "user-1", role: "PASSENGER" });
  });

  it("returns 401 without a token", async () => {
    const app = express();
    app.use(express.json());
    app.get("/test", requireAuth, (_req, res) => res.json({ ok: true }));
    // Error handler
    app.use(
      (
        err: { status?: number; message: string },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(err.status ?? 500).json({ message: err.message });
      }
    );

    const res = await request(app).get("/test");
    expect(res.status).toBe(401);
  });
});

describe("requireRole", () => {
  it("returns 401 when no token is provided", async () => {
    const app = express();
    app.use(express.json());
    app.get("/test", requireAuth, requireRole("ADMIN"), (_req, res) =>
      res.json({ ok: true })
    );
    app.use(
      (
        err: { status?: number; message: string },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(err.status ?? 500).json({ message: err.message });
      }
    );

    const res = await request(app).get("/test");
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has PASSENGER role but ADMIN is required", async () => {
    const token = signToken({ id: "user-2", role: "PASSENGER" });

    const app = express();
    app.use(express.json());
    app.get("/test", requireAuth, requireRole("ADMIN"), (_req, res) =>
      res.json({ ok: true })
    );
    app.use(
      (
        err: { status?: number; message: string },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(err.status ?? 500).json({ message: err.message });
      }
    );

    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("allows access when role matches", async () => {
    const token = signToken({ id: "user-3", role: "ADMIN" });

    const mw = express();
    mw.use(express.json());
    mw.get("/test", requireAuth, requireRole("ADMIN"), (_req, res) =>
      res.json({ ok: true })
    );
    mw.use(
      (
        err: { status?: number; message: string },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(err.status ?? 500).json({ message: err.message });
      }
    );

    const res = await request(mw)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
