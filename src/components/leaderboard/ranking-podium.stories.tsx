import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { rankPlayers } from "@/domain/ranking";

import type { LeaderboardRow } from "./leaderboard";
import { RankingPodium } from "./ranking-podium";

// Invented players.
const row = (userId: string, pseudo: string, points: number): LeaderboardRow => ({
  ...rankPlayers([{ userId, pseudo, points, perfectPodiums: 0, winnersFound: 0 }])[0]!,
  bib: { number: Number(userId) * 7, color: "blue" },
});
const ranked = (players: [string, string, number][]): LeaderboardRow[] =>
  rankPlayers(
    players.map(([userId, pseudo, points]) => ({
      userId,
      pseudo,
      points,
      perfectPodiums: 0,
      winnersFound: 0,
    })),
  ).map((p) => ({ ...p, bib: row(p.userId, p.pseudo, p.points).bib }));

const meta = {
  title: "Leaderboard/RankingPodium",
  component: RankingPodium,
  args: {
    rows: ranked([
      ["1", "Démo Gazelle", 58],
      ["2", "Foulée_Bleue", 41],
      ["3", "Démo Haie", 35],
      ["4", "Démo Relais", 12],
    ]),
    meId: "2",
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RankingPodium>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first three on steps 2-1-3, read 1-2-3; me on the second step. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const podium = within(canvasElement).getByRole("list", { name: "Podium" });
    const steps = within(podium).getAllByRole("listitem");
    await expect(steps.map((s) => s.textContent)).toEqual([
      "7Démo Gazelle58 pts11er",
      "14Foulée_BleueToi41 pts22e",
      "21Démo Haie35 pts33e",
    ]);
    await expect(steps[1]).toHaveAttribute("aria-current", "true");
  },
};

/** Two players tied first share the top step's number. */
export const Tie: Story = {
  args: {
    rows: ranked([
      ["1", "Ana", 20],
      ["2", "Bob", 20],
      ["3", "Cleo", 9],
    ]),
    meId: undefined,
  },
  play: async ({ canvasElement }) => {
    const steps = within(canvasElement).getAllByRole("listitem");
    await expect(steps.map((s) => s.textContent?.slice(-3))).toEqual(["1er", "1er", "33e"]);
  },
};

/** A very long pseudo wraps inside its step. */
export const LongPseudo: Story = {
  args: {
    rows: ranked([
      ["1", "Maximilienne-Augustine_du_Stade_de_France_Saint-Denis", 22],
      ["2", "Bob", 20],
      ["3", "Cleo", 9],
    ]),
  },
  play: async ({ canvasElement }) => {
    const podium = within(canvasElement).getByRole("list", { name: "Podium" });
    await expect(podium.scrollWidth).toBeLessThanOrEqual(podium.clientWidth + 1);
  },
};

/** Nobody has points yet: no podium. */
export const Empty: Story = {
  args: { rows: ranked([["1", "Ana", 0]]) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("list")).toBeNull();
  },
};
