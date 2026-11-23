import type { AiProvider, ParsedSearch } from "./provider.js";
import { CITY_TO_IATA, IATA_CODES, findAirportInPhrase } from "./airports.js";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Returns a Date as YYYY-MM-DD in IST (UTC+5:30) */
function dateToISO(d: Date): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Returns today's date as YYYY-MM-DD in IST */
function todayIST(): Date {
  // Shift now by IST offset so getDate/getMonth work as IST calendar
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

/** Returns the Date of the next occurrence of the named weekday (1–7 days ahead). */
function nextOccurrenceOfWeekday(dayName: string): Date {
  const target = WEEKDAYS.indexOf(dayName.toLowerCase());
  if (target === -1) return todayIST();
  const today = todayIST();
  const current = today.getUTCDay(); // shifted date — use getUTCDay since we shifted manually
  let daysAhead = target - current;
  if (daysAhead <= 0) daysAhead += 7;
  const result = new Date(today);
  result.setUTCDate(today.getUTCDate() + daysAhead);
  return result;
}

function parseDateHints(text: string): Pick<ParsedSearch, "dateFrom" | "dateTo"> {
  const lower = text.toLowerCase();

  if (lower.includes("today")) {
    const iso = dateToISO(todayIST());
    return { dateFrom: iso, dateTo: iso };
  }

  if (lower.includes("tomorrow")) {
    const d = todayIST();
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = dateToISO(d);
    return { dateFrom: iso, dateTo: iso };
  }

  if (lower.includes("this weekend") || lower.includes("weekend")) {
    const sat = nextOccurrenceOfWeekday("saturday");
    const sun = new Date(sat);
    sun.setUTCDate(sat.getUTCDate() + 1);
    return { dateFrom: dateToISO(sat), dateTo: dateToISO(sun) };
  }

  const nextMatch = lower.match(
    /next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/
  );
  if (nextMatch) {
    const iso = dateToISO(nextOccurrenceOfWeekday(nextMatch[1]));
    return { dateFrom: iso, dateTo: iso };
  }

  return {};
}

function parseTimeOfDay(
  text: string
): "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("morning")) return "MORNING";
  if (lower.includes("afternoon")) return "AFTERNOON";
  if (lower.includes("evening")) return "EVENING";
  if (lower.includes("night")) return "NIGHT";
  return undefined;
}

function parseSort(
  text: string
): "CHEAPEST" | "FASTEST" | "EARLIEST" | undefined {
  const lower = text.toLowerCase();
  if (
    lower.includes("cheap") ||
    lower.includes("lowest fare") ||
    lower.includes("budget")
  )
    return "CHEAPEST";
  if (
    lower.includes("fast") ||
    lower.includes("quick") ||
    lower.includes("shortest")
  )
    return "FASTEST";
  if (
    lower.includes("earliest") ||
    lower.includes("first flight") ||
    lower.includes("early flight")
  )
    return "EARLIEST";
  return undefined;
}

function parseAirports(
  text: string
): Pick<ParsedSearch, "origin" | "destination"> {
  // "from X to Y"
  const fromToRe =
    /\bfrom\s+(.+?)\s+to\s+([A-Za-z\s]+?)(?:\s+(?:on|next|this|today|tomorrow|morning|afternoon|evening|night|cheap|fast|early|first|flight|\d)|$)/i;
  const fromToMatch = text.match(fromToRe);
  if (fromToMatch) {
    const origin = findAirportInPhrase(fromToMatch[1].trim());
    const destination = findAirportInPhrase(fromToMatch[2].trim());
    if (origin || destination) return { origin, destination };
  }

  // "from X"
  const fromRe =
    /\bfrom\s+([A-Za-z\s]+?)(?:\s+(?:to|on|next|this|today|tomorrow|morning|afternoon|evening|night|cheap|fast|early|first|flight)|$)/i;
  const fromMatch = text.match(fromRe);

  // "to X" – but not preceded by want/need/how etc.
  const toRe =
    /\bto\s+([A-Za-z\s]+?)(?:\s+(?:from|on|next|this|today|tomorrow|morning|afternoon|evening|night|cheap|fast|early|first|flight)|$)/i;
  const toMatch = text.match(toRe);

  const origin = fromMatch ? findAirportInPhrase(fromMatch[1].trim()) : undefined;
  const destination = toMatch
    ? findAirportInPhrase(toMatch[1].trim())
    : undefined;

  if (origin || destination) return { origin, destination };

  // Fall back: scan for city/IATA names in order of appearance
  const foundCodes: Array<{ code: string; index: number }> = [];
  const allCities = Object.keys(CITY_TO_IATA).sort((a, b) => b.length - a.length);

  for (const city of allCities) {
    const regex = new RegExp(`\\b${city}\\b`, "i");
    const match = text.match(regex);
    if (match && match.index !== undefined) {
      const code = CITY_TO_IATA[city.toLowerCase()];
      if (!foundCodes.find((f) => f.code === code)) {
        foundCodes.push({ code, index: match.index });
      }
    }
  }

  for (const code of IATA_CODES) {
    const regex = new RegExp(`\\b${code}\\b`, "i");
    const match = text.match(regex);
    if (match && match.index !== undefined) {
      if (!foundCodes.find((f) => f.code === code)) {
        foundCodes.push({ code, index: match.index });
      }
    }
  }

  foundCodes.sort((a, b) => a.index - b.index);

  if (foundCodes.length >= 2) {
    return { origin: foundCodes[0].code, destination: foundCodes[1].code };
  } else if (foundCodes.length === 1) {
    return { destination: foundCodes[0].code };
  }

  return {};
}

function parseSearchLocal(text: string): ParsedSearch {
  const airports = parseAirports(text);
  const dates = parseDateHints(text);
  const timeOfDay = parseTimeOfDay(text);
  const sort = parseSort(text);

  return {
    ...airports,
    ...dates,
    ...(timeOfDay !== undefined && { timeOfDay }),
    ...(sort !== undefined && { sort }),
  };
}

export const localProvider: AiProvider = {
  async parseSearch(text: string): Promise<ParsedSearch> {
    return parseSearchLocal(text);
  },
};

// Export the pure function for direct unit testing
export { parseSearchLocal };
