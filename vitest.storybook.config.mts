import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Runs the play functions of the stories in a real browser (npm run test:storybook).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  optimizeDeps: { exclude: ["vitest", "vitest/browser", "@vitest/browser"] },
  plugins: [storybookTest({ configDir: ".storybook" })],
  test: {
    name: "storybook",
    setupFiles: [".storybook/vitest.setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      // CHROMIUM_PATH lets a machine without the matching Playwright browser use another Chromium.
      provider: playwright({
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      }),
      instances: [{ browser: "chromium" }],
    },
  },
});
