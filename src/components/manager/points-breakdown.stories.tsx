import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import type { MyManagerScore } from "@/application/manager-scores";

import { PointsBreakdown } from "./points-breakdown";

/** The messages keep a unit with its number (no-break spaces); the DOM text reads plain spaces. */
const plain = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

const text = messages.managerPoints;

type Score = NonNullable<MyManagerScore["score"]>;
type Line = Score["athletes"][number];

const line = (name: string, total: number, over: Partial<Line> = {}): Line => ({
  athleteId: name,
  name,
  discipline: "100 m",
  mark: "11.02",
  status: "ok",
  tablePoints: total * 10 + 3,
  points: total,
  bonuses: [],
  bonusPoints: 0,
  total,
  ...over,
});

const winner = line("Sue Exemple", 126, {
  mark: "10.90",
  tablePoints: 1111,
  points: 111,
  bonuses: [
    { bonus: "first", points: 10 },
    { bonus: "personal_best", points: 5 },
  ],
  bonusPoints: 15,
});

const mine = (
  athletes: Line[],
  bench: MyManagerScore["bench"] = { replaced: [], unused: [] },
  carriedFrom: string | null = null,
) => {
  const hungarian = athletes.reduce((sum, a) => sum + a.points, 0);
  const bonus = athletes.reduce((sum, a) => sum + a.bonusPoints, 0);
  return {
    divisor: 10,
    carriedFrom,
    bench,
    score: { linedUp: true, total: hungarian + bonus, hungarian, bonus, athletes },
  };
};

const meta = {
  title: "Manager/PointsBreakdown",
  component: PointsBreakdown,
  args: {
    mine: mine([winner, line("Tia Modèle", 102, { mark: "22.90", discipline: "200 m" })], {
      replaced: [],
      unused: [{ athleteId: "u", name: "Ula Réserve" }],
    }),
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PointsBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The three figures, the calculation of each athlete and their golden bonuses. */
export const Scored: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summary = canvas.getByRole("region", { name: text.summary });
    await expect(
      within(summary)
        .getAllByRole("definition")
        .map((d) => d.textContent),
    ).toEqual(["213", "15", "228"]);
    await expect(summary).toHaveTextContent(plain(text.explain(10)));
    const sue = canvas.getByRole("listitem", { name: "Sue Exemple" });
    await expect(sue).toHaveTextContent(plain(text.calculation(1111, 10, 111)));
    await expect(sue).toHaveTextContent(plain(text.bonusTag("first", 10)));
    const bench = canvas.getByRole("list", { name: text.bench });
    await expect(within(bench).getByRole("listitem", { name: "Ula Réserve" })).toHaveTextContent(
      text.unused,
    );
  },
};

/** The starter ran slower than her threshold: her substitute counted (#1036). */
export const Tactical: Story = {
  args: {
    mine: mine(
      [
        winner,
        line("Zia Remplaçante", 99, {
          mark: "10.70",
          starterName: "Tia Modèle",
          substitution: { starterId: "tia", reason: "tactical" },
        }),
      ],
      {
        replaced: [
          {
            athleteId: "tia",
            name: "Tia Modèle",
            reason: "tactical",
            mark: "10.58",
            status: "ok",
            substituteName: "Zia Remplaçante",
          },
        ],
        unused: [],
      },
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("listitem", { name: "Zia Remplaçante" })).toHaveTextContent(
      plain(text.cameIn("Tia Modèle", "tactical")),
    );
    await expect(canvas.getByRole("listitem", { name: "Tia Modèle" })).toHaveTextContent(
      plain(text.replaced("tactical", "ok", "10.58", "Zia Remplaçante")),
    );
  },
};

/** The starter did not finish: her substitute came in. */
export const ForfeitReplaced: Story = {
  args: {
    mine: mine(
      [
        winner,
        line("Zia Remplaçante", 98, {
          starterName: "Tia Modèle",
          substitution: { starterId: "tia", reason: "forfeit" },
        }),
      ],
      {
        replaced: [
          {
            athleteId: "tia",
            name: "Tia Modèle",
            reason: "forfeit",
            mark: null,
            status: "dnf",
            substituteName: "Zia Remplaçante",
          },
        ],
        unused: [],
      },
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("listitem", { name: "Tia Modèle" }),
    ).toHaveTextContent(plain(text.replaced("forfeit", "dnf", null, "Zia Remplaçante")));
  },
};

/** The starter did not finish and nobody could replace her: 0 for her place. */
export const ForfeitWithoutSubstitute: Story = {
  args: {
    mine: mine([
      winner,
      line("Tia Modèle", 0, { mark: null, status: "dnf", tablePoints: 0, points: 0 }),
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("listitem", { name: "Tia Modèle" })).toHaveTextContent(
      plain(text.athletePoints(0)),
    );
    await expect(canvas.getByText(text.benchEmpty)).toBeVisible();
  },
};

/** The player forgot to line up: the last lineup was carried over (#1034). */
export const CarriedOver: Story = {
  args: { mine: { ...mine([winner]), carriedFrom: "Meeting Fictif de Printemps" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(plain(text.carriedFrom("Meeting Fictif de Printemps"))),
    ).toBeVisible();
  },
};

/** No lineup at the lock and none to carry over: 0. */
export const WithoutLineup: Story = {
  args: {
    mine: {
      ...mine([]),
      score: { linedUp: false, total: 0, hungarian: 0, bonus: 0, athletes: [] },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.noLineup)).toBeVisible();
  },
};

/** Long names still fit 390 px. */
export const LongText: Story = {
  args: {
    mine: mine([
      line("Marie-Charlotte Zia de la Grande Piste Remplaçante", 98, {
        starterName: "Anne-Sophie Tia de la Longue Ligne Droite",
        substitution: { starterId: "tia", reason: "bench" },
      }),
    ]),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(1);
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
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(3);
  },
};
