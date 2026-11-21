export interface FlightData {
  id: string;
  flightNo: string;
  capacity: number;
  seatsBooked: number;
  departAt: Date;
}

export interface OptimizerResult {
  flightId: string;
  flightNo: string;
  predictedLoadFactor: number;
  recommendedCrew: number;
  recommendedAircraftSize: "SMALL" | "MEDIUM" | "LARGE";
  flag: "OVER" | "UNDER" | "OK";
  rationale: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Seasonality multiplier based on days until departure.
 * Close-in bookings push load factor up; far-out flights are discounted.
 */
function seasonality(daysOut: number): number {
  if (daysOut <= 1) return 1.3;
  if (daysOut <= 7) return 1.1;
  if (daysOut <= 30) return 1.0;
  return 0.8;
}

/** Recommended crew size by aircraft capacity tier */
function crewBaseline(capacity: number): number {
  if (capacity < 100) return 4;
  if (capacity < 200) return 6;
  return 8;
}

function aircraftSize(loadFactor: number): "SMALL" | "MEDIUM" | "LARGE" {
  if (loadFactor > 0.85) return "LARGE";
  if (loadFactor > 0.60) return "MEDIUM";
  return "SMALL";
}

/**
 * Pure heuristic demand & crew optimizer.
 * @param flights    Upcoming flight records
 * @param crewCounts Map of flightId → number of assigned crew members
 */
export function optimizeFlights(
  flights: FlightData[],
  crewCounts: Record<string, number>
): OptimizerResult[] {
  const now = new Date();

  return flights.map((flight) => {
    const daysOut = Math.max(
      0,
      (flight.departAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const rawLoadFactor = flight.seatsBooked / (flight.capacity || 1);
    const predictedLoadFactor = clamp(
      rawLoadFactor * seasonality(daysOut),
      0,
      1
    );

    const recommendedCrew = crewBaseline(flight.capacity);
    const recommendedAircraftSize = aircraftSize(predictedLoadFactor);

    const assignedCrew = crewCounts[flight.id] ?? 0;
    let flag: "OVER" | "UNDER" | "OK";
    if (assignedCrew > recommendedCrew) {
      flag = "OVER";
    } else if (assignedCrew < recommendedCrew) {
      flag = "UNDER";
    } else {
      flag = "OK";
    }

    const pct = (predictedLoadFactor * 100).toFixed(1);
    const rationale =
      `Predicted load: ${pct}% (${flight.seatsBooked}/${flight.capacity} seats, ` +
      `${daysOut.toFixed(0)} days out). ` +
      `Crew: ${assignedCrew} assigned vs ${recommendedCrew} recommended.`;

    return {
      flightId: flight.id,
      flightNo: flight.flightNo,
      predictedLoadFactor,
      recommendedCrew,
      recommendedAircraftSize,
      flag,
      rationale,
    };
  });
}
