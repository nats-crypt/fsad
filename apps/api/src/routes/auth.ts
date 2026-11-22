import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { signToken, requireAuth } from "../lib/auth.js";
import { validate } from "../lib/validate.js";
import { HttpError } from "../lib/http-error.js";
import { encrypt, decrypt } from "../lib/crypto.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  dob: z.string().optional(),            // YYYY-MM-DD
  nationality: z.string().optional(),
  passportNo: z.string().optional(),     // encrypted at rest
  address: z.string().optional(),
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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/** Mask passport number for safe display (e.g. "A1234567" → "A****567") */
function maskPassport(plain: string): string {
  if (plain.length <= 4) return "****";
  return plain[0] + "*".repeat(plain.length - 4) + plain.slice(-3);
}

/** POST /api/auth/register */
authRouter.post(
  "/register",
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, fullName, phone, dob, nationality, passportNo, address } =
        req.body as z.infer<typeof registerSchema>;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new HttpError(409, "Email already registered");

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
              dob: dob ? new Date(dob) : null,
              nationality: nationality ?? null,
              passportEnc: passportNo ? encrypt(passportNo) : null,
              address: address ?? null,
            },
          },
        },
        select: { id: true, email: true, role: true, createdAt: true },
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
      if (!user) throw new HttpError(401, "Invalid email or password");

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new HttpError(401, "Invalid email or password");

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
        select: { id: true, email: true, role: true, createdAt: true },
      });
      if (!user) throw new HttpError(404, "User not found");
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/auth/profile — returns passenger details + preferences (passport masked) */
authRouter.get(
  "/profile",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const passenger = await prisma.passenger.findUnique({
        where: { userId: req.user!.id },
      });
      if (!passenger) throw new HttpError(404, "Passenger profile not found");

      // Decrypt passport for display but mask it — never return raw plaintext
      const passportMasked = passenger.passportEnc
        ? maskPassport(decrypt(passenger.passportEnc))
        : null;

      const { passportEnc: _, ...rest } = passenger;
      res.json({ ...rest, passportMasked });
    } catch (err) {
      next(err);
    }
  }
);

const profileSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  passportNo: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  preferences: z
    .object({
      meal: z.string().optional(),
      seatPref: z.string().optional(),
      assistance: z.string().optional(),
    })
    .optional(),
});

/** PATCH /api/auth/profile — update passenger details + preferences */
authRouter.patch(
  "/profile",
  requireAuth,
  validate(profileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fullName, phone, dob, nationality, passportNo, address, preferences } =
        req.body as z.infer<typeof profileSchema>;

      const existing = await prisma.passenger.findUnique({
        where: { userId: req.user!.id },
      });
      if (!existing) throw new HttpError(404, "Passenger profile not found");

      const updated = await prisma.passenger.update({
        where: { userId: req.user!.id },
        data: {
          ...(fullName !== undefined && { fullName }),
          ...(phone !== undefined && { phone }),
          ...(dob !== undefined && { dob: dob ? new Date(dob) : null }),
          ...(nationality !== undefined && { nationality }),
          ...(passportNo !== undefined && {
            passportEnc: passportNo ? encrypt(passportNo) : null,
          }),
          ...(address !== undefined && { address }),
          ...(preferences !== undefined && { preferences }),
        },
      });

      const passportMasked = updated.passportEnc
        ? maskPassport(decrypt(updated.passportEnc))
        : null;
      const { passportEnc: _, ...rest } = updated;
      res.json({ ...rest, passportMasked });
    } catch (err) {
      next(err);
    }
  }
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** POST /api/auth/change-password */
authRouter.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new HttpError(404, "User not found");

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw new HttpError(400, "Current password is incorrect");

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(newPassword, 10) },
      });
      res.json({ message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  }
);

const forgotSchema = z.object({ email: z.string().email() });

/** POST /api/auth/forgot-password — generates a reset token (shown in response for demo; in prod, email it) */
authRouter.post(
  "/forgot-password",
  validate(forgotSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body as z.infer<typeof forgotSchema>;
      const user = await prisma.user.findUnique({ where: { email } });

      // Always respond 200 to avoid email enumeration
      if (!user) {
        res.json({ message: "If that email exists, a reset token has been generated." });
        return;
      }

      // Invalidate any existing unused tokens
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      // In production this would be emailed. For demo/dev we return it directly.
      res.json({
        message: "Reset token generated. In production this would be emailed.",
        resetToken: rawToken,
        expiresIn: "15 minutes",
      });
    } catch (err) {
      next(err);
    }
  }
);

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

/** POST /api/auth/reset-password */
authRouter.post(
  "/reset-password",
  validate(resetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body as z.infer<typeof resetSchema>;
      const tokenHash = createHash("sha256").update(token).digest("hex");

      const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

      if (!record || record.used || record.expiresAt < new Date()) {
        throw new HttpError(400, "Reset token is invalid or has expired");
      }

      await prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await bcrypt.hash(newPassword, 10) },
      });

      await prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { used: true },
      });

      res.json({ message: "Password reset successfully. You can now log in." });
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
