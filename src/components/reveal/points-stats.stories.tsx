import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { eventPointsStats } from "@/domain/event-result";

import { PointsStats } from "./points-stats";

const text = messages.pointsStats;
const points = [0, 0, 2, 4, 4, 5, 7, 8, 9, 12, 14, 18];
const scores = points.map((p, i) => ({ userId: `u${i}`, points: p, perfect: p >= 18 }));

const meta = {
  title: "Reveal/PointsStats",
  component: PointsStats,
  args: { stats: eventPointsStats(scores, "u7") },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background py-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PointsStats>;

export default meta;
type Story = StoryObj<typeof meta>;

/** My place among all, the spread of the points with my range highlighted. */
export const WithMine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.myPlace(5, 12))).toBeVisible();
    await expect(canvas.getByText(text.perfect(1))).toBeVisible();
  },
};

/** Without my prediction: only the mean. */
export const WithoutMine: Story = {
  args: { stats: eventPointsStats(scores) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(text.myPlaceTitle)).toBeNull();
  },
};

/** Nobody scored: nothing. */
export const Empty: Story = { args: { stats: eventPointsStats([]) } };
