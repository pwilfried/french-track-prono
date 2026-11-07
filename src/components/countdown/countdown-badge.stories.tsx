import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { CountdownBadge } from "./countdown-badge";

const NOW = new Date("2026-09-12T18:00:00Z");
const inSeconds = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

const meta = {
  title: "Countdown/CountdownBadge",
  component: CountdownBadge,
  args: { now: NOW, lockAt: inSeconds(2 * 86400 + 4 * 3600) },
  decorators: [
    (Story) => (
      <div className="bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CountdownBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectBadge = async (canvasElement: HTMLElement, text: string, level: string) => {
  const badge = within(canvasElement).getByRole("timer");
  await expect(badge).toHaveTextContent(text);
  await expect(badge).toHaveAttribute("data-level", level);
};

/** More than one hour left: neutral. */
export const Far: Story = {
  play: async ({ canvasElement }) => expectBadge(canvasElement, "Verrouillage dans 2 j 4 h", "far"),
};

/** One hour or less: orange. */
export const Soon: Story = {
  args: { lockAt: inSeconds(42 * 60) },
  play: async ({ canvasElement }) => expectBadge(canvasElement, "Verrouillage dans 42 min", "soon"),
};

/** Ten minutes or less: red, with the seconds. */
export const VerySoon: Story = {
  args: { lockAt: inSeconds(4 * 60 + 12) },
  play: async ({ canvasElement }) =>
    expectBadge(canvasElement, "Verrouillage dans 4 min 12 s", "very-soon"),
};

/** From the lock time itself. */
export const Locked: Story = {
  args: { lockAt: NOW.toISOString() },
  play: async ({ canvasElement }) => expectBadge(canvasElement, "Verrouillé", "locked"),
};

/** Short label for the events list. */
export const Compact: Story = {
  args: { lockAt: inSeconds(45 * 60), compact: true },
  play: async ({ canvasElement }) => {
    await expectBadge(canvasElement, "45 min", "soon");
    await expect(within(canvasElement).getByRole("timer")).not.toHaveTextContent("Verrouillage");
  },
};

/** The longest label stays on one line in a narrow column. */
export const LongLabel: Story = {
  args: { lockAt: inSeconds(23 * 3600 + 59 * 60) },
  decorators: [
    (Story) => (
      <div className="w-[200px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByRole("timer");
    await expect(badge).toHaveTextContent("Verrouillage dans 23 h 59 min");
    await expect(badge.getClientRects().length).toBe(1);
  },
};
