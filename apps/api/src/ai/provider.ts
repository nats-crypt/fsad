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
 * Returns llmProvider when LLM_API_KEY is set, otherwise localProvider.
 * Tests set LLM_API_KEY='' to force the local (offline) path.
 */
export function getProvider(): AiProvider {
  const apiKey = process.env.LLM_API_KEY;
  if (apiKey) {
    return llmProvider;
  }
  return localProvider;
}
