import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { MySeason } from "@/application/manager-home";
import type { ManagerLeague } from "@/application/manager-leagues";
import { messages } from "@/app/messages.fr";

import { ManagerLeagueCard } from "./manager-league-card";

const text = messages.managerLeagueCard;
const NOW = new Date("2026-11-13T12:00:00.000Z");

const league: ManagerLeague = {
  id: "L",
  name: "Ligue des copains",
  isPublic: false,
  inviteCode: "ABCD1234",
  ownerId: "u1",
  memberCount: 4,
  target: 4,
};

const waiting: MySeason = {
  leagueId: "L",
  step: "league",
  mercato: null,
  round: null,
  standing: null,
  next: null,
  lineup: null,
  lastPoints: null,
};

const mercato: MySeason = {
  ...waiting,
  step: "mercato",
  // Round 2 ends in 1 day and 3 hours.
  mercato: { round: 2, endsAt: "2026-11-14T15:00:00.000Z" },
};

const lineup: MySeason = {
  ...waiting,
  step: "lineup",
  round: { current: 3, total: 12 },
  standing: { rank: 2, points: 4, wins: 1, draws: 1, losses: 0, difference: 120 },
  lineup: { slug: "meeting-3", lockAt: "2026-11-15T12:00:00.000Z" },
};

function decorator(className: string) {
  return function Frame(Story: () => React.ReactNode) {
    return (
      <div className={`w-[390px] p-4 ${className}`}>
        <Story />
      </div>
    );
  };
}

const meta = {
  title: "Manager/ManagerLeagueCard",
  component: ManagerLeagueCard,
  args: { league, season: lineup, now: NOW },
  decorators: [decorator("bg-background text-foreground")],
} satisfies Meta<typeof ManagerLeagueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waiting for its players: no place, no deadline, nothing to do yet. */
export const Waiting: Story = {
  args: { season: waiting, league: { ...league, memberCount: 2 } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link", { name: "Ligue des copains" });
    await expect(card).toHaveAttribute("href", "/manager/L");
    await expect(card).toHaveAccessibleDescription(/En attente des joueurs/);
    await expect(card).toHaveAccessibleDescription(/2 \/ 4 participants · Privée/);
    await expect(within(card).queryByText(text.cue.mercato)).toBeNull();
  },
};

/** The mercato is open: the round, when it ends, and the bids to make. */
export const Mercato: Story = {
  args: { season: mercato },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link", { name: "Ligue des copains" });
    await expect(card).toHaveAccessibleDescription(/Mercato · tour 2/);
    await expect(card).toHaveAccessibleDescription(/Fin du tour dans 1 j 3 h/);
    await expect(card).toHaveAccessibleDescription(/Enchères à faire/);
  },
};

/** Matchday 3 of 12: the place, the lineup lock and the lineup to validate. */
export const LineupToDo: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link", { name: "Ligue des copains" });
    await expect(card).toHaveAccessibleDescription(/Saison · journée 3 sur 12 · 2e place/);
    await expect(card).toHaveAccessibleDescription(/Verrou d'alignement dans 2 j/);
    await expect(card).toHaveAccessibleDescription(/Alignement à valider/);
  },
};

/** The season is over. */
export const SeasonOver: Story = {
  args: {
    season: {
      ...lineup,
      step: "champion",
      round: { current: 12, total: 12 },
      standing: { ...lineup.standing!, rank: 1 },
      lineup: null,
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link", { name: "Ligue des copains" });
    await expect(card).toHaveAccessibleDescription(/Saison terminée · 1re place/);
    await expect(within(card).queryByText(text.cue.lineup)).toBeNull();
  },
};

/** The season could not be read: the card still leads to the league. */
export const SeasonUnavailable: Story = {
  args: { season: null },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link", { name: "Ligue des copains" });
    await expect(card).toHaveAccessibleDescription("4 / 4 participants · Privée");
  },
};

/** Dark theme. */
export const Dark: Story = {
  args: { season: mercato },
  decorators: [decorator("dark bg-background text-foreground")],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Ligue des copains" }),
    ).toBeVisible();
  },
};

/** A long name wraps inside the 390 px screen, next to the cue. */
export const LongText: Story = {
  args: {
    league: {
      ...league,
      name: "La très grande ligue des amis du stade Charléty et de ses environs",
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
