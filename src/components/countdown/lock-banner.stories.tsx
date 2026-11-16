import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { LockBanner } from "./lock-banner";

const NOW = new Date("2026-09-12T18:00:00Z");
const inSeconds = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

const meta = {
  title: "Countdown/LockBanner",
  component: LockBanner,
  args: { now: NOW, lockAt: inSeconds(22 * 3600 + 18 * 60 + 33) },
  decorators: [
    (Story) => (
      <div className="bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LockBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectBanner = async (canvasElement: HTMLElement, text: string, alert: boolean) => {
  const banner = within(canvasElement).getByRole("timer");
  await expect(banner).toHaveTextContent(text);
  await expect(banner).toHaveAttribute("data-alert", String(alert));
};

/** More than one hour before the lock: neutral, not an alert (#989). */
export const Calm: Story = {
  play: async ({ canvasElement }) => expectBanner(canvasElement, "22:18:33", false),
};

/** Days ahead: the longest text, still neutral. */
export const DaysAhead: Story = {
  args: { lockAt: inSeconds(3 * 86400 + 4 * 3600) },
  play: async ({ canvasElement }) => expectBanner(canvasElement, "3 j 04:00:00", false),
};

/** The last hour: red. */
export const LastHour: Story = {
  args: { lockAt: inSeconds(12 * 60 + 4) },
  play: async ({ canvasElement }) => expectBanner(canvasElement, "00:12:04", true),
};

/** From the lock time itself. */
export const Locked: Story = {
  args: { lockAt: NOW.toISOString() },
  play: async ({ canvasElement }) =>
    expect(within(canvasElement).getByText(/Verrouillé/)).toBeInTheDocument(),
};
