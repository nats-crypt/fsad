// Loads the repo-root .env for local dev (server.ts imports this FIRST, before
// any module that reads process.env). Tests use vitest's own env setup and do
// not import this file. Safe no-op if the .env is absent.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// apps/api/src -> repo root
dotenv.config({ path: resolve(here, "../../../.env") });
