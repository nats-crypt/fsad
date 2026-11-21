// SerpApi Google Flights integration — real-time flight data.
// Gated on SERPAPI_KEY: when unset, returns { available:false } with NO network call,
// so local dev / tests / offline use fall back cleanly. Never logs the api key.

export interface LiveFlight {
  airlines: string[];
  flightNumbers: string[];
  departAirport: string;
  arriveAirport: string;
  departTime: string;
  arriveTime: string;
  totalDurationMin: number;
  stops: number;
  price: number;
  currency: string;
  airlineLogo?: string;
}

export interface LiveFlightsResult {
  available: boolean;
  flights: LiveFlight[];
  message?: string;
}

interface SerpLeg {
  departure_airport?: { id?: string; time?: string };
  arrival_airport?: { id?: string; time?: string };
  airline?: string;
  flight_number?: string;
  airline_logo?: string;
}
interface SerpItem {
  flights?: SerpLeg[];
  layovers?: unknown[];
  total_duration?: number;
  price?: number;
  airline_logo?: string;
}

function normalize(item: SerpItem, currency: string): LiveFlight | null {
  const legs = item.flights ?? [];
  if (!legs.length) return null;
  const first = legs[0];
  const last = legs[legs.length - 1];
  return {
    airlines: [...new Set(legs.map((l) => l.airline).filter(Boolean) as string[])],
    flightNumbers: legs.map((l) => l.flight_number).filter(Boolean) as string[],
    departAirport: first.departure_airport?.id ?? "",
    arriveAirport: last.arrival_airport?.id ?? "",
    departTime: first.departure_airport?.time ?? "",
    arriveTime: last.arrival_airport?.time ?? "",
    totalDurationMin: item.total_duration ?? 0,
    stops: Array.isArray(item.layovers) ? item.layovers.length : Math.max(0, legs.length - 1),
    price: item.price ?? 0,
    currency,
    airlineLogo: item.airline_logo ?? first.airline_logo,
  };
}

export async function fetchLiveFlights(params: {
  departureId: string;
  arrivalId: string;
  outboundDate: string;
  currency?: string;
}): Promise<LiveFlightsResult> {
  const key = process.env.SERPAPI_KEY;
  const currency = params.currency ?? "USD";
  if (!key) {
    return { available: false, flights: [], message: "Live flight data not configured (set SERPAPI_KEY)." };
  }
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_flights");
  url.searchParams.set("departure_id", params.departureId);
  url.searchParams.set("arrival_id", params.arrivalId);
  url.searchParams.set("outbound_date", params.outboundDate);
  url.searchParams.set("type", "2"); // one-way
  url.searchParams.set("currency", currency);
  url.searchParams.set("api_key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { available: false, flights: [], message: "Live flights unavailable right now." };
    const data = (await res.json()) as { best_flights?: SerpItem[]; other_flights?: SerpItem[]; error?: string };
    if (data.error) return { available: false, flights: [], message: "Live flights unavailable right now." };
    const items = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
    const flights = items.map((i) => normalize(i, currency)).filter((f): f is LiveFlight => !!f);
    return { available: true, flights };
  } catch {
    return { available: false, flights: [], message: "Live flights unavailable right now." };
  } finally {
    clearTimeout(timer);
  }
}
