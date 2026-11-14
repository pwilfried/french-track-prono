import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import type { DuelCard } from "@/application/manager-duel";

import { DuelStadium } from "./duel-stadium";

const text = messages.managerDuel;

const card = (
  name: string,
  discipline: string,
  family: DuelCard["family"],
  points: number | null,
  bonus = 0,
): DuelCard => ({ athleteId: name, name, discipline, family, sex: "F", points, bonus });

/** The default rules: one sprint, one middle distance, one throws place and five free ones. */
const places = ["sprint", "middle", "throws", "free", "free", "free", "free", "free"] as const;

const opponent = [
  card("Dora Modèle", "100 m", "sprint", 7),
  card("Gaby Exemple", "1500 m", "middle", null),
  card("Bea Démo", "Javelot", "throws", 8),
  card("Flo Démo", "400 m", "sprint", null),
  card("Ana Fictive", "Hauteur", "vertical_jumps", 6),
  card("Eva Fictive", "Longueur", "horizontal_jumps", 9),
  card("Cléo Exemple", "Poids", "throws", 8, 2),
  null,
];
const mine = [
  card("Sue Exemple", "100 m", "sprint", 13, 3),
  card("Mia Démo", "1500 m", "middle", null),
  card("Mona Modèle", "Javelot", "throws", 5),
  card("Quia Fictive", "400 m", "sprint", null),
  card("Hana Démo", "Hauteur", "vertical_jumps", 10),
  card("Lou Fictive", "Longueur", "horizontal_jumps", 11),
  card("Pia Fictive", "Poids", "throws", 7),
  card("Tia Modèle", "200 m", "sprint", 0),
];

const meta = {
  title: "Manager/DuelStadium",
  component: DuelStadium,
  args: {
    places: [...places],
    mine: true,
    top: { pseudo: "Rival Fictif", linedUp: true, score: 37, cards: opponent },
    bottom: { pseudo: "Moi", linedUp: true, score: 41, cards: mine },
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DuelStadium>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The mock-up: the opponent's stadium at the top, « Mon stade » below with its score in red, the
 * score between the two; races on gold, field events on white, « ▲ » on the card that wins its duel.
 */
export const Scored: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: /Stade de Rival Fictif/ })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: /Mon stade/ })).toHaveTextContent("41");
    await expect(canvas.getByText(text.scoreLine("37", "41"))).toBeVisible();
    const top = canvas.getByRole("list", { name: text.sideOf("Rival Fictif") });
    const bottom = canvas.getByRole("list", { name: text.sideOf("Moi") });
    await expect(within(top).getAllByRole("article")).toHaveLength(7);
    await expect(within(bottom).getAllByRole("article")).toHaveLength(8);
    await expect(within(top).getByText(messages.lineup.emptyPlace("Libre"))).toBeInTheDocument();
    const sprint = within(bottom).getByRole("article", {
      name: messages.team.scoredCardLabel("Sue Exemple", "100 m", 13, 3),
    });
    await expect(sprint).toHaveTextContent(`13 ${text.won}`);
    await expect(
      within(top).getByRole("article", {
        name: messages.team.scoredCardLabel("Dora Modèle", "100 m", 7, 0),
      }),
    ).not.toHaveTextContent(text.won);
    await expect(within(bottom).getAllByText(text.toCome)).toHaveLength(2);
    await expect(canvas.getByText(text.legend)).toBeVisible();
  },
};

/** Locked, not scored yet: the lineups show, the points wait. */
export const NotScored: Story = {
  args: {
    top: {
      pseudo: "Rival Fictif",
      linedUp: true,
      cards: opponent.map((c) => c && { ...c, points: null, bonus: 0 }),
    },
    bottom: {
      pseudo: "Moi",
      linedUp: true,
      cards: mine.map((c) => c && { ...c, points: null, bonus: 0 }),
    },
  },
  play: async ({ canvasElement }) => {
    const articles = within(canvasElement).getAllByRole("article");
    for (const a of articles) {
      await expect(a).toHaveTextContent(text.toCome);
      await expect(a).not.toHaveTextContent(text.won);
    }
  },
};

/** The opponent did not line up: 0 point, no card. */
export const NoLineup: Story = {
  args: { top: { pseudo: "Rival Fictif", linedUp: false, cards: places.map(() => null) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noLineup("Rival Fictif"))).toBeVisible();
    await expect(canvas.queryByRole("list", { name: text.sideOf("Rival Fictif") })).toBeNull();
  },
};

/** Long names and pseudos still fit their places. */
export const LongNames: Story = {
  args: {
    top: {
      pseudo: "Rival au pseudo vraiment très très long de démonstration",
      linedUp: true,
      cards: opponent.map(
        (c) => c && { ...c, name: `Marie-Charlotte ${c.name} de la Grande Piste` },
      ),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("article")).toHaveLength(15);
  },
};

/** On the night background of the dark theme. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("article")).toHaveLength(15);
  },
};
