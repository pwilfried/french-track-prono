import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import type { DuelCard } from "@/application/manager-duel";

import { DuelPlaces } from "./duel-places";

/** The messages keep a unit with its number (no-break spaces); the DOM text reads plain spaces. */
const plain = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

const text = messages.managerDuel;

const card = (name: string, points: number, over: Partial<DuelCard> = {}): DuelCard => ({
  athleteId: name,
  name,
  discipline: "100 m",
  family: "sprint",
  sex: "F",
  points,
  bonus: 0,
  mark: "11.02",
  status: "ok",
  bonuses: [],
  replaced: null,
  ...over,
});

const places = ["sprint", "sprint"] as const;

const theirs = {
  pseudo: "Rival Fictif",
  linedUp: true,
  score: 210,
  cards: [card("Dora Modèle", 105), card("Flo Démo", 105, { discipline: "200 m" })],
};

/** Sue won the 100 m with a personal best; Tia ran her 200 m. */
const mine = (second: DuelCard) => ({
  pseudo: "Moi",
  linedUp: true,
  score: 220,
  cards: [
    card("Sue Exemple", 118, {
      mark: "10.90",
      bonus: 15,
      bonuses: [
        { bonus: "first", points: 10 },
        { bonus: "personal_best", points: 5 },
      ],
    }),
    second,
  ],
});

const meta = {
  title: "Manager/DuelPlaces",
  component: DuelPlaces,
  args: {
    places: [...places],
    theirs,
    mine: mine(card("Tia Modèle", 102, { discipline: "200 m", mark: "22.90" })),
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DuelPlaces>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every starter ran: their marks, bonuses and points against the opponent's, ▲ to the winner. */
export const Scored: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = within(canvas.getByRole("list", { name: text.places })).getAllByRole("listitem");
    await expect(items).toHaveLength(2);
    await expect(items[0]).toHaveTextContent(plain(text.bonusTag("first", 10)));
    await expect(
      within(items[0]!).getByLabelText(plain(text.placeMine("Sue Exemple", 118))),
    ).toHaveTextContent(`118 ${text.won}`);
    await expect(
      within(items[1]!).getByLabelText(plain(text.placeTheirs("Rival Fictif", 105))),
    ).toHaveTextContent(`105 ${text.won}`);
  },
};

/** The starter ran slower than her threshold: her substitute counted, even if slower. */
export const Tactical: Story = {
  args: {
    mine: mine(
      card("Zia Remplaçante", 111, {
        mark: "10.70",
        replaced: {
          reason: "tactical",
          starterName: "Tia Modèle",
          starterMark: "10.58",
          starterStatus: "ok",
          threshold: { mark: "10.50", unit: "time" },
          gain: 9,
        },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        plain(
          text.tacticalNote(
            "Tia Modèle",
            "10.58",
            { mark: "10.50", unit: "time" },
            "Zia Remplaçante",
            9,
          ),
        ),
      ),
    ).toBeVisible();
  },
};

/** The starter did not finish: her designated substitute came in. */
export const Forfeit: Story = {
  args: {
    mine: mine(
      card("Zia Remplaçante", 98, {
        replaced: {
          reason: "forfeit",
          starterName: "Tia Modèle",
          starterMark: null,
          starterStatus: "dnf",
          threshold: null,
          gain: 98,
        },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        plain(text.forfeitNote("Tia Modèle", "dnf", "Zia Remplaçante", true)),
      ),
    ).toBeVisible();
  },
};

/** The starter did not finish and nobody of her family was on the bench: 0 for the place. */
export const ForfeitWithoutSubstitute: Story = {
  args: { mine: mine(card("Tia Modèle", 0, { mark: null, status: "dnf" })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(plain(text.nobodyNote("Tia Modèle", "dnf")))).toBeVisible();
    await expect(canvas.getByText(plain(text.mark(null, "dnf")))).toBeVisible();
  },
};

/** The opponent did not line up: they score 0 on every place. */
export const OpponentWithoutLineup: Story = {
  args: { theirs: { ...theirs, linedUp: false, score: 0, cards: [null, null] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText(`0`)).toHaveLength(2);
  },
};

/** Long names and an empty place still fit 390 px. */
export const LongText: Story = {
  args: {
    places: ["sprint", "sprint", "distance"],
    mine: {
      ...mine(
        card("Marie-Charlotte Zia de la Grande Piste Remplaçante", 98, {
          replaced: {
            reason: "bench",
            starterName: "Anne-Sophie Tia de la Longue Ligne Droite",
            starterMark: null,
            starterStatus: "dns",
            threshold: null,
            gain: null,
          },
        }),
      ),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.emptyPlace)).toBeVisible();
  },
};

/** On the night background of the dark theme. */
export const Dark: Story = {
  args: Tactical.args,
  decorators: [
    (Story) => (
      <div className="dark w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(2);
  },
};
