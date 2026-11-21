/** City names (lower-case) → IATA codes */
export const CITY_TO_IATA: Record<string, string> = {
  delhi: "DEL",
  "new delhi": "DEL",
  mumbai: "BOM",
  bombay: "BOM",
  bengaluru: "BLR",
  bangalore: "BLR",
  hyderabad: "HYD",
  chennai: "MAA",
  madras: "MAA",
  kolkata: "CCU",
  calcutta: "CCU",
};

export const IATA_CODES = new Set(["DEL", "BOM", "BLR", "HYD", "MAA", "CCU"]);

/** Resolve a city name or IATA code to an IATA code, or return undefined */
export function resolveAirport(text: string): string | undefined {
  const upper = text.trim().toUpperCase();
  if (IATA_CODES.has(upper)) return upper;
  return CITY_TO_IATA[text.trim().toLowerCase()];
}

/**
 * Find an airport code mentioned anywhere in a phrase (longest city name wins).
 */
export function findAirportInPhrase(phrase: string): string | undefined {
  const allCities = Object.keys(CITY_TO_IATA).sort((a, b) => b.length - a.length);
  for (const city of allCities) {
    const regex = new RegExp(`\\b${city}\\b`, "i");
    if (regex.test(phrase)) {
      return CITY_TO_IATA[city.toLowerCase()];
    }
  }
  for (const code of IATA_CODES) {
    const regex = new RegExp(`\\b${code}\\b`, "i");
    if (regex.test(phrase)) {
      return code;
    }
  }
  return undefined;
}
