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
  startsAt: inSeconds(3 * 3600 + 300),
  lockAt: inSeconds(3 * 3600),
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

/** Visitor: when it locks and « + Prono », which leads to the sign-in. */
export const Visitor: Story = {
  args: { event: baseEvent },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Verrouille dans 3 h")).toBeInTheDocument();
    await expect(canvas.getByText("+ Prono")).toBeInTheDocument();
  },
};

/** To do: the name with its gender, when it locks, « + Prono »; no « Finale » nor initial (#546). */
export const ToDo: Story = {
  args: { event: baseEvent, mine: { predicted: false, joker: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("100 m femmes")).toBeInTheDocument();
    await expect(canvas.getByText("Verrouille dans 3 h")).toBeInTheDocument();
    await expect(canvas.queryByText("Finale")).toBeNull();
    await expect(canvas.getByRole("link")).toHaveAccessibleName(
      /^100 m, Femmes, \d\d:\d\d \+ Prono$/,
    );
  },
};

/** To do within the hour: the lock line turns red. */
export const ToDoUrgent: Story = {
  args: {
    event: { ...baseEvent, lockAt: inSeconds(42 * 60), startsAt: inSeconds(47 * 60) },
    mine: { predicted: false, joker: false },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Verrouille dans 42 min")).toHaveClass(
      "text-accent-text",
    );
  },
};

/** More than 24 hours ahead: the lock day and hour. */
export const ToDoLater: Story = {
  args: {
    event: { ...baseEvent, lockAt: inSeconds(3 * 86_400), startsAt: inSeconds(3 * 86_400 + 300) },
    mine: { predicted: false, joker: false },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/^Verrouille le lundi 14 septembre à \d\d:\d\d$/),
    ).toBeInTheDocument();
  },
};

/** Posed: « ✓ Posé », still « modifiable » until the lock. */
export const AlreadyPredicted: Story = {
  args: { event: baseEvent, mine: { predicted: true, joker: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/· modifiable/)).toBeInTheDocument();
    // A screen reader hears the status too, not only « 100 m, femmes, hour » (#517).
    await expect(canvas.getByRole("link")).toHaveAccessibleName(
      /^100 m, Femmes, \d\d:\d\d ✓ Posé$/,
    );
  },
};

/** Prediction + joker spent on this event. */
export const PredictedWithJoker: Story = {
  args: { event: baseEvent, mine: { predicted: true, joker: true } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Joker/)).toBeInTheDocument();
  },
};

/** Locked, not run yet, no podium: nothing left to do. */
export const Locked: Story = {
  args: {
    event: { ...baseEvent, lockAt: inSeconds(-60), startsAt: inSeconds(240) },
    mine: { predicted: false, joker: false },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("🔒 Verrouillé")).toBeInTheDocument();
  },
};

const finishedEvent: EventSummary = {
  ...baseEvent,
  status: "finished",
  round: "final",
  startsAt: inSeconds(-3600),
  lockAt: inSeconds(-3900),
};

/** Finished, for a visitor: « Terminé ». */
export const Finished: Story = {
  args: { event: finishedEvent },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Terminé")).toBeInTheDocument();
  },
};

/** Finished and scored: my result in one line, my points in green (#546). */
export const FinishedWithPoints: Story = {
  args: {
    event: finishedEvent,
    mine: {
      predicted: true,
      joker: false,
      points: 6,
      hits: { exact: 2, onPodium: 0, perfect: false },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2 athlètes bien placées")).toBeInTheDocument();
    await expect(canvas.queryByText(/Posé/)).toBeNull();
    await expect(canvas.getByRole("link")).toHaveAccessibleName(
      /^100 m, Femmes, \d\d:\d\d \+6 pts$/,
    );
  },
};

/** A perfect podium says so. */
export const PerfectPodium: Story = {
  args: {
    event: finishedEvent,
    mine: {
      predicted: true,
      joker: false,
      points: 12,
      hits: { exact: 3, onPodium: 0, perfect: true },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Podium parfait !")).toBeInTheDocument();
    await expect(canvas.getByText("+12 pts")).toBeInTheDocument();
  },
};

/** Finished without my podium: « Pas de prono » and a dash. */
export const FinishedWithoutPrediction: Story = {
  args: { event: finishedEvent, mine: { predicted: false, joker: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pas de prono")).toBeInTheDocument();
    await expect(canvas.getByText("—")).toBeInTheDocument();
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
    event: {
      ...baseEvent,
      discipline: "3000 m steeple-chase — qualifications olympiques",
      isFeatured: false,
    },
    mine: { predicted: true, joker: true },
  },
};
