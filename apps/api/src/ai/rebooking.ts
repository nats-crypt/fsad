import { prisma } from "@horizon/db";
import { HttpError } from "../lib/http-error.js";

export interface RebookingAlternative {
  id: string;
  flightNo: string;
  origin: { code: string; city: string; name: string };
  destination: { code: string; city: string; name: string };
  departAt: Date;
  arriveAt: Date;
  baseFare: number;
  capacity: number;
  seatsBooked: number;
  seatsLeft: number;
  status: string;
  aircraft: { model: string; registration: string };
}

/**
 * Finds same-route alternatives for a cancelled/disrupted flight.
 * Results are ranked by time proximity to the original departure, then by fare.
 * The cancelled flight itself is excluded.
 */
export async function suggestRebooking(
  cancelledFlightId: string
): Promise<RebookingAlternative[]> {
  const flight = await prisma.flight.findUnique({
    where: { id: cancelledFlightId },
  });

  if (!flight) {
    throw new HttpError(404, "Flight not found");
  }

  const now = new Date();

  const alternatives = await prisma.flight.findMany({
    where: {
      originId: flight.originId,
      destinationId: flight.destinationId,
      id: { not: cancelledFlightId },
      status: { not: "CANCELLED" },
      departAt: { gte: now },
    },
    include: {
      origin: true,
      destination: true,
      aircraft: true,
    },
    take: 20,
  });

  // Keep only flights with seats available
  const withSeats = alternatives.filter(
    (f) => f.capacity - f.seatsBooked > 0
  );

  // Sort by time proximity to the original departure, then by fare (ascending)
  withSeats.sort((a, b) => {
    const aDiff = Math.abs(
      a.departAt.getTime() - flight.departAt.getTime()
    );
    const bDiff = Math.abs(
      b.departAt.getTime() - flight.departAt.getTime()
    );
    if (aDiff !== bDiff) return aDiff - bDiff;
    return Number(a.baseFare) - Number(b.baseFare);
  });

  return withSeats.map((f) => ({
    id: f.id,
    flightNo: f.flightNo,
    origin: { code: f.origin.code, city: f.origin.city, name: f.origin.name },
    destination: {
      code: f.destination.code,
      city: f.destination.city,
      name: f.destination.name,
    },
    departAt: f.departAt,
    arriveAt: f.arriveAt,
    baseFare: Number(f.baseFare),
    capacity: f.capacity,
    seatsBooked: f.seatsBooked,
    seatsLeft: f.capacity - f.seatsBooked,
    status: f.status,
    aircraft: {
      model: f.aircraft.model,
      registration: f.aircraft.registration,
    },
  }));
}
