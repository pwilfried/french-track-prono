import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { MyPlaceCard } from "./my-place-card";

// Invented players.
const meta = {
  title: "Leaderboard/MyPlaceCard",
  component: MyPlaceCard,
  args: {
    place: {
      rank: 4,
      points: 112,
      change: 3,
      ahead: { pseudo: "Démo Gazelle", rank: 3, gap: 18 },
      topPercent: 18,
    },
    showTop: true,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MyPlaceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Rank, points, move since the last competition, gap with the player ahead, top percent. */
export const General: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("4e");
    await expect(card).toHaveTextContent("112 pts");
    await expect(card).toHaveTextContent("gagne 3 places");
    await expect(card).toHaveTextContent("depuis la dernière compétition");
    await expect(card).toHaveTextContent("18 pts derrière Démo Gazelle (3e)");
    await expect(card).toHaveTextContent("Top 18 %");
  },
};

/** In a league: no top percent; a lost place. */
export const League: Story = {
  args: { showTop: false, place: { ...meta.args.place, change: -1 } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("perd 1 place");
    await expect(card).not.toHaveTextContent("Top");
  },
};

/** Empty: first, nobody ahead, and no previous ranking (no arrow). */
export const First: Story = {
  args: { place: { rank: 1, points: 40, change: null, ahead: null, topPercent: 1 } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("Personne devant toi");
    await expect(card).not.toHaveTextContent("depuis la dernière compétition");
  },
};

/** Behind on the tie-breakers only. */
export const Tie: Story = {
  args: { place: { ...meta.args.place, ahead: { pseudo: "Démo Gazelle", rank: 3, gap: 0 } } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("À égalité de points avec Démo Gazelle (3e)"),
    ).toBeVisible();
  },
};

export const Loading: Story = {
  args: { status: "loading" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("status", { name: "Chargement de ta place…" }),
    ).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: { status: "error" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "Ta place n'est pas disponible",
    );
  },
};

/** A long pseudo ahead wraps inside the card. */
export const LongText: Story = {
  args: {
    place: {
      ...meta.args.place,
      rank: 1234,
      points: 1088,
      ahead: { pseudo: "Démo Sprinteuse Infatigable Des Hauts De Fictiville", rank: 1233, gap: 1 },
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("1 pt derrière Démo Sprinteuse");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
