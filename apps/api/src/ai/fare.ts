export interface FareFlightData {
  capacity: number;
  seatsBooked: number;
  departAt: Date;
}

export interface FareForecast {
  trend: "RISING" | "STEADY" | "FALLING";
  advice: "BOOK_NOW" | "WAIT";
  confidence: number;
}

/**
 * Pure heuristic fare forecast based on occupancy + days-to-departure.
 *
 * - RISING / BOOK_NOW  — demand is high or departure is imminent and filling:
 *     occupancy ≥ 60%, OR (occupancy ≥ 40% AND ≤ 3 days out)
 * - FALLING / WAIT     — plenty of empty seats with time to spare:
 *     occupancy ≤ 30% AND ≥ 7 days out
 * - STEADY / BOOK_NOW  — everything in between
 * Confidence scales with how strong the signal is.
 */
export function forecastFare(flight: FareFlightData): FareForecast {
  const now = new Date();
  const daysUntilDeparture = Math.max(
    0,
    (flight.departAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const occupancy = flight.seatsBooked / (flight.capacity || 1);

  if (occupancy >= 0.6 || (occupancy >= 0.4 && daysUntilDeparture <= 3)) {
    const confidence = Math.min(0.95, 0.7 + occupancy * 0.25);
    return { trend: "RISING", advice: "BOOK_NOW", confidence: Number(confidence.toFixed(2)) };
  }

  if (occupancy <= 0.3 && daysUntilDeparture >= 7) {
    const confidence = Math.min(0.9, 0.6 + (0.3 - occupancy) + daysUntilDeparture / 60);
    return { trend: "FALLING", advice: "WAIT", confidence: Number(confidence.toFixed(2)) };
  }

  return { trend: "STEADY", advice: "BOOK_NOW", confidence: 0.6 };
}
