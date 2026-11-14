import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";

import { MyRankBar } from "./my-rank-bar";

const meta = {
  title: "Leaderboard/MyRankBar",
  component: MyRankBar,
  args: { rank: 23, points: 112 },
} satisfies Meta<typeof MyRankBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A long ranking, my line far below: « Autour de moi » jumps to it (#710). */
export const MeOutOfView: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <div className="h-[3000px] rounded-card bg-muted" />
        <Story />
        <p id="moi" className="p-4">
          Toi
        </p>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Tu es 23e · 112 pts")).toBeInTheDocument();
    await waitFor(() =>
      expect(canvas.getByRole("link", { name: "Autour de moi" })).toHaveAttribute("href", "#moi"),
    );
  },
};

/** A short ranking, my line already on screen: no shortcut, the bar alone (#710). */
export const MeInView: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <p id="moi" className="p-4">
          Toi
        </p>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Tu es 23e · 112 pts")).toBeInTheDocument();
    // Let the observer report first: the shortcut must stay hidden.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await expect(canvas.queryByRole("link", { name: "Autour de moi" })).toBeNull();
  },
};

/** Not in the list (no line to jump to): no shortcut. */
export const MeNotListed: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await expect(canvas.queryByRole("link", { name: "Autour de moi" })).toBeNull();
  },
};
