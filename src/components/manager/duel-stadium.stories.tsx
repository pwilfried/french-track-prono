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

const places = ["sprint", "sprint", "middle", "long", "jumps", "throws", "free", "free"] as const;

const opponent = [
  card("Ana Fictive", "100 m", "sprint", 1050),
  card("Bea Démo", "200 m", "sprint", 990, 20),
  card("Cléo Exemple", "800 m", "middle", 1010),
  card("Dora Modèle", "5000 m", "long", 0),
  card("Eva Fictive", "Longueur", "horizontal_jumps", 1005),
  card("Flo Démo", "Poids", "throws", 940),
  card("Gaby Exemple", "400 m haies", "hurdles", 1080, 50),
  null,
];
const mine = [
  card("Lou Fictive", "100 m", "sprint", 1100, 20),
  card("Mia Démo", "100 m haies", "hurdles", 1020),
  card("Noa Exemple", "1500 m", "middle", 960),
  card("Oda Modèle", "10 000 m", "long", 1001),
  card("Pia Fictive", "Perche", "vertical_jumps", 0),
  card("Rose Démo", "Disque", "throws", 1040),
  card("Sue Exemple", "Heptathlon", "combined", 990, 20),
  card("Tia Modèle", "800 m", "middle", 970),
];

const meta = {
  title: "Manager/DuelStadium",
  component: DuelStadium,
  args: {
    places: [...places],
    top: { pseudo: "Rival Fictif", linedUp: true, score: 6075, cards: opponent },
    bottom: { pseudo: "Moi", linedUp: true, score: 7111, cards: mine },
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
 * The opponent's stadium at the top on blue cards, turned round to face the player's on gold ones,
 * each side's score next to its stadium.
 */
export const Scored: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("6075")).toBeVisible();
    await expect(canvas.getByText("7111")).toBeVisible();
    const top = canvas.getByRole("list", { name: text.sideOf("Rival Fictif") });
    const bottom = canvas.getByRole("list", { name: text.sideOf("Moi") });
    await expect(within(top).getAllByRole("article")).toHaveLength(7);
    await expect(within(bottom).getAllByRole("article")).toHaveLength(8);
    await expect(within(top).getByText(messages.lineup.emptyPlace("Libre"))).toBeInTheDocument();
    await expect(
      within(bottom).getByRole("article", {
        name: messages.team.scoredCardLabel("Lou Fictive", "100 m", 1100, 20),
      }),
    ).toHaveTextContent("+20");
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
    for (const a of articles) await expect(a).toHaveTextContent("–");
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
      <div className="dark w-[390px] bg-nuit p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("article")).toHaveLength(15);
  },
};
