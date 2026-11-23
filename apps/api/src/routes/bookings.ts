import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { requireAuth } from "../lib/auth.js";
import { validate } from "../lib/validate.js";
import { HttpError } from "../lib/http-error.js";
import { getPaymentProvider } from "../payments/provider.js";
import { genPnr } from "../lib/pnr.js";
import { renderTicketPdf } from "../lib/ticket-pdf.js";
import { putObject, presignGet, ticketKey } from "../lib/storage.js";
import { sendMail } from "../lib/mailer.js";

export const bookingsRouter = Router();

// All bookings routes require authentication
bookingsRouter.use(requireAuth);

// m2: tightened payment schema — discriminated union instead of z.record(z.unknown()).
const razorpayPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

const mockPaymentSchema = z.object({
  orderId: z.string(),
  card: z.object({
    number: z.string(),
    expiry: z.string(),
    cvv: z.string(),
  }),
});

// Union of the two valid payment shapes (razorpay proof | mock card+order).
const paymentSchema = z.union([razorpayPaymentSchema, mockPaymentSchema]);

const createBookingSchema = z.object({
  flightId: z.string().min(1),
  seatNo: z.string().min(1),
  passenger: z.object({
    fullName: z.string().min(1),
    phone: z.string().optional(),
    preferences: z.record(z.unknown()).optional(),
  }),
  payment: paymentSchema,
});

