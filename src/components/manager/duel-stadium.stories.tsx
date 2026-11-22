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
): DuelCard => ({
  athleteId: name,
  name,
  discipline,
  family,
  sex: "F",
  points,
  bonus,
  mark: points === null ? null : "10.90",
  status: points === null ? null : "ok",
  bonuses: bonus > 0 ? [{ bonus: "personal_best", points: bonus }] : [],
  replaced: null,
});

/** The default rules: two places per family (#1017). */
const places = [
  "sprint",
  "sprint",
  "distance",
  "distance",
  "jumps",
  "jumps",
  "throws",
  "throws",
] as const;

const opponent = [
  card("Dora Modèle", "100 m", "sprint", 7),
  card("Flo Démo", "400 m", "sprint", null),
  card("Gaby Exemple", "1500 m", "middle", null),
  null,
  card("Ana Fictive", "Hauteur", "vertical_jumps", 6),
  card("Eva Fictive", "Longueur", "horizontal_jumps", 9),
  card("Bea Démo", "Javelot", "throws", 8),
  card("Cléo Exemple", "Poids", "throws", 8, 2),
];
const mine = [
  card("Sue Exemple", "100 m", "sprint", 13, 3),
  card("Quia Fictive", "400 m", "sprint", null),
  card("Mia Démo", "1500 m", "middle", null),
  card("Tia Modèle", "5000 m", "long", 0),
  card("Hana Démo", "Hauteur", "vertical_jumps", 10),
  card("Lou Fictive", "Longueur", "horizontal_jumps", 11),
  card("Mona Modèle", "Javelot", "throws", 5),
  card("Pia Fictive", "Poids", "throws", 7),
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
    await expect(
      within(top).getByText(messages.lineup.emptyPlace("Demi-fond et fond")),
    ).toBeInTheDocument();
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
    await expect(canvas.getByText(text.legend(10))).toBeVisible();
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

/** A substitute counted for a place (#1036): « ⏱ » on their card, named in its label. */
export const Substitute: Story = {
  args: {
    bottom: {
      pseudo: "Moi",
      linedUp: true,
      score: 41,
      cards: mine.map((c, i) =>
        i === 0 && c
          ? {
              ...c,
              name: "Zia Remplaçante",
              replaced: {
                reason: "tactical",
                starterName: "Sue Exemple",
                starterMark: "10.58",
                starterStatus: "ok",
                threshold: { mark: "10.50", unit: "time" },
                gain: 9,
              },
            }
          : c,
      ),
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", { name: /Zia Remplaçante/ });
    await expect(card).toHaveTextContent(text.replacedMark.tactical);
    await expect(card).toHaveAccessibleName(new RegExp(text.replacedLabel("Sue Exemple")));
  },
};
