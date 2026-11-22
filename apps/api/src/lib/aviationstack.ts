// AviationStack integration for real flight status data.
// Falls back gracefully when AVIATIONSTACK_KEY is not set.

export interface RealFlightStatus {
  flightNo: string;
  airline: string;
  status: string; // "scheduled" | "active" | "landed" | "cancelled" | "diverted"
  departure: {
    airport: string;
    iata: string;
    scheduled: string | null;
    estimated: string | null;
    actual: string | null;
    delay: number | null; // minutes
    gate: string | null;
    terminal: string | null;
  };
  arrival: {
    airport: string;
    iata: string;
    scheduled: string | null;
    estimated: string | null;
    actual: string | null;
    delay: number | null;
    gate: string | null;
    terminal: string | null;
  };
  aircraft: {
    registration: string | null;
    model: string | null;
  } | null;
  live: {
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number;
    heading: number;
  } | null;
}

export async function fetchFlightStatus(flightNo: string): Promise<{
  available: boolean;
  flight: RealFlightStatus | null;
  message?: string;
}> {
  const key = process.env.AVIATIONSTACK_KEY;
  if (!key) {
    return { available: false, flight: null, message: "Live flight status not configured (set AVIATIONSTACK_KEY)." };
  }

  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${encodeURIComponent(flightNo)}&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { available: false, flight: null, message: `AviationStack error: ${res.status}` };
    }
    const data = await res.json() as {
      data?: Array<{
        flight_status: string;
        airline: { name: string };
        flight: { iata: string };
        departure: {
          airport: string; iata: string;
          scheduled: string; estimated: string; actual: string;
          delay: number; gate: string; terminal: string;
        };
        arrival: {
          airport: string; iata: string;
          scheduled: string; estimated: string; actual: string;
          delay: number; gate: string; terminal: string;
        };
        aircraft: { registration: string; iata: string } | null;
        live: { latitude: number; longitude: number; altitude: number; speed_horizontal: number; direction: number } | null;
      }>;
      error?: { message: string };
    };

    if (data.error) {
      return { available: false, flight: null, message: data.error.message };
    }
    if (!data.data?.length) {
      return { available: true, flight: null, message: "No flight found for this flight number." };
    }

    const f = data.data[0];
    return {
      available: true,
      flight: {
        flightNo: f.flight.iata,
        airline: f.airline.name,
        status: f.flight_status,
        departure: {
          airport: f.departure.airport,
          iata: f.departure.iata,
          scheduled: f.departure.scheduled ?? null,
          estimated: f.departure.estimated ?? null,
          actual: f.departure.actual ?? null,
          delay: f.departure.delay ?? null,
          gate: f.departure.gate ?? null,
          terminal: f.departure.terminal ?? null,
        },
        arrival: {
          airport: f.arrival.airport,
          iata: f.arrival.iata,
          scheduled: f.arrival.scheduled ?? null,
          estimated: f.arrival.estimated ?? null,
          actual: f.arrival.actual ?? null,
          delay: f.arrival.delay ?? null,
          gate: f.arrival.gate ?? null,
          terminal: f.arrival.terminal ?? null,
        },
        aircraft: f.aircraft
          ? { registration: f.aircraft.registration ?? null, model: f.aircraft.iata ?? null }
          : null,
        live: f.live
          ? {
              latitude: f.live.latitude,
              longitude: f.live.longitude,
              altitude: f.live.altitude,
              speed: f.live.speed_horizontal,
              heading: f.live.direction,
            }
          : null,
      },
    };
  } catch (err) {
    console.error("[aviationstack] fetch error:", err);
    return { available: false, flight: null, message: "Failed to fetch live flight status." };
  }
}
