import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { RoundSummary, type RoundSummaryAthlete } from "./round-summary";

const text = messages.roundReveal;

const offer = (
  userId: string,
  pseudo: string,
  amount: number,
  won = false,
  mine = false,
): RoundSummaryAthlete["offers"][number] => ({
  userId,
  pseudo,
  bib: { number: Number(userId.slice(1)) * 7, color: mine ? "gold" : "blue" },
  amount,
  won,
  mine,
});

const athletes: RoundSummaryAthlete[] = [
  {
    athleteId: "a1",
    name: "Léa Fictive",
    discipline: "100 m haies",
    offers: [
      offer("u2", "Comète", 40, true),
      offer("u1", "Flèche", 30, false, true),
      offer("u3", "Rafale", 12),
    ],
  },
  {
    athleteId: "a2",
    name: "Hugo Démo",
    discipline: "Disque",
    offers: [offer("u1", "Flèche", 15, true, true)],
  },
];

const meta = {
  title: "Manager/RoundSummary",
  component: RoundSummary,
  args: { round: 2, athletes },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoundSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One card per athlete, its bids from the highest; the winning one in gold. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.allTitle(2) })).toBeVisible();
    const lea = canvas.getByRole("article", { name: "Léa Fictive" });
    await expect(lea).toHaveTextContent(text.offers(3));
    const bids = within(lea).getAllByRole("listitem");
    await expect(bids.map((b) => b.textContent)).toEqual([
      expect.stringContaining("Comète"),
      expect.stringContaining("Flèche"),
      expect.stringContaining("Rafale"),
    ]);
    await expect(bids[0]).toHaveTextContent(text.won);
    await expect(canvas.getByRole("article", { name: "Hugo Démo" })).toHaveTextContent(
      text.offers(1),
    );
  },
};

/** A player who won no athlete this round: none of their bids is gold. */
export const PlayerWithoutAthlete: Story = {
  args: {
    athletes: [
      {
        athleteId: "a1",
        name: "Léa Fictive",
        discipline: "100 m haies",
        offers: [offer("u2", "Comète", 40, true), offer("u1", "Flèche", 30, false, true)],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const lea = within(canvasElement).getByRole("article", { name: "Léa Fictive" });
    const bids = within(lea).getAllByRole("listitem");
    await expect(bids[1]).toHaveTextContent("Flèche");
    await expect(bids[1]).not.toHaveTextContent(text.won);
  },
};

/** A long athlete name and a long pseudo wrap without overflowing. */
export const LongText: Story = {
  args: {
    athletes: [
      {
        athleteId: "a1",
        name: "Marie-Charlotte Démonstration-Fictive de la Grande Piste",
        discipline: "3000 m steeple",
        offers: [
          offer("u2", "Supercalifragilistique-du-sprint-et-des-haies", 121, true),
          offer("u1", "Flèche", 120, false, true),
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("article", {
        name: "Marie-Charlotte Démonstration-Fictive de la Grande Piste",
      }),
    ).toHaveTextContent("Supercalifragilistique-du-sprint-et-des-haies");
  },
};

/** Nobody bid in the round. */
export const Empty: Story = {
  args: { athletes: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.empty)).toBeVisible();
  },
};

/** On the night background of the dark theme. */
export const OnDarkBackground: Story = {
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-nuit p-4 text-white">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("article")).toHaveLength(2);
  },
};
