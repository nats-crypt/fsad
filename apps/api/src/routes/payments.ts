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
  seatNo: z.string().min(1),
});

/** POST /api/payments/order — creates a payment order for a flight seat */
paymentsRouter.post(
  "/order",
  requireAuth,
  validate(orderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId, seatNo } = req.body as z.infer<typeof orderSchema>;
      const userId = req.user!.id;

      const flight = await prisma.flight.findUnique({ where: { id: flightId } });
      if (!flight) {
        throw new HttpError(404, "Flight not found");
      }

      const seat = await prisma.seat.findUnique({
        where: { flightId_seatNo: { flightId, seatNo } },
      });
      if (!seat) {
        throw new HttpError(404, "Seat not found");
      }
      if (seat.status !== "AVAILABLE") {
        throw new HttpError(409, "Seat is not available");
      }

      // fare is in RUPEES (server-computed from flight.baseFare).
      const fare = Number(flight.baseFare);
      // amount in PAISE for the payment provider (Razorpay requires paise;
      // mock provider mirrors this for consistency — m4).
      const amountPaise = Math.round(fare * 100);

      const provider = getPaymentProvider();
      const receipt = `rcpt_${flightId.slice(0, 8)}_${seatNo}`;
      // Provider receives PAISE; both Razorpay and mock return paise in order.amount.
      const order = await provider.createOrder(amountPaise, "INR", receipt);

      // I2: bind this order to flight+seat+amount+user so the booking route
      // can trust the server-computed amount instead of a client-supplied value.
      // PaymentOrder.amount stored in RUPEES (same unit as Payment.amount).
      await prisma.paymentOrder.create({
        data: {
          orderId: order.orderId,
          flightId,
          seatNo,
          amount: fare, // RUPEES
          userId,
        },
      });

      res.json({
        orderId: order.orderId,
        // amount returned in PAISE so the frontend can display "₹{amount/100}".
        amount: order.amount,
        currency: order.currency,
        keyId: order.keyId ?? null,
        provider: provider.name,
      });
    } catch (err) {
      next(err);
    }
  }
);
