import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

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
const avatars = ["🦌", "🦅", "🐆", "🐎", "🐺", "🐇"];
const rows: LeaderboardRow[] = players.map((p) => ({
  ...p,
  avatar: avatars[Number(p.userId) - 1],
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

/** Places won and lost since the last computed event (▲ green, ▼ red, — same place). */
export const WithChanges: Story = {
  args: {
    rows: rows.map((r, i) => ({
      ...r,
      change: [2, -1, 0, 1, null, -3][i] ?? null,
      streak: [3, 2, 1, 0, 0, 0][i] ?? 0,
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("2 places gagnées depuis la dernière épreuve"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("1 place perdue depuis la dernière épreuve")).toBeInTheDocument();
    await expect(canvas.getAllByRole("listitem")[4]).not.toHaveTextContent("▲");
    await expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent("🔥3");
    await expect(canvas.getAllByRole("listitem")[2]).not.toHaveTextContent("🔥");
  },
};

/** Equal players share the place and the next place is skipped. */
export const Ties: Story = {
  args: {
    rows: rankPlayers([
      { userId: "a", pseudo: "Ana", points: 10, perfectPodiums: 0, winnersFound: 1 },
      { userId: "b", pseudo: "Bob", points: 10, perfectPodiums: 0, winnersFound: 1 },
      { userId: "c", pseudo: "Cleo", points: 4, perfectPodiums: 0, winnersFound: 0 },
    ]),
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
