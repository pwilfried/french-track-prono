import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { CatalogueCard } from "./catalogue-card";

const text = messages.catalogue;

const meta = {
  title: "Manager/CatalogueCard",
  component: CatalogueCard,
  args: {
    athlete: {
      athleteId: "1",
      slug: "athlete-fictive",
      name: "Léa Fictive",
      countryCode: "FRA",
      sex: "F",
      discipline: "100 m",
      family: "sprint",
      pb: "11.02",
      sb: "11.18",
      price: 12,
      available: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CatalogueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", { name: "Léa Fictive" });
    await expect(within(card).getByLabelText(text.priceLabel(12))).toHaveTextContent("12 cr.");
    await expect(card).toHaveTextContent("11.02");
    await expect(card).toHaveTextContent(text.available);
  },
};

/** Already in a team of the league (after the awards of #423). */
export const Taken: Story = {
  args: { athlete: { ...meta.args.athlete, available: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("article")).toHaveTextContent(text.taken);
  },
};

/** While the mercato is open, the page puts the player's bid at the bottom of the card (#422). */
export const WithMyBid: Story = {
  args: {
    children: (
      <p className="border-t border-border pt-3 text-sm font-bold text-primary">{text.myBid(25)}</p>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("article")).toHaveTextContent(text.myBid(25));
  },
};

/** No PB nor SB known yet, and a long name. */
export const LongNameNoRecords: Story = {
  args: {
    athlete: {
      ...meta.args.athlete,
      name: "Marie-Charlotte de La Tour-Fictive-Longuenom",
      discipline: "3000 m steeple",
      pb: null,
      sb: null,
      price: 125,
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article");
    await expect(card).toHaveTextContent("—");
    await expect(card).toHaveTextContent("125 cr.");
  },
};
