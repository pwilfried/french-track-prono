import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Adapter tests talk to a local Supabase and its mailbox: give them more than the default 5 s.
    testTimeout: 20000,
    include: ["src/**/*.test.ts", "tools/**/*.test.ts"],
    // .env.local gives the local Supabase address and key to the adapter tests.
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
