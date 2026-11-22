import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { SeasonTiles } from "./season-blocks";

const meta = {
  title: "Profile/SeasonTiles",
  component: SeasonTiles,
  args: {
    stats: {
      predictions: 14,
      perfectPodiums: 1,
      winners: 6,
      successRate: 71,
      bestStreak: 4,
      curve: [5, 17, 17, 29],
      bestShot: null,
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SeasonTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

/** « Profil rempli » (#799): six figures, the total of the season last, never a lone dash. */
export const Filled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("71 %")).toBeVisible();
    await expect(canvas.getByText("29")).toBeVisible();
    await expect(canvasElement).not.toHaveTextContent("–");
  },
};

/** The same figures in the dark theme. */
export const FilledDark: Story = {
  decorators: [
    (Story) => (
      <div className="dark w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("points")).toBeVisible();
  },
};