/** POST /api/bookings — create booking with payment */
bookingsRouter.post(
  "/",
  validate(createBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId, seatNo, passenger: passengerInput, payment } = req.body as z.infer<typeof createBookingSchema>;
      const userId = req.user!.id;

      // Look up passenger by userId (Passenger.id !== userId)
      const passenger = await prisma.passenger.findUnique({
        where: { userId },
      });
      if (!passenger) {
        throw new HttpError(404, "Passenger profile not found");
      }

      // Find the flight
      const flight = await prisma.flight.findUnique({ where: { id: flightId } });
      if (!flight) {
        throw new HttpError(404, "Flight not found");
      }

      // Find the seat
      const seat = await prisma.seat.findUnique({
        where: { flightId_seatNo: { flightId, seatNo } },
      });
      if (!seat) {
        throw new HttpError(404, "Seat not found");
      }

      // I2: resolve the orderId from whichever payment shape was submitted.
      const submittedOrderId =
        "razorpay_order_id" in payment
          ? payment.razorpay_order_id
          : payment.orderId;

      // I2: look up the PaymentOrder created by POST /api/payments/order.
      // This binds the booking to a server-computed amount and prevents
      // clients from tampering with fare, seat, or flight.
      const paymentOrder = await prisma.paymentOrder.findUnique({
        where: { orderId: submittedOrderId },
      });

      if (!paymentOrder) {
        throw new HttpError(402, "Payment order not found — call POST /api/payments/order first");
      }
      if (paymentOrder.userId !== userId) {
        throw new HttpError(402, "Payment order does not belong to this user");
      }
      if (paymentOrder.flightId !== flightId || paymentOrder.seatNo !== seatNo) {
        throw new HttpError(402, "Payment order flight/seat mismatch");
      }
      if (paymentOrder.used) {
        throw new HttpError(402, "Payment order has already been used");
      }

      // Step 1: Verify payment BEFORE the seat transaction
      const provider = getPaymentProvider();
      const verifyResult = await provider.verify(payment as Parameters<typeof provider.verify>[0]);
      if (!verifyResult.ok) {
        throw new HttpError(402, verifyResult.reason ?? "Payment failed");
      }

      // Step 2: Atomic transaction — lock seat (C1), mark order used, create booking+payment+ticket
      // Amount comes from the server-trusted PaymentOrder (in RUPEES) — not from the client.
      const fare = Number(paymentOrder.amount);

      let pnr: string;
      let bookingId: string;

      const result = await prisma.$transaction(async (tx) => {
        // C1: Atomic seat lock — updateMany with status filter prevents TOCTOU race.
        // If count===0 the seat was already BOOKED by a concurrent request.
        const updated = await tx.seat.updateMany({
          where: { id: seat.id, status: "AVAILABLE" },
          data: { status: "BOOKED" },
        });
        if (updated.count === 0) {
          throw new HttpError(409, "Seat is no longer available");
        }

        // I2: mark the PaymentOrder as consumed so it cannot be reused.
        await tx.paymentOrder.update({
          where: { orderId: submittedOrderId },
          data: { used: true },
        });

        // Generate a unique PNR
        let newPnr: string;
        let attempts = 0;
        do {
          newPnr = genPnr();
          const existing = await tx.booking.findUnique({ where: { pnr: newPnr } });
          if (!existing) break;
          attempts++;
          if (attempts > 10) throw new Error("Failed to generate unique PNR");
        } while (true);
        pnr = newPnr;

        // Create booking
        const booking = await tx.booking.create({
          data: {
            pnr,
            passengerId: passenger.id,
            flightId,
            seatId: seat.id,
            farePaid: fare,
            status: "CONFIRMED",
          },
        });
        bookingId = booking.id;

        // Create payment record — amount in RUPEES (Payment.amount is rupees, NOT paise).
        const paymentRecord = await tx.payment.create({
          data: {
            bookingId: booking.id,
            orderId: submittedOrderId,
            paymentId: verifyResult.paymentId ?? null,
            cardLast4: verifyResult.last4 ?? null,
            amount: fare, // RUPEES
            status: "PAID",
            method: verifyResult.method ?? "CARD",
          },
        });

        // Create ticket
        const ticket = await tx.ticket.create({
          data: { bookingId: booking.id },
        });

        // Increment seatsBooked on flight
        await tx.flight.update({
          where: { id: flightId },
          data: { seatsBooked: { increment: 1 } },
        });

        // Persist passenger preferences if provided
        if (passengerInput.preferences) {
          await tx.passenger.update({
            where: { id: passenger.id },
            data: { preferences: passengerInput.preferences },
          });
        }

        return { booking, paymentRecord, ticket };
      });

      // After transaction: render PDF and upload to S3 (no-op in test env)
      try {
        const updatedFlight = await prisma.flight.findUnique({
          where: { id: flightId },
          include: { origin: true, destination: true },
        });

        const pdfBuffer = await renderTicketPdf({
          pnr: result.booking.pnr,
          flightNo: flight.flightNo,
          origin: updatedFlight?.origin.code ?? "",
          destination: updatedFlight?.destination.code ?? "",
          departAt: flight.departAt,
          arriveAt: flight.arriveAt,
          passengerName: passenger.fullName,
          seatNo,
          cabinClass: seat.cabinClass,
          farePaid: fare,
        });

        const pdfKey = ticketKey(result.booking.pnr);
        const uploadedKey = await putObject(pdfKey, pdfBuffer, "application/pdf");

        if (uploadedKey) {
          await prisma.ticket.update({
            where: { bookingId: result.booking.id },
            data: { pdfKey: uploadedKey },
          });
        }
      } catch (pdfErr) {
        // PDF generation/upload failure should not fail the booking
        console.error("PDF generation/upload failed (non-fatal):", pdfErr);
      }

      // Fire-and-forget confirmation email — don't await, response goes back immediately
      const confirmPnr = result.booking.pnr;
      const confirmUserId = req.user!.id;
      Promise.all([
        prisma.user.findUnique({ where: { id: confirmUserId } }),
        prisma.flight.findUnique({ where: { id: flightId }, include: { origin: true, destination: true } }),
        prisma.seat.findUnique({ where: { flightId_seatNo: { flightId, seatNo } } }),
        prisma.passenger.findUnique({ where: { userId: confirmUserId } }),
      ]).then(async ([user, flight, seat, passenger]) => {
        if (!user?.email || !flight || !seat) return;
        const dep = flight.departAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" });
        const pdfBuffer = await renderTicketPdf({
          pnr: confirmPnr, flightNo: flight.flightNo,
          origin: flight.origin.code, destination: flight.destination.code,
          departAt: flight.departAt, arriveAt: flight.arriveAt,
          passengerName: passenger?.fullName ?? user.email,
          seatNo: seat.seatNo, cabinClass: seat.cabinClass,
          farePaid: Number(flight.baseFare),
        });
        await sendMail({
          to: user.email,
          subject: `Booking Confirmed — ${flight.flightNo} · PNR: ${confirmPnr}`,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#0a0f1e;color:#e8dfc8;margin:0;padding:24px;">
  <div style="max-width:520px;margin:auto;background:#111827;border:1px solid #2a3a5c;border-radius:12px;overflow:hidden;">
    <div style="background:#b8972a;padding:20px 28px;">
      <h1 style="margin:0;font-size:22px;color:#0a0f1e;letter-spacing:2px;text-transform:uppercase;">✈ Horizon Airways</h1>
    </div>
    <div style="padding:28px;">
      <h2 style="color:#b8972a;margin-top:0;">Booking Confirmed!</h2>
      <p style="color:#a0aec0;">Your flight has been booked. Your e-ticket is attached as a PDF.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#a0aec0;width:140px;">PNR</td><td style="padding:8px 0;color:#e8dfc8;font-weight:bold;font-family:monospace;">${confirmPnr}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Flight</td><td style="padding:8px 0;color:#e8dfc8;">${flight.flightNo}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Route</td><td style="padding:8px 0;color:#e8dfc8;">${flight.origin.code} → ${flight.destination.code}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Departure</td><td style="padding:8px 0;color:#e8dfc8;">${dep} IST</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Seat</td><td style="padding:8px 0;color:#e8dfc8;">${seat.seatNo} (${seat.cabinClass})</td></tr>
      </table>
      <p style="color:#a0aec0;font-size:12px;margin-top:24px;">Safe travels,<br/><strong style="color:#b8972a;">Horizon Airways Team</strong></p>
    </div>
  </div>
</body></html>`,
          attachments: [{ filename: `Horizon-Ticket-${confirmPnr}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
        });
      }).catch(err => console.error("Confirmation email failed (non-fatal):", err));

      // Return the booking with related data
      const finalBooking = await prisma.booking.findUnique({
        where: { id: result.booking.id },
        include: {
          flight: { include: { origin: true, destination: true } },
          seat: true,
          payment: true,
          ticket: true,
        },
      });

      res.json(finalBooking);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/bookings/all — admin/staff: all bookings across all passengers */
bookingsRouter.get(
  "/all",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!["ADMIN", "STAFF"].includes(req.user!.role)) {
        throw new HttpError(403, "Admin or staff access required");
      }

      const bookings = await prisma.booking.findMany({
        include: {
          flight: {
            include: {
              origin: { select: { code: true, city: true } },
              destination: { select: { code: true, city: true } },
            },
          },
          seat: { select: { seatNo: true, cabinClass: true } },
          payment: { select: { amount: true, status: true, method: true } },
          passenger: { select: { fullName: true, userId: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(bookings);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/bookings/mine — list authenticated passenger's bookings */
bookingsRouter.get(
  "/mine",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const passenger = await prisma.passenger.findUnique({ where: { userId } });
      if (!passenger) {
        return res.json([]);
      }

      // #4: include nested flight origin/destination{code,city}, departAt/arriveAt,
      // and seat{seatNo,cabinClass} for frontend integration.
      const bookings = await prisma.booking.findMany({
        where: { passengerId: passenger.id },
        include: {
          flight: {
            include: {
              origin: { select: { code: true, city: true, name: true } },
              destination: { select: { code: true, city: true, name: true } },
            },
          },
          seat: { select: { id: true, seatNo: true, cabinClass: true, status: true } },
          payment: true,
          ticket: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Prisma returns Decimal fields as objects; coerce to number for JSON
      res.json(
        bookings.map((b) => ({
          ...b,
          farePaid: Number(b.farePaid),
          flight: b.flight
            ? { ...b.flight, baseFare: Number(b.flight.baseFare) }
            : null,
          payment: b.payment
            ? { ...b.payment, amount: Number(b.payment.amount) }
            : null,
        }))
      );
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/bookings/:id — single booking */
bookingsRouter.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          flight: { include: { origin: true, destination: true } },
          seat: true,
          payment: true,
          ticket: true,
          passenger: true,
        },
      });

      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      // Ensure it belongs to the authenticated user
      if (booking.passenger.userId !== userId) {
        throw new HttpError(403, "Access denied");
      }

      res.json(booking);
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/bookings/:id/cancel — cancel a booking */
bookingsRouter.post(
  "/:id/cancel",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Find booking with passenger to verify ownership
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { passenger: true, seat: true, payment: true },
      });

      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      if (booking.passenger.userId !== userId) {
        throw new HttpError(403, "Access denied");
      }

      if (booking.status === "CANCELLED") {
        throw new HttpError(409, "Booking is already cancelled");
      }

      // Atomic transaction: cancel booking, release seat, decrement seatsBooked
      const updated = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
          },
        });

        await tx.seat.update({
          where: { id: booking.seatId },
          data: { status: "AVAILABLE" },
        });

        await tx.flight.update({
          where: { id: booking.flightId },
          data: { seatsBooked: { decrement: 1 } },
        });

        // Update payment status to REFUNDED
        if (booking.payment) {
          await tx.payment.update({
            where: { bookingId: booking.id },
            data: { status: "REFUNDED" },
          });
        }

        return cancelled;
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/bookings/:id/ticket — e-ticket payload with optional presigned PDF URL */
bookingsRouter.get(
  "/:id/ticket",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          passenger: true,
          ticket: true,
          flight: { include: { origin: true, destination: true, aircraft: true } },
          seat: true,
          payment: true,
        },
      });

      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      if (booking.passenger.userId !== userId) {
        throw new HttpError(403, "Access denied");
      }

      if (!booking.ticket) {
        throw new HttpError(404, "Ticket not issued");
      }

      // Generate presigned PDF URL (null if S3 not configured)
      const pdfUrl = await presignGet(booking.ticket.pdfKey);

      // Build full ticket payload the frontend ETicket component expects
      const ticket = {
        ...booking.ticket,
        farePaid: Number(booking.farePaid),
        pnr: booking.pnr,
        flight: {
          flightNo: booking.flight.flightNo,
          origin: booking.flight.origin,
          destination: booking.flight.destination,
          departAt: booking.flight.departAt,
          arriveAt: booking.flight.arriveAt,
          status: booking.flight.status,
          aircraft: { model: booking.flight.aircraft?.model ?? "" },
        },
        seat: { seatNo: booking.seat.seatNo, cabinClass: booking.seat.cabinClass },
        passenger: { fullName: booking.passenger.fullName },
        payment: booking.payment ? { amount: Number(booking.payment.amount), method: booking.payment.method } : null,
      };

      res.json({ ticket, pdfUrl });
    } catch (err) {
      next(err);
    }
  }
);
