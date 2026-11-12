import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { ProgressCard } from "./progress-card";

const now = new Date("2026-08-15T16:00:00.000Z");

const meta = {
  title: "Events/ProgressCard",
  component: ProgressCard,
  args: {
    now,
    progress: {
      posed: 7,
      total: 18,
      points: 34,
      daysToStart: null,
      tonight: { todo: 3, nextLockAt: new Date(now.getTime() + 42 * 60_000).toISOString() },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In the competition: my podiums, my points, what is left tonight and the next lock. */
export const InCompetition: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("7 / 18 podiums posés")).toBeInTheDocument();
    await expect(canvas.getByText("34 pts")).toBeInTheDocument();
    await expect(canvas.getByText(/^3 finales à faire ce soir,/)).toBeInTheDocument();
    await expect(canvas.getByText("la prochaine verrouille dans 42 min")).toBeInTheDocument();
  },
};

/** Before the competition: the days to the first finals, every prediction open. */
export const BeforeCompetition: Story = {
  args: {
    progress: {
      posed: 0,
      total: 18,
      points: 0,
      daysToStart: 5,
      tonight: { todo: 0, nextLockAt: null },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Premières finales dans 5 j")).toBeInTheDocument();
    await expect(canvas.getByText(/^Tous les pronos sont ouverts/)).toBeInTheDocument();
  },
};

/** Nothing left to predict tonight. */
export const NothingTonight: Story = {
  args: {
    progress: {
      posed: 18,
      total: 18,
      points: 112,
      daysToStart: null,
      tonight: { todo: 0, nextLockAt: null },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Rien à poser ce soir.")).toBeInTheDocument();
  },
};

/** One final left tonight, in the singular. */
export const OneLeft: Story = {
  args: {
    progress: {
      posed: 17,
      total: 18,
      points: 1,
      daysToStart: null,
      tonight: { todo: 1, nextLockAt: new Date(now.getTime() + 5 * 3600_000).toISOString() },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^1 finale à faire ce soir,/)).toBeInTheDocument();
    await expect(canvas.getByText("1 pt")).toBeInTheDocument();
  },
};
