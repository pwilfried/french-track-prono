import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { CountdownBadge } from "./countdown-badge";

const now = new Date("2026-09-11T18:30:00.000Z");
const inSeconds = (secs: number) => new Date(now.getTime() + secs * 1000).toISOString();

const meta = {
  title: "Events/CountdownBadge",
  component: CountdownBadge,
  args: { now },
  decorators: [
    (Story) => (
      <div className="inline-flex bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CountdownBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Far: ghost chip, days + hours. */
export const Far: Story = {
  args: { lockAt: inSeconds(3 * 86400 + 4 * 3600) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/3 j/)).toBeInTheDocument();
  },
};

/** Soon (≤ 1 h): amber chip. */
export const Soon: Story = {
  args: { lockAt: inSeconds(42 * 60) },
};

/** Very soon (≤ 10 min): red chip to grab attention. */
export const VerySoon: Story = {
  args: { lockAt: inSeconds(8 * 60) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/-8 min/)).toBeInTheDocument();
  },
};

/** Last minute: shows seconds. */
export const SecondsLeft: Story = {
  args: { lockAt: inSeconds(42) },
};

/** Already locked. */
export const Locked: Story = {
  args: { lockAt: inSeconds(-60) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Verrouillé/)).toBeInTheDocument();
  },
};
