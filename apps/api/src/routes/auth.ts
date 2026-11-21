import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { signToken, requireAuth } from "../lib/auth.js";
import { validate } from "../lib/validate.js";
import { HttpError } from "../lib/http-error.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setTokenCookie(res: Response, token: string) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/** POST /api/auth/register */
authRouter.post(
  "/register",
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, fullName, phone } = req.body as z.infer<typeof registerSchema>;

      // Check for duplicate email
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new HttpError(409, "Email already registered");
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: "PASSENGER",
          passenger: {
            create: {
              fullName,
              phone: phone ?? null,
            },
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      const token = signToken({ id: user.id, role: user.role });
      setTokenCookie(res, token);

      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/auth/login */
authRouter.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new HttpError(401, "Invalid email or password");
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new HttpError(401, "Invalid email or password");
      }

      const token = signToken({ id: user.id, role: user.role });
      setTokenCookie(res, token);

      const { passwordHash: _pw, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/auth/me */
authRouter.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new HttpError(404, "User not found");
      }

      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/auth/logout */
authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});
