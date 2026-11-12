import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import type { Bib } from "@/domain/bib";
import { rankPlayers } from "@/domain/ranking";

import { Leaderboard, type LeaderboardRow } from "./leaderboard";

// Invented players.
const players = rankPlayers([
  { userId: "1", pseudo: "Démo Gazelle", points: 58, perfectPodiums: 2, winnersFound: 4 },
  { userId: "2", pseudo: "Foulée_Bleue", points: 41, perfectPodiums: 1, winnersFound: 3 },
  { userId: "3", pseudo: "Démo Haie", points: 35, perfectPodiums: 0, winnersFound: 3 },
  { userId: "4", pseudo: "Démo Relais", points: 35, perfectPodiums: 0, winnersFound: 3 },
  { userId: "5", pseudo: "Démo Javelot", points: 9, perfectPodiums: 0, winnersFound: 0 },
  { userId: "6", pseudo: "Démo Sprint", points: 0, perfectPodiums: 0, winnersFound: 0 },
]);
const bibs: Bib[] = [
  { number: 7, color: "blue" },
  { number: 42, color: "red" },
  { number: 110, color: "gold" },
  { number: 4, color: "green" },
  { number: 999, color: "white" },
  { number: 0, color: "night" },
];
const rows: LeaderboardRow[] = players.map((p) => ({
  ...p,
  bib: bibs[Number(p.userId) - 1]!,
}));

const meta = {
  title: "Leaderboard/Leaderboard",
  component: Leaderboard,
  args: { rows, meId: "2", retryHref: "/classement" },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Leaderboard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Me highlighted, a tie for third, a player without points. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");
    await expect(items).toHaveLength(6);
    await expect(items[1]).toHaveAttribute("aria-current", "true");
    await expect(items[1]).toHaveTextContent("Toi · 1 podium parfait");
    await expect(items[2]).toHaveTextContent("3e");
    await expect(items[3]).toHaveTextContent("3e");
    await expect(canvas.getAllByText("ex æquo")).toHaveLength(2);
    await expect(items[5]).toHaveTextContent("Pas encore de points");
  },
};

/** Places won and lost since yesterday (#551): ▲ green, ▼ red, « = » otherwise; no 🔥 badge. */
export const WithChanges: Story = {
  args: {
    rows: rows.map((r, i) => ({ ...r, change: [2, -1, 0, 1, null, -3][i] ?? null })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");
    await expect(canvas.getByText("2 places gagnées depuis hier")).toBeInTheDocument();
    await expect(canvas.getByText("1 place perdue depuis hier")).toBeInTheDocument();
    await expect(items[2]).toHaveTextContent("=même place qu'hier");
    await expect(items[4]).toHaveTextContent("=pas classé hier");
    await expect(canvasElement).not.toHaveTextContent("🔥");
  },
};

/** A long ranking cut after the top (#551): « ··· », then me and my neighbours; my row is the anchor. */
export const Window: Story = {
  args: {
    rows: [...rows.slice(0, 2), null, ...rows.slice(4)].map((r) =>
      r ? { ...r, change: 0 } : null,
    ),
    meId: "5",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    await expect(canvasElement).toHaveTextContent("···");
    await expect(canvasElement.querySelector("#moi")).toHaveTextContent("Démo Javelot");
  },
};

/** Touching a pseudo opens the player's card under the row (#342). */
export const OpensPlayerCard: Story = {
  args: {
    rows: rows.map((r) => ({ ...r, club: r.userId === "1" ? "Foulées de Fictiville" : null })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByRole("button", { name: "Voir la fiche de Démo Gazelle" });
    await expect(name).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(name);
    await expect(name).toHaveAttribute("aria-expanded", "true");
    const card = canvas.getByRole("region", { name: "Fiche de Démo Gazelle" });
    await expect(card).toHaveTextContent("Foulées de Fictiville");
    await expect(card).toHaveTextContent("1er sur 6 joueurs");
    await userEvent.click(name);
    await expect(canvas.queryByRole("region")).toBeNull();
  },
};

/** Equal players share the place and the next place is skipped. */
export const Ties: Story = {
  args: {
    rows: rankPlayers([
      { userId: "a", pseudo: "Ana", points: 10, perfectPodiums: 0, winnersFound: 1 },
      { userId: "b", pseudo: "Bob", points: 10, perfectPodiums: 0, winnersFound: 1 },
      { userId: "c", pseudo: "Cleo", points: 4, perfectPodiums: 0, winnersFound: 0 },
    ]).map((p, i) => ({ ...p, bib: bibs[i]! })),
    meId: undefined,
  },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");
    await expect(items.map((i) => i.querySelector("span")?.textContent?.slice(0, 3))).toEqual([
      "1er",
      "1er",
      "3e3",
    ]);
  },
};

/** A very long pseudo wraps instead of pushing the points out. */
export const LongPseudo: Story = {
  args: {
    rows: [
      {
        userId: "x",
        pseudo: "Maximilienne-Augustine_du_Stade_de_France_Saint-Denis",
        points: 22,
        perfectPodiums: 0,
        winnersFound: 2,
        rank: 1,
        bib: { number: 999, color: "white" },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const item = within(canvasElement).getByRole("listitem");
    await expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
    await expect(item).toHaveTextContent("22");
  },
};

/** Nothing scored yet. */
export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Pas encore de classement/)).toBeInTheDocument();
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

export const Error: Story = {
  args: { status: "error" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("classement");
  },
};
