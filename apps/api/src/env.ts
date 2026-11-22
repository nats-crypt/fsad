// Loads the repo-root .env for local dev only. Skipped in production
// where env vars are injected by the platform (Railway).
if (process.env.NODE_ENV !== "production") {
  const { default: dotenv } = await import("dotenv");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: resolve(here, "../../../.env") });
}
