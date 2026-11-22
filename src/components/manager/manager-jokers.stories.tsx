import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { MANAGER_JOKERS } from "@/domain/manager-jokers";

import { DuelJokers, JokerEffects, ManagerJokerList, MatchdayJokers } from "./manager-jokers";

const text = messages.managerJokers;
const hand = messages.jokerHand;
const all = [...MANAGER_JOKERS];

const starters = [
  { athleteId: "s1", name: "Alice Fictive", family: "sprint" as const },
  { athleteId: "s2", name: "Berthe Démo", family: "jumps" as const },
];
const offSheet = [
  { athleteId: "o1", name: "Chloé Exemple", family: "sprint" as const },
  {
    athleteId: "o2",
    name: "Marie-Charlotte de La Tour-Fictive-Longuenom",
    family: "throws" as const,
  },
];
const opponentTeam = [
  { athleteId: "m1", name: "Mia Inventée" },
  { athleteId: "m2", name: "Noa Essai" },
];
const names = Object.fromEntries(
  [...starters, ...offSheet, ...opponentTeam].map((a) => [a.athleteId, a.name]),
);

const meta = {
  title: "Manager/MatchdayJokers",
  component: MatchdayJokers,
  args: {
    duel: { home: true },
    locked: false,
    hand: { remaining: all, used: [], onMatchday: null },
    mine: null,
    opponent: null,
    starters,
    offSheet,
    opponentTeam,
    names,
    play: fn(async () => ({})),
    coach: fn(async () => ({})),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MatchdayJokers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the lock: the false start is put down, then aimed at an athlete of the opponent. */
export const PickATarget: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(hand.hint)).toBeVisible();
    const card = canvas.getByRole("button", { name: /Faux départ/ });
    await userEvent.click(card);
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByText(text.explain.false_start)).toBeVisible();
    await expect(args.play).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "❓ Noa Essai" }));
    await expect(args.play).toHaveBeenCalledWith("false_start", "m2");
    await expect(
      await canvas.findByText(text.targetDone(text.name.false_start, "Noa Essai")),
    ).toBeVisible();
  },
};

/** The captain: the eight starters with the emoji of their family. */
export const Captain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Capitaine/ }));
    await expect(canvas.getByText(text.target.captain)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "💨 Alice Fictive" }));
    await expect(args.play).toHaveBeenCalledWith("captain", "s1");
  },
};

/** Away from home: the home advantage is hatched and disabled. */
export const Away: Story = {
  args: { duel: { home: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Avantage terrain/ })).toBeDisabled();
    await expect(canvas.getByText(text.away.label)).toBeVisible();
  },
};

/** A bonus matchday: no head-to-head, so no joker (the empty state). */
export const BonusDay: Story = {
  args: { duel: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.bonusDay)).toBeVisible();
  },
};

/** The database refuses taking the card back: the message shows under the hand. */
export const Refused: Story = {
  args: {
    hand: {
      remaining: ["coaching"],
      used: [{ kind: "captain", competitionId: "c1" }],
      onMatchday: "captain",
    },
    mine: { kind: "captain", athleteId: "s1", replacedId: null, coached: false },
    play: fn(async () => ({ error: "LINEUP_LOCKED" as const })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Capitaine/ }));
    await expect(args.play).toHaveBeenCalledWith(null, null);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(messages.errors.LINEUP_LOCKED);
  },
};

/** Coaching before the lock: it waits for the lock. */
export const CoachingWaits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Coaching/ }));
    await expect(args.play).toHaveBeenCalledWith("coaching", null);
    await expect(await canvas.findByText(text.coachingWaits)).toBeVisible();
  },
};

/** After the lock, both cards face up and the coaching in two steps, same family only (dark). */
export const CoachingDark: Story = {
  args: {
    locked: true,
    hand: {
      remaining: ["captain"],
      used: [{ kind: "coaching", competitionId: "c1" }],
      onMatchday: "coaching",
    },
    mine: { kind: "coaching", athleteId: null, replacedId: null, coached: false },
    opponent: { kind: "false_start", athleteName: "Alice Fictive" },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.revealed)).toBeVisible();
    await expect(canvas.getByText(text.revealTaunt(true, true))).toBeVisible();
    await expect(canvas.getByText(text.coachPickOut)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "💨 Alice Fictive" }));
    const comeIn = within(canvas.getByRole("group", { name: text.coachIn })).getAllByRole("button");
    await expect(comeIn.map((b) => b.textContent)).toEqual(["💨 Chloé Exemple"]);
    await userEvent.click(comeIn[0]!);
    await userEvent.click(canvas.getByRole("button", { name: text.coachSend }));
    await expect(args.coach).toHaveBeenCalledWith("s1", "o1");
  },
};

/** The coaching used, every joker played: a long name stays inside the screen. */
export const AllPlayed: Story = {
  args: {
    locked: true,
    hand: {
      remaining: [],
      used: all.map((kind, i) => ({ kind, competitionId: `c${i}` })),
      onMatchday: "coaching",
    },
    mine: { kind: "coaching", athleteId: "o2", replacedId: "s2", coached: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.revealTaunt(true, false))).toBeVisible();
    await expect(
      canvas.getByText(
        text.coachDone("Marie-Charlotte de La Tour-Fictive-Longuenom", "Berthe Démo"),
      ),
    ).toBeVisible();
  },
};

/** Before the lock, every card played on other matchdays: hatched, no card left. */
export const HandEmpty: Story = {
  args: {
    hand: {
      remaining: [],
      used: all.map((kind, i) => ({ kind, competitionId: `c${i}` })),
      onMatchday: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(hand.count(0))).toBeVisible();
    for (const button of canvas.getAllByRole("button")) await expect(button).toBeDisabled();
  },
};

/** The jokers a new league receives, read only. */
export const List: StoryObj<typeof ManagerJokerList> = {
  render: () => <ManagerJokerList jokers={all} />,
  play: async ({ canvasElement }) => {
    for (const joker of all) {
      await expect(within(canvasElement).getByText(text.explain[joker])).toBeVisible();
    }
  },
};

/** What the jokers changed in « Mes points »: a captain, a false start suffered, a lost one. */
export const Effects: StoryObj<typeof JokerEffects> = {
  render: () => (
    <JokerEffects
      effects={[
        { kind: "captain", by: "me", athleteId: "s1", points: 120, name: "Alice Fictive" },
        { kind: "false_start", by: "opponent", athleteId: "s2", points: -48, name: "Berthe Démo" },
        { kind: "home_advantage", by: "me", athleteId: null, points: 0 },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The points keep their unit on the same line (a non-breaking space).
    await expect(canvas.getByText(/^\+120\spts$/)).toBeVisible();
    await expect(canvas.getByText(/^-48\spts$/)).toBeVisible();
    await expect(canvas.getByText(text.noEffect)).toBeVisible();
  },
};

/** Both jokers of a head-to-head, before the score (no points yet). */
export const Duel: StoryObj<typeof DuelJokers> = {
  render: () => (
    <DuelJokers
      sides={[
        {
          pseudo: "Ami Fictif",
          joker: { kind: "home_advantage", athleteName: null, points: null },
        },
        { pseudo: "Moi", joker: { kind: "captain", athleteName: "Alice Fictive", points: null } },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        `🃏 ${text.duelLine("Moi", text.name.captain, "Alice Fictive")}`,
      ),
    ).toBeVisible();
  },
};
