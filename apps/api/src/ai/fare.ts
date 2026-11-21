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
 * Pure heuristic fare forecast.
 *
 * Rules:
 * - occupancy > 75% AND < 7 days to departure → RISING / BOOK_NOW (confidence 0.85)
 * - occupancy < 30% AND > 14 days to departure → FALLING / WAIT  (confidence 0.70)
 * - otherwise                                  → STEADY / BOOK_NOW (confidence 0.60)
 */
export function forecastFare(flight: FareFlightData): FareForecast {
  const now = new Date();
  const daysUntilDeparture = Math.max(
    0,
    (flight.departAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const occupancy = flight.seatsBooked / (flight.capacity || 1);

  if (occupancy > 0.75 && daysUntilDeparture < 7) {
    return { trend: "RISING", advice: "BOOK_NOW", confidence: 0.85 };
  }

  if (occupancy < 0.3 && daysUntilDeparture > 14) {
    return { trend: "FALLING", advice: "WAIT", confidence: 0.70 };
  }

  return { trend: "STEADY", advice: "BOOK_NOW", confidence: 0.60 };
}
