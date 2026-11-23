import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { requireAuth } from "../lib/auth.js";
import { validate } from "../lib/validate.js";
import { HttpError } from "../lib/http-error.js";
import { getPaymentProvider } from "../payments/provider.js";

export const paymentsRouter = Router();

const orderSchema = z.object({
  flightId: z.string().min(1),
  // Accept either a single seat (legacy) or an array for multi-passenger
  seatNo: z.string().min(1).optional(),
  seats: z.array(z.string().min(1)).min(1).max(9).optional(),
}).refine(d => d.seatNo || (d.seats && d.seats.length > 0), {
  message: "seatNo or seats[] is required",
});

/** POST /api/payments/order — creates a payment order for one or more seats */
paymentsRouter.post(
  "/order",
  requireAuth,
  validate(orderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId, seatNo, seats: seatsInput } = req.body as z.infer<typeof orderSchema>;
      const userId = req.user!.id;

      // Normalise to an array — single-seat legacy path and multi-seat path unified
      const seatNos: string[] = seatsInput ?? (seatNo ? [seatNo] : []);

      const flight = await prisma.flight.findUnique({ where: { id: flightId } });
      if (!flight) throw new HttpError(404, "Flight not found");

      // Look up all requested seats
      const seatRows = await prisma.seat.findMany({
        where: { flightId, seatNo: { in: seatNos } },
      });

      if (seatRows.length !== seatNos.length) {
        throw new HttpError(404, "One or more seats not found");
      }

      const unavailable = seatRows.filter(s => s.status !== "AVAILABLE");
      if (unavailable.length > 0) {
        throw new HttpError(409, `Seat(s) not available: ${unavailable.map(s => s.seatNo).join(", ")}`);
      }

      // Per-seat fares
      const seatFares = seatRows.map(s => {
        const multiplier = s.cabinClass === "FIRST" ? 3 : s.cabinClass === "BUSINESS" ? 2 : 1;
        return { seatNo: s.seatNo, fare: Math.round(Number(flight.baseFare) * multiplier) };
      });

      const totalFare = seatFares.reduce((sum, s) => sum + s.fare, 0);
      const amountPaise = totalFare * 100;

      const provider = getPaymentProvider();
      const receipt = `rcpt_${flightId.slice(0, 8)}_${seatNos.join("-").slice(0, 20)}`;
      const order = await provider.createOrder(amountPaise, "INR", receipt);

      // Store order — seatNo is the first seat for legacy compat; seatsJson has all seats+fares
      await prisma.paymentOrder.create({
        data: {
          orderId: order.orderId,
          flightId,
          seatNo: seatNos[0],
          seatsJson: seatFares,
          amount: totalFare,
          userId,
        },
      });

      res.json({
        orderId: order.orderId,
        amount: order.amount, // paise
        currency: order.currency,
        keyId: order.keyId ?? null,
        provider: provider.name,
        seats: seatFares, // let frontend show per-seat breakdown
      });
    } catch (err) {
      next(err);
    }
  }
);
