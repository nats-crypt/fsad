import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http-error.js";

export interface JwtPayload {
  id: string;
  role: string;
}

// Extend Express Request to carry user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (req.cookies?.token) {
      token = req.cookies.token as string;
    }

    if (!token) {
      throw new HttpError(401, "Authentication required");
    }

    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      next(err);
    } else {
      next(new HttpError(401, "Invalid or expired token"));
    }
  }
}

export function requireRole(...roles: string[]) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "Forbidden: insufficient permissions"));
      return;
    }
    next();
  };
}
