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
      jokerPlayed: false,
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

/** « Profil rempli » (#799): six figures, the joker said in words, never a lone dash. */
export const Filled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("71 %")).toBeVisible();
    await expect(canvas.getByText("Non")).toBeVisible();
    await expect(canvasElement).not.toHaveTextContent("–");
  },
};

/** The same figures in the dark theme, the joker played. */
export const FilledDark: Story = {
  args: { stats: { ...meta.args.stats, jokerPlayed: true } },
  decorators: [
    (Story) => (
      <div className="dark w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Oui")).toBeVisible();
  },
};
