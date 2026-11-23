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

const passengerInputSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  type: z.enum(["ADULT", "CHILD"]).default("ADULT"),
  seatNo: z.string().min(1),
  preferences: z.record(z.unknown()).optional(),
});

const createBookingSchema = z.object({
  flightId: z.string().min(1),
  // Legacy single-passenger fields kept for backwards compat
  seatNo: z.string().min(1).optional(),
  passenger: z.object({
    fullName: z.string().min(1),
    phone: z.string().optional(),
    preferences: z.record(z.unknown()).optional(),
  }).optional(),
  // Multi-passenger path
  passengers: z.array(passengerInputSchema).min(1).max(9).optional(),
  payment: paymentSchema,
}).refine(d => d.passengers || d.seatNo, {
  message: "passengers[] or seatNo is required",
});

/** POST /api/bookings — create booking with payment (supports 1–9 passengers) */
bookingsRouter.post(
  "/",
  validate(createBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId, seatNo, passenger: passengerInput, passengers: passengersInput, payment } =
        req.body as z.infer<typeof createBookingSchema>;
      const userId = req.user!.id;

      // Normalise to multi-passenger shape
      const passengersList = passengersInput ?? [
        {
          fullName: passengerInput!.fullName,
          email: undefined,
          phone: passengerInput?.phone,
          type: "ADULT" as const,
          seatNo: seatNo!,
          preferences: passengerInput?.preferences,
        },
      ];

      // Look up account holder's passenger profile
      const accountPassenger = await prisma.passenger.findUnique({ where: { userId } });
      if (!accountPassenger) throw new HttpError(404, "Passenger profile not found");

      // Find the flight
      const flight = await prisma.flight.findUnique({ where: { id: flightId } });
      if (!flight) throw new HttpError(404, "Flight not found");

      // Look up all seats
      const seatNos = passengersList.map(p => p.seatNo);
      const seats = await prisma.seat.findMany({ where: { flightId, seatNo: { in: seatNos } } });
      if (seats.length !== seatNos.length) throw new HttpError(404, "One or more seats not found");
      const seatMap = new Map(seats.map(s => [s.seatNo, s]));

      // Resolve payment order
      const submittedOrderId =
        "razorpay_order_id" in payment ? payment.razorpay_order_id : payment.orderId;
      const paymentOrder = await prisma.paymentOrder.findUnique({ where: { orderId: submittedOrderId } });
      if (!paymentOrder) throw new HttpError(402, "Payment order not found — call POST /api/payments/order first");
      if (paymentOrder.userId !== userId) throw new HttpError(402, "Payment order does not belong to this user");
      if (paymentOrder.flightId !== flightId) throw new HttpError(402, "Payment order flight mismatch");
      if (paymentOrder.used) throw new HttpError(402, "Payment order has already been used");

      // Validate that the ordered seats match what's being booked
      const orderedSeats: Array<{ seatNo: string; fare: number }> =
        paymentOrder.seatsJson
          ? (paymentOrder.seatsJson as Array<{ seatNo: string; fare: number }>)
          : [{ seatNo: paymentOrder.seatNo, fare: Number(paymentOrder.amount) }];

      const orderedSeatNos = orderedSeats.map(s => s.seatNo).sort().join(",");
      const requestedSeatNos = [...seatNos].sort().join(",");
      if (orderedSeatNos !== requestedSeatNos) {
        throw new HttpError(402, "Payment order seat(s) mismatch");
      }

      // Build a fare lookup from the order
      const fareLookup = new Map(orderedSeats.map(s => [s.seatNo, s.fare]));

      // Verify payment
      const provider = getPaymentProvider();
      const verifyResult = await provider.verify(payment as Parameters<typeof provider.verify>[0]);
      if (!verifyResult.ok) throw new HttpError(402, verifyResult.reason ?? "Payment failed");

      // Atomic transaction — lock all seats, create all bookings
      const results = await prisma.$transaction(async (tx) => {
        // Lock all seats atomically
        for (const s of seats) {
          const updated = await tx.seat.updateMany({
            where: { id: s.id, status: "AVAILABLE" },
            data: { status: "BOOKED" },
          });
          if (updated.count === 0) throw new HttpError(409, `Seat ${s.seatNo} is no longer available`);
        }

        // Mark payment order used
        await tx.paymentOrder.update({ where: { orderId: submittedOrderId }, data: { used: true } });

        const bookingResults = [];
        for (const pax of passengersList) {
          const seat = seatMap.get(pax.seatNo)!;
          const fare = fareLookup.get(pax.seatNo) ?? Number(paymentOrder.amount);

          // Generate unique PNR
          let newPnr = "";
          for (let attempts = 0; attempts < 10; attempts++) {
            newPnr = genPnr();
            const existing = await tx.booking.findUnique({ where: { pnr: newPnr } });
            if (!existing) break;
            if (attempts === 9) throw new Error("Failed to generate unique PNR");
          }

          const booking = await tx.booking.create({
            data: {
              pnr: newPnr,
              passengerId: accountPassenger.id,
              flightId,
              seatId: seat.id,
              farePaid: fare,
              status: "CONFIRMED",
              passengerName: pax.fullName,
              passengerEmail: pax.email ?? null,
              passengerType: pax.type,
            },
          });

          // Only the first passenger gets the payment record (total amount)
          if (bookingResults.length === 0) {
            await tx.payment.create({
              data: {
                bookingId: booking.id,
                orderId: submittedOrderId,
                paymentId: verifyResult.paymentId ?? null,
                cardLast4: verifyResult.last4 ?? null,
                amount: Number(paymentOrder.amount), // total
                status: "PAID",
                method: verifyResult.method ?? "CARD",
              },
            });
          }

          await tx.ticket.create({ data: { bookingId: booking.id } });

          if (pax.preferences) {
            await tx.passenger.update({
              where: { id: accountPassenger.id },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: { preferences: pax.preferences as any },
            });
          }

          bookingResults.push({ booking, seat, fare, pax });
        }

        // Increment seatsBooked count once for all seats
        await tx.flight.update({
          where: { id: flightId },
          data: { seatsBooked: { increment: seats.length } },
        });

        return bookingResults;
      });

      // After transaction: generate PDFs and send confirmation emails (fire-and-forget)
      const updatedFlight = await prisma.flight.findUnique({
        where: { id: flightId },
        include: { origin: true, destination: true },
      });
      const accountUser = await prisma.user.findUnique({ where: { id: userId } });

      Promise.all(
        results.map(async ({ booking, seat, fare, pax }) => {
          try {
            const pdfBuffer = await renderTicketPdf({
              pnr: booking.pnr,
              flightNo: flight.flightNo,
              origin: updatedFlight?.origin.code ?? "",
              destination: updatedFlight?.destination.code ?? "",
              departAt: flight.departAt,
              arriveAt: flight.arriveAt,
              passengerName: pax.fullName,
              seatNo: seat.seatNo,
              cabinClass: seat.cabinClass,
              farePaid: fare,
            });

            const pdfKey = ticketKey(booking.pnr);
            const uploadedKey = await putObject(pdfKey, pdfBuffer, "application/pdf");
            if (uploadedKey) {
              await prisma.ticket.update({ where: { bookingId: booking.id }, data: { pdfKey: uploadedKey } });
            }

            // Send to account holder, plus co-passenger's email if provided
            const recipients = [accountUser?.email].filter(Boolean) as string[];
            if (pax.email && pax.email !== accountUser?.email) recipients.push(pax.email);

            const dep = flight.departAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" });
            for (const to of recipients) {
              await sendMail({
                to,
                subject: `Booking Confirmed — ${flight.flightNo} · PNR: ${booking.pnr}`,
                html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#0a0f1e;color:#e8dfc8;margin:0;padding:24px;">
  <div style="max-width:520px;margin:auto;background:#111827;border:1px solid #2a3a5c;border-radius:12px;overflow:hidden;">
    <div style="background:#b8972a;padding:20px 28px;">
      <h1 style="margin:0;font-size:22px;color:#0a0f1e;letter-spacing:2px;text-transform:uppercase;">✈ Horizon Airways</h1>
    </div>
    <div style="padding:28px;">
      <h2 style="color:#b8972a;margin-top:0;">Booking Confirmed!</h2>
      <p style="color:#a0aec0;">Hello ${pax.fullName}, your e-ticket is attached.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#a0aec0;width:140px;">PNR</td><td style="padding:8px 0;color:#e8dfc8;font-weight:bold;font-family:monospace;">${booking.pnr}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Flight</td><td style="padding:8px 0;color:#e8dfc8;">${flight.flightNo}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Route</td><td style="padding:8px 0;color:#e8dfc8;">${updatedFlight?.origin.code} → ${updatedFlight?.destination.code}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Departure</td><td style="padding:8px 0;color:#e8dfc8;">${dep} IST</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Seat</td><td style="padding:8px 0;color:#e8dfc8;">${seat.seatNo} (${seat.cabinClass})</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Type</td><td style="padding:8px 0;color:#e8dfc8;">${pax.type}</td></tr>
      </table>
      <p style="color:#a0aec0;font-size:12px;margin-top:24px;">Safe travels,<br/><strong style="color:#b8972a;">Horizon Airways Team</strong></p>
    </div>
  </div>
</body></html>`,
                attachments: [{ filename: `Horizon-Ticket-${booking.pnr}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
              });
            }
          } catch (err) {
            console.error(`Post-booking processing failed for PNR ${booking.pnr} (non-fatal):`, err);
          }
        })
      ).catch(err => console.error("Batch post-booking failed:", err));

      // Return all created bookings
      res.json({
        bookings: results.map(r => ({
          id: r.booking.id,
          pnr: r.booking.pnr,
          flightId,
          seatNo: r.seat.seatNo,
          passengerName: r.pax.fullName,
          passengerType: r.pax.type,
          farePaid: r.fare,
          status: "CONFIRMED",
        })),
      });
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
