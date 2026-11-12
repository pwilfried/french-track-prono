import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { RevealCard } from "./reveal-card";

const text = messages.roundReveal;

const meta = {
  title: "Manager/RevealCard",
  component: RevealCard,
  args: {
    card: { name: "Léa Fictive", discipline: "100 m haies", amount: 18, won: true, winner: null },
    revealed: true,
  },
  decorators: [
    (Story) => (
      <div className="hero w-40 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RevealCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Face down: « ? » and the amount of the bid, not the athlete. */
export const Hidden: Story = {
  args: { revealed: false },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", { name: text.hiddenLabel });
    await expect(card).toHaveTextContent("?");
    await expect(card).toHaveTextContent(text.yourBid(18));
    await expect(card).not.toHaveTextContent("Léa Fictive");
  },
};

/** Won: gold, « GAGNÉ », the price paid for the season. */
export const Won: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", {
      name: text.cardLabel("Léa Fictive", true),
    });
    await expect(card).toHaveTextContent(text.won);
    await expect(card).toHaveTextContent("LF");
    await expect(card).toHaveTextContent(text.wonLine(18));
  },
};

/** Lost: grey, « PERDU », who got the athlete and at what price. */
export const Lost: Story = {
  args: {
    card: {
      name: "Léa Fictive",
      discipline: "100 m haies",
      amount: 18,
      won: false,
      winner: { pseudo: "Comète", amount: 25 },
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", {
      name: text.cardLabel("Léa Fictive", false),
    });
    await expect(card).toHaveTextContent(text.lost);
    await expect(card).toHaveTextContent(text.lostLine("Comète", 25));
  },
};

/** A long name and a long pseudo still fit the card. */
export const LongText: Story = {
  args: {
    card: {
      name: "Marie-Charlotte Démonstration-Fictive de la Grande Piste",
      discipline: "3000 m steeple",
      amount: 120,
      won: false,
      winner: { pseudo: "Supercalifragilistique-du-sprint", amount: 121 },
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article");
    await expect(card).toHaveTextContent("MP");
    await expect(card).toHaveTextContent(text.lostLine("Supercalifragilistique-du-sprint", 121));
  },
};

/** Light theme: the cards out of the night-blue screen. */
export const OnLightBackground: Story = {
  decorators: [
    (Story) => (
      <div className="w-40 bg-[#f8f8f8] p-4 text-[#052b5c]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("article")).toHaveTextContent(text.won);
  },
};
