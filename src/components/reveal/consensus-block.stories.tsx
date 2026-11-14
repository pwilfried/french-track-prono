import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { consensus, type ConsensusPodium } from "@/domain/consensus";

import { ConsensusBlock } from "./consensus-block";

// Invented athletes.
const names: Record<string, string> = {
  a: "Démo Fusée",
  b: "Démo Éclair",
  c: "Démo Comète",
  d: "Démo Tornade",
  e: "Démo Mistral",
  f: "Démo Zéphyr",
};
const nameOf = (id: string) => names[id] ?? "?";
const podium = (first: string, second: string, third: string, mine = false): ConsensusPodium => ({
  podium: { first, second, third },
  mine,
});

const few = [podium("a", "b", "c", true), podium("a", "c", "b"), podium("b", "a", "d")];

// 60 predictions: a favourite, a few outsiders, and my bold pick of Démo Tornade in 2nd.
const patterns: [string, string, string, number][] = [
  ["a", "b", "c", 20],
  ["b", "a", "c", 12],
  ["c", "a", "b", 9],
  ["a", "c", "d", 7],
  ["d", "e", "f", 5],
  ["e", "f", "a", 4],
  ["f", "b", "e", 2],
];
const many = [
  podium("a", "d", "f", true),
  ...patterns.flatMap(([first, second, third, n]) =>
    Array.from({ length: n }, () => podium(first, second, third)),
  ),
];

const meta = {
  title: "Reveal/ConsensusBlock",
  component: ConsensusBlock,
  args: { consensus: consensus(few), nameOf, retryHref: "/epreuves/demo" },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background py-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsensusBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three players: each place with its athletes, my choice highlighted, the two figures. */
export const FewPlayers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole("list", { name: "Pronos pour la place de 1er" });
    const mine = within(first)
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("aria-current") === "true");
    await expect(mine).toHaveTextContent("Démo Fusée : 67 % (ton choix)");
    // Nobody else has my podium; my 2nd place is the least shared of my choices.
    await expect(canvas.getByText("Unique")).toBeInTheDocument();
    await expect(
      canvas.getByText("ton choix le plus original : Démo Éclair en 2e"),
    ).toBeInTheDocument();
  },
};

/** Many players: three athletes per place, then « Autres »; my choice stays shown. */
export const ManyPlayers: Story = {
  args: { consensus: consensus(many) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const place of ["1er", "2e", "3e"]) {
      const list = canvas.getByRole("list", { name: `Pronos pour la place de ${place}` });
      const items = within(list).getAllByRole("listitem");
      await expect(items.length).toBeLessThanOrEqual(5);
      await expect(items.filter((li) => li.getAttribute("aria-current") === "true")).toHaveLength(
        1,
      );
    }
    await expect(canvas.getAllByText("Autres").length).toBeGreaterThan(0);
    await expect(
      canvas.getByText("ton choix le plus original : Démo Tornade en 2e"),
    ).toBeInTheDocument();
  },
};

/** After the result: a ✓ on who finished at each place, and the share of perfect podiums. */
export const AfterResult: Story = {
  args: {
    consensus: consensus(few, [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
      { athleteId: "c", rank: 3 },
    ]),
    official: [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
      { athleteId: "c", rank: 3 },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("🎯 33 % ont trouvé le podium parfait")).toBeInTheDocument();
    await expect(canvas.getAllByTitle("arrivé à cette place")).toHaveLength(3);
  },
};

/** A very long name is cut, the figures and the bars stay inside 390 px. */
export const LongText: Story = {
  args: {
    nameOf: (id: string) =>
      id === "a" ? "Démo Athlète Au Nom Composé Interminable-Et-Encore-Plus-Long" : nameOf(id),
  },
  play: async ({ canvasElement }) => {
    for (const item of within(canvasElement).getAllByRole("listitem")) {
      await expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
    }
  },
};

/** Nobody predicted (in the league chosen). */
export const Empty: Story = {
  args: { consensus: consensus([]) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Personne n'a encore pronostiqué cette épreuve."),
    ).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { status: "loading", consensus: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveAccessibleName(
      "Chargement des pronos…",
    );
  },
};

export const Error: Story = {
  args: { status: "error" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "Impossible d'afficher",
    );
  },
};
