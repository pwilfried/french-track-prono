import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { MercatoBanner } from "./mercato-banner";

const text = messages.catalogue;
const now = new Date("2027-01-01T10:00:00.000Z");

const meta = {
  title: "Manager/MercatoBanner",
  component: MercatoBanner,
  args: {
    now,
    opensAt: "2027-01-03T14:00:00.000Z",
    participants: [
      { userId: "1", pseudo: "Perchiste Fictif", bib: { number: 7, color: "gold" } },
      { userId: "2", pseudo: "Sprinteuse Démo", bib: { number: 21, color: "red" } },
      { userId: "3", pseudo: "Lanceur Inventé", bib: { number: 104, color: "white" } },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MercatoBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The time left before the opening, the bibs, the last one to join, no bid. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const band = within(canvasElement).getByRole("region", { name: text.beforeMercato });
    await expect(within(band).getByRole("timer")).toHaveTextContent("Ouverture dans 2 j 4 h");
    await expect(band).toHaveTextContent(text.participants(3));
    await expect(within(band).getAllByRole("listitem")).toHaveLength(3);
    await expect(band).toHaveTextContent(text.justJoined("Lanceur Inventé"));
    await expect(band).toHaveTextContent(text.prepare);
    await expect(within(band).queryByRole("button")).toBeNull();
  },
};

/** No opening date yet; the creator is alone, so nobody « just joined ». */
export const NoDateAlone: Story = {
  args: {
    opensAt: null,
    participants: [{ userId: "1", pseudo: "Perchiste Fictif", bib: { number: 7, color: "gold" } }],
  },
  play: async ({ canvasElement }) => {
    const band = within(canvasElement).getByRole("region", { name: text.beforeMercato });
    await expect(band).toHaveTextContent(text.opensLater);
    await expect(within(band).queryByRole("timer")).toBeNull();
    await expect(band).toHaveTextContent(text.participants(1));
    await expect(band).not.toHaveTextContent("vient de rejoindre");
  },
};

/** A full league of twelve, the last pseudo long: everything wraps on a phone. */
export const FullLeagueLongPseudo: Story = {
  args: {
    participants: Array.from({ length: 12 }, (_, i) => ({
      userId: String(i),
      pseudo: i === 11 ? "Marie-Charlotte-Fictive-Du-Grand-Stade" : `Joueur Fictif ${i + 1}`,
      bib: { number: 100 + i, color: (["blue", "red", "gold", "green"] as const)[i % 4] },
    })),
  },
  play: async ({ canvasElement }) => {
    const band = within(canvasElement).getByRole("region", { name: text.beforeMercato });
    await expect(band).toHaveTextContent(text.participants(12));
    await expect(band).toHaveTextContent(text.justJoined("Marie-Charlotte-Fictive-Du-Grand-Stade"));
  },
};

/** An hour before the opening, the countdown shows minutes. */
export const OpensSoon: Story = {
  args: { opensAt: "2027-01-01T10:42:00.000Z" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("timer")).toHaveTextContent("42 min");
  },
};
