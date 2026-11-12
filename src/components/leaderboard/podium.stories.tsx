import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { rankPlayers } from "@/domain/ranking";

import { Podium } from "./podium";
import type { LeaderboardRow } from "./ranking-row";

// Invented players.
const rows: LeaderboardRow[] = rankPlayers([
  { userId: "1", pseudo: "Démo Gazelle", points: 58, perfectPodiums: 2, winnersFound: 4 },
  { userId: "2", pseudo: "Foulée_Bleue", points: 52, perfectPodiums: 1, winnersFound: 3 },
  { userId: "3", pseudo: "Démo Haie", points: 35, perfectPodiums: 0, winnersFound: 3 },
  { userId: "4", pseudo: "Démo Relais", points: 9, perfectPodiums: 0, winnersFound: 0 },
]).map((p, i) => ({
  ...p,
  bib: [
    { number: 7, color: "blue" as const },
    { number: 42, color: "red" as const },
    { number: 110, color: "gold" as const },
    { number: 4, color: "green" as const },
  ][i]!,
}));

const meta = {
  title: "Leaderboard/Podium",
  component: Podium,
  args: { rows, meId: "2" },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Podium>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first three on steps 2-1-3, read 1-2-3; my place outlined. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const places = within(canvas.getByRole("list", { name: "Podium" })).getAllByRole("listitem");
    await expect(places).toHaveLength(3);
    await expect(places[0]).toHaveAccessibleName("1er : Démo Gazelle, 58 points");
    await expect(places[1]).toHaveAttribute("aria-current", "true");
    // The winner stands in the middle.
    const left = (i: number) => places[i]!.getBoundingClientRect().left;
    await expect(left(1)).toBeLessThan(left(0));
    await expect(left(0)).toBeLessThan(left(2));
    await expect(canvas.queryByText("Démo Relais")).toBeNull();
  },
};

/** Two players tied for second share the place. */
export const Tie: Story = {
  args: {
    rows: rankPlayers([
      { userId: "a", pseudo: "Ana", points: 20, perfectPodiums: 0, winnersFound: 1 },
      { userId: "b", pseudo: "Bob", points: 10, perfectPodiums: 0, winnersFound: 1 },
      { userId: "c", pseudo: "Cleo", points: 10, perfectPodiums: 0, winnersFound: 1 },
    ]).map((p) => ({ ...p, bib: { number: 1, color: "white" as const } })),
    meId: undefined,
  },
  play: async ({ canvasElement }) => {
    const places = within(canvasElement).getAllByRole("listitem");
    await expect(places[1]).toHaveAccessibleName("2e : Bob, 10 points");
    await expect(places[2]).toHaveAccessibleName("2e : Cleo, 10 points");
  },
};

/** Only two players have points: two steps. */
export const TwoPlayers: Story = {
  args: { rows: [rows[0]!, rows[1]!, { ...rows[2]!, points: 0 }] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(2);
  },
};

/** Nobody has points yet: no podium. */
export const Empty: Story = {
  args: { rows: rows.map((r) => ({ ...r, points: 0 })) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("list")).toBeNull();
  },
};

/** Long pseudos wrap inside their step. */
export const LongText: Story = {
  args: {
    rows: rows.map((r) => ({ ...r, pseudo: `${r.pseudo}_du_Stade_de_France_Saint-Denis` })),
  },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list");
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth + 1);
  },
};

export const Loading: Story = {
  args: { status: "loading" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveAccessibleName(
      "Chargement du classement…",
    );
  },
};
