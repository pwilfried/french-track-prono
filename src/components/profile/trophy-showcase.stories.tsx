import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { Trophy } from "@/domain/trophies";

import { TrophyShowcase } from "./trophy-showcase";

const trophy = (over: Partial<Trophy>): Trophy => ({
  userId: "me",
  season: 2026,
  kind: "league",
  metal: "gold",
  leagueId: "L",
  leagueName: "Les copains du stade",
  animal: "guepard",
  ...over,
});

const meta = {
  title: "Profile/TrophyShowcase",
  component: TrophyShowcase,
  args: {
    shelves: [
      {
        season: 2026,
        trophies: [
          trophy({
            kind: "general",
            metal: "bronze",
            leagueId: null,
            leagueName: null,
            animal: null,
          }),
          trophy({}),
          trophy({
            kind: "manager",
            metal: "silver",
            leagueId: "M",
            leagueName: "Mercato",
            animal: "lievre",
          }),
          trophy({ kind: "chrono", metal: null, animal: null }),
          trophy({ kind: "witness", metal: null, leagueId: null, leagueName: null, animal: null }),
        ],
      },
      { season: 2025, trophies: [trophy({ season: 2025, metal: "bronze", animal: "ours" })] },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrophyShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two seasons, the latest first, each statuette named after its animal and metal. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const shelves = canvas.getAllByRole("group");
    await expect(shelves).toHaveLength(2);
    await expect(shelves[0]).toHaveTextContent("Saison 2026");
    await expect(shelves[0]).toHaveTextContent("5 trophées");
    await expect(canvas.getByText("Guépard d'or")).toBeInTheDocument();
    await expect(canvas.getByText("Laurier de bronze")).toBeInTheDocument();
    await expect(canvas.getByText("Lièvre d'argent")).toBeInTheDocument();
    await expect(canvas.getByText("Témoin d'or")).toBeInTheDocument();
    await expect(canvas.getByText("Ours de bronze")).toBeInTheDocument();
  },
};

/** No trophy yet: the showcase says how to win the first one. */
export const Empty: Story = {
  args: { shelves: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole("group")).toHaveLength(0);
    await expect(canvas.getByText(/Pas encore de trophée/)).toBeInTheDocument();
  },
};

/** A long league name wraps under its statuette, nothing overflows at 390 px. */
export const LongText: Story = {
  args: {
    shelves: [
      {
        season: 2026,
        trophies: [
          trophy({ leagueName: "Les irréductibles du lancer de marteau du dimanche matin" }),
          trophy({
            kind: "record",
            metal: null,
            animal: null,
            leagueName: "Supercalifragilisticexpialidocieux",
          }),
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const shelf = within(canvasElement).getByRole("group");
    await expect(shelf.scrollWidth).toBeLessThanOrEqual(shelf.clientWidth);
  },
};
