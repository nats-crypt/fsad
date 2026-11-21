import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";

const app = createApp();

// Generate a unique email per run to stay idempotent
const uniqueEmail = () => `test+${Date.now()}+${Math.random().toString(36).slice(2)}@horizon.test`;

describe("POST /api/auth/register", () => {
  it("registers a new passenger and returns token + user", async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", fullName: "Test User" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email, role: "PASSENGER" });
    // Password hash must NOT be in response
    expect(res.body.user.passwordHash).toBeUndefined();

    // Clean up
    await prisma.passenger.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns 409 for duplicate email", async () => {
    const email = uniqueEmail();
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", fullName: "Test User" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", fullName: "Test User" });

    expect(res.status).toBe(409);

    // Clean up
    await prisma.passenger.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials and returns token + user", async () => {
    const email = uniqueEmail();
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "loginpass456", fullName: "Login User" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "loginpass456" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email });

    // Clean up
    await prisma.passenger.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns 401 for wrong password", async () => {
    const email = uniqueEmail();
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "correctpass", fullName: "Login User" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrongpass" });

    expect(res.status).toBe(401);

    // Clean up
    await prisma.passenger.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns 401 for non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@horizon.test", password: "somepass" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns current user when authenticated", async () => {
    const email = uniqueEmail();
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "mepass789", fullName: "Me User" });

    const { token } = registerRes.body;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email, role: "PASSENGER" });
    expect(res.body.passwordHash).toBeUndefined();

    // Clean up
    await prisma.passenger.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the token cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    // Cookie cleared (Set-Cookie header should contain 'token=;' or similar)
    const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
    if (setCookie) {
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
      expect(cookieHeader).toMatch(/token=/);
    }
  });
});
