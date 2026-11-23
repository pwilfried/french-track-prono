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
      lead: null,
      topPercent: 18,
    },
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

/** Rank, medal, points, then the move and the gap with the player ahead. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("4e");
    await expect(card).toHaveTextContent("🔥");
    await expect(card).toHaveTextContent("112 pts");
    await expect(card).toHaveTextContent("🚀 +3 places");
    await expect(card).toHaveTextContent("🎯 18 pts du 3e");
  },
};

/** A lost place. */
export const Down: Story = {
  args: { place: { ...meta.args.place, rank: 14, change: -2 } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("📉 -2 places");
    await expect(card).toHaveTextContent("💪");
  },
};

/** The same place as before. */
export const Same: Story = {
  args: { place: { ...meta.args.place, change: 0 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("➡️ Même place")).toBeVisible();
  },
};

/** First: the crown and the lead; no previous ranking, so no move tile. */
export const First: Story = {
  args: {
    place: { rank: 1, points: 47, change: null, ahead: null, lead: 7, topPercent: 1 },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("1er");
    await expect(card).toHaveTextContent("👑");
    await expect(card).toHaveTextContent("😎 7 pts d'avance");
    await expect(card).not.toHaveTextContent("place");
  },
};

/** Tied on points with the player ahead: behind on the tie-breakers only. */
export const Tie: Story = {
  args: { place: { ...meta.args.place, ahead: { pseudo: "Démo Gazelle", rank: 3, gap: 0 } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("🎯 À égalité avec le 3e")).toBeVisible();
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

/** A big rank and a big gap fit the card. */
export const LongText: Story = {
  args: {
    place: {
      ...meta.args.place,
      rank: 1234,
      points: 1088,
      ahead: { pseudo: "Démo Sprinteuse Infatigable", rank: 1233, gap: 1088 },
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta place" });
    await expect(card).toHaveTextContent("1234e");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
