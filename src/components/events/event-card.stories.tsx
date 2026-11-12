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
  round: "final",
};

const meta = {
  title: "Events/EventCard",
  component: EventCard,
  args: { now, tick: false },
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

/** Visitor: only the countdown, no "À pronostiquer". */
export const Visitor: Story = {
  args: { event: baseEvent },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/\+ Prono/)).toBeNull();
  },
};

/** Signed-in player who hasn't predicted yet. */
export const Upcoming: Story = {
  args: { event: baseEvent, mine: { predicted: false, joker: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("100 m")).toBeInTheDocument();
    await expect(canvas.getByText(/\+ Prono/)).toBeInTheDocument();
  },
};

/** Lock imminent: CountdownBadge switches to the very-soon tone. */
export const LockImminent: Story = {
  args: {
    event: { ...baseEvent, lockAt: inSeconds(5 * 60), startsAt: inSeconds(10 * 60) },
  },
};

/** The player has already submitted a prediction — no countdown shown, chip reads "Pronostiqué". */
export const AlreadyPredicted: Story = {
  args: { event: baseEvent, mine: { predicted: true, joker: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Posé/)).toBeInTheDocument();
  },
};

/** Prediction + joker spent on this event. */
export const PredictedWithJoker: Story = {
  args: { event: baseEvent, mine: { predicted: true, joker: true } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Joker/)).toBeInTheDocument();
  },
};

/** Not featured, so no star. */
export const NotFeatured: Story = {
  args: { event: { ...baseEvent, discipline: "400 m haies", gender: "M", isFeatured: false } },
};

const finishedEvent: EventSummary = {
  ...baseEvent,
  status: "finished",
  round: "final",
  startsAt: inSeconds(-3600),
  lockAt: inSeconds(-3900),
};

/** Finished event: countdown is gone, chip reads "Terminé". */
export const Finished: Story = {
  args: { event: finishedEvent },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Terminé")).toBeInTheDocument();
  },
};

/** Finished and scored: the points won replace « ✓ Posé » (#488). */
export const FinishedWithPoints: Story = {
  args: { event: finishedEvent, mine: { predicted: true, joker: false, points: 12 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("+12 pts")).toBeInTheDocument();
    await expect(canvas.queryByText(/Posé/)).toBeNull();
  },
};

/** Finished, predicted, points not computed yet: « Terminé », not « ✓ Posé » (#488). */
export const FinishedPointsPending: Story = {
  args: { event: finishedEvent, mine: { predicted: true, joker: false, points: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Terminé")).toBeInTheDocument();
    await expect(canvas.queryByText(/Posé/)).toBeNull();
  },
};

/** Long discipline name: must wrap, not push the chip off the card. */
export const LongName: Story = {
  args: {
    event: { ...baseEvent, discipline: "3000 m steeple-chase hommes — qualifications" },
  },
};
