import type { AiProvider, ParsedSearch } from "./provider.js";
import { localProvider } from "./local.js";

/**
 * LLM-backed provider. Calls an OpenAI-compatible `/chat/completions` endpoint.
 * Falls back to localProvider on any network/parse error so the endpoint never 500s.
 */
export const llmProvider: AiProvider = {
  async parseSearch(text: string): Promise<ParsedSearch> {
    const baseUrl =
      process.env.LLM_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
    const model =
      process.env.LLM_MODEL ?? "moonshotai/kimi-k3.1-pro";
    const apiKey = process.env.LLM_API_KEY ?? "";

    const systemPrompt = `You are a flight search query parser. Extract flight search parameters from the user's natural language query and return ONLY a JSON object with this exact structure (use null for missing fields):
{
  "origin": "IATA code or null",
  "destination": "IATA code or null",
  "dateFrom": "YYYY-MM-DD or null",
  "dateTo": "YYYY-MM-DD or null",
  "timeOfDay": "MORNING|AFTERNOON|EVENING|NIGHT or null",
  "sort": "CHEAPEST|FASTEST|EARLIEST or null"
}
Return ONLY the JSON object, no markdown, no explanation.
Indian airport IATA codes: Delhi=DEL, Mumbai=BOM, Bengaluru=BLR, Hyderabad=HYD, Chennai=MAA, Kolkata=CCU.
Relative date rules (today is ${new Date().toISOString().slice(0, 10)}):
- "today" → today's date
- "tomorrow" → tomorrow's date
- "next <weekday>" → that weekday in the next 7 days
- "this weekend" → next Saturday`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`LLM API error: ${response.status}`);
        }

        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        const content = data.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content) as Record<string, unknown>;

        // Strip null values and return a clean ParsedSearch
        return Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
        ) as ParsedSearch;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // Any LLM error → fall back to local heuristic
      return localProvider.parseSearch(text);
    }
  },
};
