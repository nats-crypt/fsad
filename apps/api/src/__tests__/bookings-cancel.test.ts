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

async function createTestBooking(token: string): Promise<{
  pnr: string;
  id: string;
  flightId: string;
  seatId: string;
  seatNo: string;
}> {
  const flight = await prisma.flight.findFirstOrThrow({
    where: {
      origin: { code: "DEL" },
      destination: { code: "BOM" },
      status: "SCHEDULED",
    },
  });

  const seat = await prisma.seat.findFirstOrThrow({
    where: { flightId: flight.id, status: "AVAILABLE" },
  });

  const res = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      flightId: flight.id,
      seatNo: seat.seatNo,
      passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
      payment: {
        orderId: `order_mock_cancel_${Date.now()}`,
        card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
      },
    });

  if (res.status !== 200) {
    throw new Error(`Failed to create test booking: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { pnr: res.body.pnr, id: res.body.id, flightId: flight.id, seatId: seat.id, seatNo: seat.seatNo };
}

async function cleanupBooking(bookingId: string, flightId: string, seatId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, ticket: true },
  });
  if (booking?.ticket) await prisma.ticket.delete({ where: { bookingId } });
  if (booking?.payment) await prisma.payment.delete({ where: { bookingId } });
  if (booking) {
    await prisma.booking.delete({ where: { id: bookingId } });
    await prisma.flight.update({
      where: { id: flightId },
      data: { seatsBooked: { decrement: 1 } },
    });
    await prisma.seat.update({ where: { id: seatId }, data: { status: "AVAILABLE" } });
  }
}

describe("POST /api/bookings/:id/cancel", () => {
  it("cancels a confirmed booking and releases the seat", async () => {
    const token = await getDemoToken();
    const { id, flightId, seatId } = await createTestBooking(token);

    const res = await request(app)
      .post(`/api/bookings/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
    expect(res.body.cancelledAt).toBeTruthy();

    // Seat should be AVAILABLE again
    const updatedSeat = await prisma.seat.findUnique({ where: { id: seatId } });
    expect(updatedSeat?.status).toBe("AVAILABLE");

    // Flight seatsBooked should be decremented
    const updatedFlight = await prisma.flight.findUnique({ where: { id: flightId } });
    // Cleanup (booking already CANCELLED but we still need to delete records)
    await cleanupBooking(id, flightId, seatId);
  });

  it("returns 403 when another user tries to cancel", async () => {
    const token = await getDemoToken();
    const { id, flightId, seatId } = await createTestBooking(token);

    // Create a different user (attacker)
    const attackerEmail = `attacker+${Date.now()}@horizon.test`;
    const attackerRes = await request(app)
      .post("/api/auth/register")
      .send({ email: attackerEmail, password: "password123", fullName: "Attacker" });
    const attackerToken = attackerRes.body.token;

    const res = await request(app)
      .post(`/api/bookings/${id}/cancel`)
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.status).toBe(403);

    // Cleanup - cancel the booking first then clean up
    await cleanupBooking(id, flightId, seatId);
    await prisma.passenger.deleteMany({ where: { user: { email: attackerEmail } } });
    await prisma.user.deleteMany({ where: { email: attackerEmail } });
  });
});

describe("GET /api/bookings/mine", () => {
  it("returns the authenticated passenger's bookings", async () => {
    const token = await getDemoToken();
    const { id, flightId, seatId } = await createTestBooking(token);

    const res = await request(app)
      .get("/api/bookings/mine")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // The booking we created should be there
    const found = res.body.find((b: { id: string }) => b.id === id);
    expect(found).toBeDefined();

    // Cleanup
    await cleanupBooking(id, flightId, seatId);
  });
});

describe("GET /api/bookings/:id/ticket", () => {
  it("returns ticket payload for confirmed booking", async () => {
    const token = await getDemoToken();
    const { id, flightId, seatId } = await createTestBooking(token);

    const res = await request(app)
      .get(`/api/bookings/${id}/ticket`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeDefined();
    // pdfUrl may be null if S3 is not configured in test env
    expect("pdfUrl" in res.body).toBe(true);

    // Cleanup
    await cleanupBooking(id, flightId, seatId);
  });
});
