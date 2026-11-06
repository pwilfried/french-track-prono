import type { Preview } from "@storybook/nextjs-vite";

import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/inter";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: { layout: "fullscreen" },
};

export default preview;
