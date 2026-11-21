export type ParsedSearch = {
  origin?: string;
  destination?: string;
  dateFrom?: string;
  dateTo?: string;
  timeOfDay?: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
  sort?: "CHEAPEST" | "FASTEST" | "EARLIEST";
};

export interface AiProvider {
  parseSearch(text: string): Promise<ParsedSearch>;
}

import { localProvider } from "./local.js";
import { llmProvider } from "./llm.js";

/**
 * Hybrid provider: runs the fast offline parser first and returns immediately
 * when it finds a route (origin/destination) — so typical queries are instant.
 * Only genuinely ambiguous text (no route found) consults the LLM, whose result
 * is merged over the local one. The LLM itself falls back to local on error.
 */
const hybridProvider: AiProvider = {
  async parseSearch(text: string): Promise<ParsedSearch> {
    const local = await localProvider.parseSearch(text);
    if (local.destination || local.origin) return local; // fast path
    const llm = await llmProvider.parseSearch(text);
    return { ...local, ...llm };
  },
};

/**
 * Returns the hybrid (local-first + LLM for hard cases) provider when
 * LLM_API_KEY is set, otherwise the pure offline localProvider.
 * Tests set LLM_API_KEY='' to force the local path.
 */
export function getProvider(): AiProvider {
  return process.env.LLM_API_KEY ? hybridProvider : localProvider;
}
