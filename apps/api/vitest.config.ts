import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  // Restrict env file loading to apps/api/ only (no .env here),
  // preventing the workspace-root .env (which has Razorpay test keys) from
  // being auto-loaded by Vite. Tests load .env.test explicitly in globalSetup.
  envDir: resolve(__dirname, "."),
  resolve: {
    alias: {
      "@horizon/db": resolve(__dirname, "../../packages/db/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./src/__tests__/setup.ts",
    // Run test files sequentially to prevent DB seat-booking conflicts between files.
    fileParallelism: false,
    // Explicitly clear Razorpay keys so tests always use the mock provider.
    // The workspace-root .env has test-mode Razorpay keys; Prisma's dotenv
    // loading picks them up before globalSetup runs. Setting them empty here
    // ensures getPaymentProvider() returns mockProvider in all tests.
    env: {
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
      LLM_API_KEY: "",
      LLM_BASE_URL: "",
    },
  },
});
