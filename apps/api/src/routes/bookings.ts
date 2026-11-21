import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@horizon/db";
import { requireAuth } from "../lib/auth.js";
import { validate } from "../lib/validate.js";
import { HttpError } from "../lib/http-error.js";
import { getPaymentProvider } from "../payments/provider.js";
import { genPnr } from "../lib/pnr.js";
import { renderTicketPdf } from "../lib/ticket-pdf.js";
import { putObject, presignGet } from "../lib/storage.js";

export const bookingsRouter = Router();

// All bookings routes require authentication
bookingsRouter.use(requireAuth);

const createBookingSchema = z.object({
  flightId: z.string().min(1),
  seatNo: z.string().min(1),
  passenger: z.object({
    fullName: z.string().min(1),
    phone: z.string().optional(),
    preferences: z.record(z.unknown()).optional(),
  }),
  payment: z.record(z.unknown()),
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

      // Step 1: Verify payment BEFORE the seat transaction
      const provider = getPaymentProvider();
      const verifyResult = await provider.verify(payment as Parameters<typeof provider.verify>[0]);
      if (!verifyResult.ok) {
        throw new HttpError(402, verifyResult.reason ?? "Payment failed");
      }

      // Step 2: Atomic transaction — lock seat, create booking, payment, ticket
      const fare = Number(flight.baseFare);

      let pnr: string;
      let bookingId: string;

      const result = await prisma.$transaction(async (tx) => {
        // Lock the seat — check it's still AVAILABLE
        const lockedSeat = await tx.seat.findUnique({
          where: { id: seat.id },
        });
        if (!lockedSeat || lockedSeat.status !== "AVAILABLE") {
          throw new HttpError(409, "Seat is no longer available");
        }

        // Mark seat as BOOKED
        await tx.seat.update({
          where: { id: seat.id },
          data: { status: "BOOKED" },
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

        // Create payment record
        const paymentRecord = await tx.payment.create({
          data: {
            bookingId: booking.id,
            orderId: (payment.orderId as string | undefined) ?? (payment.razorpay_order_id as string | undefined) ?? null,
            paymentId: verifyResult.paymentId ?? null,
            cardLast4: verifyResult.last4 ?? null,
            amount: fare,
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

        const pdfKey = `tickets/${result.booking.pnr}.pdf`;
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

      const bookings = await prisma.booking.findMany({
        where: { passengerId: passenger.id },
        include: {
          flight: { include: { origin: true, destination: true } },
          seat: true,
          payment: true,
          ticket: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(bookings);
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
          flight: { include: { origin: true, destination: true } },
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

      res.json({ ticket: booking.ticket, pdfUrl });
    } catch (err) {
      next(err);
    }
  }
);
