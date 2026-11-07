import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { EventSummary } from "@/domain/event";

import { EventCard } from "./event-card";

const now = new Date("2026-09-11T18:00:00.000Z");
const inSeconds = (secs: number) => new Date(now.getTime() + secs * 1000).toISOString();

const baseEvent: EventSummary = {
  id: "ev-100m-f",
  slug: "f-100m",
  discipline: "100 m",
  gender: "F",
  startsAt: inSeconds(3600),
  lockAt: inSeconds(3300),
  isFeatured: true,
  status: "upcoming",
};

const meta = {
  title: "Events/EventCard",
  component: EventCard,
  args: { timeZone: "Europe/Budapest", now },
  decorators: [
    (Story) => (
      <ul className="max-w-sm bg-background p-6">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof EventCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default upcoming event, the player hasn't predicted yet. */
export const Upcoming: Story = {
  args: { event: baseEvent },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("100 m")).toBeInTheDocument();
    await expect(canvas.getByText(/\+ Prono/)).toBeInTheDocument();
  },
};

/** Lock imminent: countdown chip switches to the hot tone. */
export const LockImminent: Story = {
  args: {
    event: { ...baseEvent, lockAt: inSeconds(5 * 60), startsAt: inSeconds(10 * 60) },
  },
};

/** The player has already submitted a prediction. */
export const AlreadyPredicted: Story = {
  args: { event: baseEvent, hasMyPrediction: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Posé/)).toBeInTheDocument();
  },
};

/** Featured event: ★ marker on the meta line. */
export const Featured: Story = {
  args: { event: { ...baseEvent, discipline: "Perche", gender: "F", isFeatured: true } },
};

/** Not featured, so no star. */
export const NotFeatured: Story = {
  args: { event: { ...baseEvent, discipline: "400 m haies", gender: "M", isFeatured: false } },
};

/** Finished event: countdown is gone, chip reads "Terminé". */
export const Finished: Story = {
  args: {
    event: {
      ...baseEvent,
      status: "finished",
      startsAt: inSeconds(-3600),
      lockAt: inSeconds(-3900),
    },
  },
};

/** Long discipline name: must wrap, not push the chip off the card. */
export const LongName: Story = {
  args: {
    event: { ...baseEvent, discipline: "3000 m steeple-chase hommes — qualifications" },
  },
};
