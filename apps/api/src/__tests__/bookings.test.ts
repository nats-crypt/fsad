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

describe("POST /api/bookings", () => {
  it("creates a booking with valid mock payment", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId: "order_mock_test_001",
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
    const booking = await prisma.booking.findUnique({
      where: { pnr: res.body.pnr },
      include: { payment: true, ticket: true },
    });
    if (booking?.ticket) await prisma.ticket.delete({ where: { bookingId: booking.id } });
    if (booking?.payment) await prisma.payment.delete({ where: { bookingId: booking.id } });
    if (booking) {
      await prisma.booking.delete({ where: { id: booking.id } });
      await prisma.flight.update({
        where: { id: flight!.id },
        data: { seatsBooked: { decrement: 1 } },
      });
      await prisma.seat.update({ where: { id: seat!.id }, data: { status: "AVAILABLE" } });
    }
  });

  it("returns 409 when booking the same seat twice", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    // First booking
    const res1 = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId: "order_mock_test_002",
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res1.status).toBe(200);

    // Second booking with same seat
    const res2 = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId: "order_mock_test_003",
          card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res2.status).toBe(409);

    // Cleanup
    const booking = await prisma.booking.findUnique({
      where: { pnr: res1.body.pnr },
      include: { payment: true, ticket: true },
    });
    if (booking?.ticket) await prisma.ticket.delete({ where: { bookingId: booking.id } });
    if (booking?.payment) await prisma.payment.delete({ where: { bookingId: booking.id } });
    if (booking) {
      await prisma.booking.delete({ where: { id: booking.id } });
      await prisma.flight.update({
        where: { id: flight!.id },
        data: { seatsBooked: { decrement: 1 } },
      });
      await prisma.seat.update({ where: { id: seat!.id }, data: { status: "AVAILABLE" } });
    }
  });

  it("returns 402 and seat stays AVAILABLE on declined mock payment", async () => {
    const token = await getDemoToken();
    const flight = await getFirstDELBOMFlight();
    expect(flight).not.toBeNull();

    const seat = await getAvailableSeat(flight!.id);
    expect(seat).not.toBeNull();

    // Use the decline test card (ending in 0002)
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        flightId: flight!.id,
        seatNo: seat!.seatNo,
        passenger: { fullName: "Demo Passenger", phone: "+91-9000000000" },
        payment: {
          orderId: "order_mock_test_004",
          card: { number: "4111111111110002", expiry: "12/30", cvv: "123" },
        },
      });

    expect(res.status).toBe(402);

    // Seat should remain AVAILABLE
    const updatedSeat = await prisma.seat.findUnique({ where: { id: seat!.id } });
    expect(updatedSeat?.status).toBe("AVAILABLE");
  });
});
