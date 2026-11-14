import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LeagueCard, LeagueCardSkeleton } from "./league-card";

const text = messages.leagues;

const meta = {
  title: "Leagues/LeagueCard",
  component: LeagueCard,
  args: {
    href: "/ligues/demo",
    name: "Les Foulées",
    memberCount: 6,
    summary: { count: 3, start: "2027-03", end: "2027-09" },
    next: { name: "Meeting de Testville", startsOn: "2027-06-12" },
    standing: { rank: 3, change: null },
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeagueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Summed up (#662): how many competitions over which months, the next one, my place out of N. */
export const Rank: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3e")).toBeVisible();
    await expect(canvas.getByText(text.rankLabel(3))).toBeInTheDocument();
    await expect(canvas.getByText("sur 6")).toBeVisible();
    await expect(canvas.getByText("3 compétitions · mars → sept. 2027")).toBeVisible();
    await expect(canvas.getByText("Prochaine : Meeting de Testville, 12 juin")).toBeVisible();
    await expect(canvas.getByText(text.privateBadge)).toBeVisible();
  },
};

/** Two places won since yesterday; a lost place shows ▼. */
export const Movement: Story = {
  args: { standing: { rank: 1, change: 2 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1er")).toBeVisible();
    await expect(canvas.getByText(messages.leaderboard.change(2))).toBeInTheDocument();
  },
};

/** Empty: no competition nor points yet, a short note instead of a place. */
export const Empty: Story = {
  args: {
    standing: null,
    memberCount: 1,
    summary: { count: 0, start: null, end: null },
    next: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noPointsYet)).toBeVisible();
    await expect(canvas.getByText(text.noCompetitionTag)).toBeVisible();
    await expect(canvas.queryByText(/Prochaine/)).toBeNull();
  },
};

/** A public league limited to families shows them in a badge: « Sprint · Haies » (#613). */
export const Families: Story = {
  args: { families: ["hurdles", "sprint"], isPublic: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.familiesBadge(["Sprint", "Haies"]))).toBeVisible();
    await expect(canvas.getByText(text.publicBadge)).toBeVisible();
  },
};

/** The official league says so. */
export const Official: Story = {
  args: { name: "Ligue FrenchTrack", isPublic: true, isOfficial: true, memberCount: 1234 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.officialBadge)).toBeVisible();
  },
};

/** While loading: a card-shaped placeholder. */
export const Loading: Story = {
  render: () => <LeagueCardSkeleton />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-hidden]")).not.toBeNull();
  },
};

/**
 * A long name on two lines at most and twelve competitions over two years: no competition name,
 * the place stays on the right.
 */
export const LongText: Story = {
  args: {
    name: "Les Gazelles infatigables de la Vallée de la Haute-Testrivière et de ses environs",
    isPublic: true,
    families: ["combined", "relay", "middle", "long", "jumps", "throws"],
    memberCount: 48,
    summary: { count: 12, start: "2026-12", end: "2027-09" },
    next: {
      name: "Championnats interrégionaux en salle de la Vallée de la Haute-Testrivière",
      startsOn: "2027-01-23",
    },
    standing: { rank: 12, change: -3 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("link");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
    await expect(canvas.getByText("12e")).toBeVisible();
    await expect(canvas.getByText("12 compétitions · déc. 2026 → sept. 2027")).toBeVisible();
    await expect(canvas.queryByText(/Meeting/)).toBeNull();
  },
};

/** At 320 px the note on the right stays readable and the card does not overflow (#708). */
export const NarrowEmpty: Story = {
  args: {
    standing: null,
    memberCount: 1,
    name: "Ligue des amis du dimanche matin au stade",
    summary: { count: 0, start: null, end: null },
    next: null,
  },
  decorators: [
    (Story) => (
      <div className="w-[288px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const players = canvas.getByText(text.players(1));
    await expect(players).toBeVisible();
    await expect(canvas.getByText("Sans compétition")).toBeVisible();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};
