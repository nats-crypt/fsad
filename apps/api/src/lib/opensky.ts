// OpenSky Network — free, no key required (anonymous rate limit: 10 req/min)
// With a free account: 100 req/min. Set OPENSKY_USER + OPENSKY_PASS for higher limits.

export interface AircraftPosition {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null; // metres geometric
  onGround: boolean;
  velocity: number | null; // m/s
  heading: number | null;
  verticalRate: number | null;
  lastContact: number; // unix timestamp
}

export async function fetchAircraftPosition(
  callsign: string
): Promise<AircraftPosition | null> {
  try {
    const cs = callsign.trim().toUpperCase().padEnd(8, " ");
    const auth = process.env.OPENSKY_USER && process.env.OPENSKY_PASS
      ? `Basic ${Buffer.from(`${process.env.OPENSKY_USER}:${process.env.OPENSKY_PASS}`).toString("base64")}`
      : undefined;

    const headers: Record<string, string> = {};
    if (auth) headers["Authorization"] = auth;

    const url = `https://opensky-network.org/api/states/all?callsign=${encodeURIComponent(cs.trim())}`;
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const data = await res.json() as { states?: unknown[][] };
    if (!data.states?.length) return null;

    const s = data.states[0];
    return {
      icao24: s[0] as string,
      callsign: (s[1] as string).trim(),
      originCountry: s[2] as string,
      longitude: s[5] as number | null,
      latitude: s[6] as number | null,
      altitude: s[7] as number | null,
      onGround: s[8] as boolean,
      velocity: s[9] as number | null,
      heading: s[10] as number | null,
      verticalRate: s[11] as number | null,
      lastContact: s[4] as number,
    };
  } catch {
    return null;
  }
}
