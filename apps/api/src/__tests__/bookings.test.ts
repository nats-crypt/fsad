import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@horizon/db";
import { signToken } from "../lib/auth.js";

const app = createApp();

async function getDemoToken(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "demo@horizon.air" },
  });
  return signToken({ id: user.id, role: user.role });
}

async function getAvailableSeat(flightId: string): Promise<{ id: string; seatNo: string } | null> {
  return prisma.seat.findFirst({
    where: { flightId, status: "AVAILABLE" },
    select: { id: true, seatNo: true },
  });
}

async function getFirstDELBOMFlight(): Promise<{ id: string; baseFare: number } | null> {
  const f = await prisma.flight.findFirst({
    where: {
      origin: { code: "DEL" },
      destination: { code: "BOM" },
      status: "SCHEDULED",
    },
    select: { id: true, baseFare: true },
  });
  if (!f) return null;
  return { id: f.id, baseFare: Number(f.baseFare) };
}

/**
 * Creates a payment order via POST /api/payments/order and returns the orderId.
 * Required before creating a booking (I2: order→amount binding).
 */
async function createPaymentOrder(
  token: string,
  flightId: string,
  seatNo: string
): Promise<string> {
  const res = await request(app)
    .post("/api/payments/order")
    .set("Authorization", `Bearer ${token}`)
    .send({ flightId, seatNo });

  if (res.status !== 200) {
    throw new Error(`Failed to create payment order: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.orderId as string;
}

async function cleanupBooking(
  pnr: string,
  flightId: string,
  seatId: string,
  orderId?: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { pnr },
    include: { payment: true, ticket: true },
  });
  if (booking?.ticket) await prisma.ticket.delete({ where: { bookingId: booking.id } });
  if (booking?.payment) await prisma.payment.delete({ where: { bookingId: booking.id } });
  if (booking) {
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.flight.update({
      where: { id: flightId },
      data: { seatsBooked: { decrement: 1 } },
    });
    await prisma.seat.update({ where: { id: seatId }, data: { status: "AVAILABLE" } });
  }
  if (orderId) {
    await prisma.paymentOrder.deleteMany({ where: { orderId } });
  }
}

describe("POST /api/bookings", () => {
  it("creates a booking with valid mock payment (happy path with PaymentOrder)", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    // I2: create a payment order first
    const orderId = await createPaymentOrder(token, flight!.id, seat!.seatNo);

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId,
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.pnr).toBeTruthy();
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.payment).toBeDefined();
    expect(res.body.payment.status).toBe("PAID");

    // Verify seat is now BOOKED
    const updatedSeat = await prisma.seat.findUnique({ where: { id: seat!.id } });
    expect(updatedSeat?.status).toBe("BOOKED");

    // Cleanup
    await cleanupBooking(res.body.pnr, flight!.id, seat!.id, orderId);
  });

  it("C1: returns 409 when booking the same seat twice (second attempt must not cause 500)", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    // First booking: create its own payment order
    const orderId1 = await createPaymentOrder(token, flight!.id, seat!.seatNo);

    const res1 = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId: orderId1,
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res1.status).toBe(200);

    // For the second attempt: create a fresh payment order for the SAME seat.
    // The seat is now BOOKED so payments/order will return 409 — that's correct too.
    // Alternatively we insert a PaymentOrder directly to test the C1 path in bookings.
    const orderId2 = `order_mock_c1_test_${Date.now()}`;
    await prisma.paymentOrder.create({
      data: {
        orderId: orderId2,
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        amount: flight!.baseFare,
        userId: (await prisma.user.findUniqueOrThrow({ where: { email: "demo@horizon.air" } })).id,
      },
    });

    // Second booking attempt on the same seat — C1 must return 409 not 500
    const res2 = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId: orderId2,
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res2.status).toBe(409);

    // Cleanup
    await cleanupBooking(res1.body.pnr, flight!.id, seat!.id, orderId1);
    await prisma.paymentOrder.deleteMany({ where: { orderId: orderId2 } });
  });

  it("returns 402 and seat stays AVAILABLE on declined mock payment", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    const orderId = await createPaymentOrder(token, flight!.id, seat!.seatNo);

    // Use the decline test card (ending in 0002)
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId,
          card: { number: "4111111111110002", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res.status).toBe(402);

    // Seat should remain AVAILABLE
    const updatedSeat = await prisma.seat.findUnique({ where: { id: seat!.id } });
    expect(updatedSeat?.status).toBe("AVAILABLE");

    // Cleanup payment order (not consumed since booking failed)
    await prisma.paymentOrder.deleteMany({ where: { orderId } });
  });

  it("I2: returns 402 when no PaymentOrder exists for the submitted orderId", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    // Submitting a made-up orderId not registered via POST /api/payments/order
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId: "order_tampered_does_not_exist",
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res.status).toBe(402);
  });

  it("I2: returns 402 when PaymentOrder has tampered flightId", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    // Create a legit order for one flight then submit it pointing to a different flight
    const orderId = await createPaymentOrder(token, flight!.id, seat!.seatNo);

    // Find a different flight (or use a fake id)
    const anotherFlight = await prisma.flight.findFirst({
      where: {
        id: { not: flight!.id },
        status: "SCHEDULED",
      },
      select: { id: true },
    });

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: anotherFlight?.id ?? "nonexistent-flight-id",
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId,
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    // 402 (order mismatch) or 404 (flight not found for tampered id) — either rejects correctly
    expect([402, 404]).toContain(res.status);

    // Cleanup
    await prisma.paymentOrder.deleteMany({ where: { orderId } });
  });

  it("I2: returns 402 when PaymentOrder is reused (used=true)", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    // Book once (consumes the PaymentOrder)
    const orderId = await createPaymentOrder(token, flight!.id, seat!.seatNo);

    const res1 = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId,
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });
    expect(res1.status).toBe(200);

    // Cancel the first booking so the seat is available again, then try to reuse the order
    await request(app)
      .post(`/api/bookings/${res1.body.id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    // The seat is AVAILABLE again but the PaymentOrder is already used
    const res2 = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId, // reusing the same orderId
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res2.status).toBe(402);

    // Cleanup the first booking records
    await cleanupBooking(res1.body.pnr, flight!.id, seat!.id, orderId);
    // Restore seat status after cancel+cleanup
    await prisma.seat.update({ where: { id: seat!.id }, data: { status: "AVAILABLE" } }).catch(() => {});
  });
});
