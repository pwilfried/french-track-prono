import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { RankingRow, type LeaderboardRow } from "./ranking-row";

// An invented player.
const row: LeaderboardRow = {
  userId: "1",
  pseudo: "Démo Gazelle",
  points: 52,
  perfectPodiums: 1,
  winnersFound: 3,
  rank: 3,
  bib: { number: 42, color: "red" },
  change: 0,
};

const meta = {
  title: "Leaderboard/RankingRow",
  component: RankingRow,
  args: { row, total: 12 },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <ol className="flex flex-col rounded-card border border-border bg-card p-2">
          <Story />
        </ol>
      </div>
    ),
  ],
} satisfies Meta<typeof RankingRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** My line: highlighted, « Toi », target of « Autour de moi ». */
export const Me: Story = {
  args: { me: true },
  play: async ({ canvasElement }) => {
    const item = within(canvasElement).getByRole("listitem");
    await expect(item).toHaveAttribute("aria-current", "true");
    await expect(item).toHaveAttribute("id", "moi");
    await expect(item).toHaveTextContent("Toi · 1 podium parfait");
  },
};

/** Two places won since yesterday. */
export const Up: Story = {
  args: { row: { ...row, change: 2 } },
  play: async ({ canvasElement }) => {
    const item = within(canvasElement).getByRole("listitem");
    await expect(item).toHaveTextContent("▲2");
    await expect(item).toHaveTextContent("2 places gagnées depuis la veille");
    await expect(item).not.toHaveAttribute("id");
  },
};

/** One place lost since yesterday. */
export const Down: Story = {
  args: { row: { ...row, change: -1 } },
  play: async ({ canvasElement }) => {
    const item = within(canvasElement).getByRole("listitem");
    await expect(item).toHaveTextContent("▼1");
    await expect(item).toHaveTextContent("1 place perdue depuis la veille");
  },
};

/** Same place as yesterday: « = ». */
export const Same: Story = {
  play: async ({ canvasElement }) => {
    const item = within(canvasElement).getByRole("listitem");
    await expect(item).toHaveTextContent("=");
    await expect(item).toHaveTextContent("même place que la veille");
  },
};

/** A tie: the place is shared and marked « ex æquo ». */
export const Tie: Story = {
  args: { tied: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("ex æquo")).toBeVisible();
  },
};

/** Not ranked yesterday: no move shown. */
export const New: Story = {
  args: { row: { ...row, change: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("listitem")).not.toHaveTextContent(/[▲▼=]/);
  },
};

/** A very long pseudo and a large score wrap instead of pushing the points out. */
export const LongText: Story = {
  args: {
    me: true,
    tied: true,
    row: {
      ...row,
      pseudo: "Maximilienne-Augustine_du_Stade_de_France_Saint-Denis",
      points: 1288,
      rank: 128,
      change: -12,
      bib: { number: 999, color: "white" },
    },
  },
  play: async ({ canvasElement }) => {
    const item = within(canvasElement).getByRole("listitem");
    await expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
    await expect(item).toHaveTextContent("1288");
  },
};
