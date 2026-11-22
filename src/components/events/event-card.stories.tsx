import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { DISCIPLINE_FAMILIES } from "@/domain/discipline";
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
  args: { now, tick: false, family: "sprint" },
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
  args: { event: baseEvent, mine: { predicted: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("100 m femmes")).toBeInTheDocument();
    await expect(canvas.getByText("Verrouille dans 3 h")).toBeInTheDocument();
    await expect(canvas.queryByText("Finale")).toBeNull();
    await expect(canvas.getByRole("link")).toHaveAccessibleName(
      /^100\sm femmes, \d\d:\d\d \+ Prono$/,
    );
  },
};

/** To do within the hour: the lock line turns red. */
export const ToDoUrgent: Story = {
  args: {
    event: { ...baseEvent, lockAt: inSeconds(42 * 60), startsAt: inSeconds(47 * 60) },
    mine: { predicted: false },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Verrouille dans 42 min")).toHaveClass(
      "text-accent-text",
    );
  },
};

/** Days ahead: still the time left to lock, in the format of the countdown (#800). */
export const ToDoLater: Story = {
  args: {
    event: {
      ...baseEvent,
      lockAt: inSeconds(3 * 86_400 + 4 * 3600),
      startsAt: inSeconds(3 * 86_400 + 4 * 3600 + 300),
    },
    mine: { predicted: false },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Verrouille dans 3 j 4 h")).toBeInTheDocument();
  },
};

const myPodium = [
  { athleteId: "a1", name: "Léa Fictive", countryCode: "FRA" },
  { athleteId: "a2", name: "Ana Exemple", countryCode: "JAM" },
  null,
];

/** Posed: my podium in short names instead of the lock line, still « modifiable » (#800). */
export const AlreadyPredicted: Story = {
  args: { event: baseEvent, mine: { predicted: true, podium: myPodium } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Léa F. · Ana E. · autre · modifiable")).toBeInTheDocument();
    await expect(canvas.queryByText(/Verrouille/)).toBeNull();
    // A screen reader hears the status too, not only « 100 m, femmes, hour » (#517).
    await expect(canvas.getByRole("link")).toHaveAccessibleName(
      /^100\sm femmes, \d\d:\d\d ✓ Posé$/,
    );
  },
};

/** Locked, not run yet, no podium: nothing left to do. */
export const Locked: Story = {
  args: {
    event: { ...baseEvent, lockAt: inSeconds(-60), startsAt: inSeconds(240) },
    mine: { predicted: false },
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
  winner: { name: "Léa Fictive", countryCode: "FRA" },
};

/** Finished, for a visitor: its winner and « Terminé » (#800). */
export const Finished: Story = {
  args: { event: finishedEvent },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Terminé")).toBeInTheDocument();
    await expect(canvas.getByText("🥇 Léa Fictive")).toBeInTheDocument();
  },
};

/** Finished, the result not in yet: no winner line. */
export const FinishedWithoutResult: Story = {
  args: { event: { ...finishedEvent, winner: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/🥇/)).toBeNull();
  },
};

/** Finished and scored: my result in one line, my points in green (#546). */
export const FinishedWithPoints: Story = {
  args: {
    event: finishedEvent,
    mine: {
      predicted: true,
      points: 6,
      hits: { exact: 2, onPodium: 0, perfect: false },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("🥇 Léa Fictive")).toBeInTheDocument();
    await expect(canvas.getByText("2 athlètes bien placées")).toBeInTheDocument();
    await expect(canvas.queryByText(/Posé/)).toBeNull();
    await expect(canvas.getByRole("link")).toHaveAccessibleName(
      /^100\sm femmes, \d\d:\d\d \+6\spts$/,
    );
  },
};

/** A perfect podium says so. */
export const PerfectPodium: Story = {
  args: {
    event: finishedEvent,
    mine: {
      predicted: true,
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

/** Finished without my podium: « Pas joué », nothing on the right, never a lone dash (#707). */
export const FinishedWithoutPrediction: Story = {
  args: { event: finishedEvent, mine: { predicted: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pas joué")).toBeVisible();
    await expect(canvas.queryByText("—")).toBeNull();
    await expect(canvas.queryByText("+ Prono")).toBeNull();
    await expect(canvas.getByRole("link")).toHaveAccessibleName(
      /^100\sm femmes, \d\d:\d\d Pas joué$/,
    );
  },
};

/** Finished, predicted, points not computed yet: « Terminé », not « ✓ Posé » (#488). */
export const FinishedPointsPending: Story = {
  args: { event: finishedEvent, mine: { predicted: true, points: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Terminé")).toBeInTheDocument();
    await expect(canvas.queryByText(/Posé/)).toBeNull();
  },
};

/** Long discipline name and long athlete names: must wrap, not push the chip off the card. */
export const LongName: Story = {
  args: {
    event: {
      ...baseEvent,
      discipline: "3000 m steeple-chase — qualifications olympiques",
      isFeatured: false,
    },
    mine: {
      predicted: true,
      podium: [
        { athleteId: "a1", name: "Marie-Charlotte Exemple-Fictive", countryCode: "FRA" },
        { athleteId: "a2", name: "Anne-Sophie Démonstration", countryCode: "BEL" },
        { athleteId: "a3", name: "Jean-Baptiste Testeur", countryCode: "SUI" },
      ],
    },
  },
};

/** A long winner name wraps under the event name. */
export const LongWinnerName: Story = {
  args: {
    event: {
      ...finishedEvent,
      winner: { name: "Marie-Charlotte Exemple-Fictive de la Démonstration", countryCode: "FRA" },
    },
    mine: { predicted: false },
  },
};

/** Each family wears its animal (#800); relays and an unknown family, the hare. */
export const Families: Story = {
  args: { event: baseEvent },
  render: (args) => (
    <>
      {DISCIPLINE_FAMILIES.map((family) => (
        <EventCard
          key={family}
          {...args}
          family={family}
          event={{ ...args.event, id: family, slug: family, discipline: family }}
        />
      ))}
      <EventCard
        {...args}
        family={null}
        event={{ ...args.event, id: "unknown", discipline: "?" }}
      />
    </>
  ),
  decorators: [
    (Story) => (
      <ul className="flex max-w-sm flex-col gap-2 bg-background p-6">
        <Story />
      </ul>
    ),
  ],
  play: async ({ canvasElement }) => {
    const animals = [...canvasElement.querySelectorAll("[data-animal]")].map((svg) =>
      svg.getAttribute("data-animal"),
    );
    await expect(animals).toEqual([
      "guepard",
      "impala",
      "lievre",
      "lievre",
      "lievre",
      "kangourou",
      "chat",
      "ours",
      "renard",
      "lievre",
    ]);
    // Decorative: the card is named by the event, not by its animal.
    await expect(canvasElement.querySelector("[data-animal]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  },
};
