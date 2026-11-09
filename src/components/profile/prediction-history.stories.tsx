import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { MyPredictionLine } from "@/application/list-my-predictions";

import { LatestPredictions } from "./prediction-history";

// Invented athletes.
const line = (
  eventSlug: string,
  discipline: string,
  points: number | null,
  picks: MyPredictionLine["picks"],
  joker = false,
): MyPredictionLine => ({
  competitionSlug: "demo",
  eventSlug,
  discipline,
  gender: "F",
  startsAt: "2026-09-12T18:00:00Z",
  picks,
  joker,
  points,
});
const lines = [
  line("400m", "400 m", null, [
    { name: "Démo Gazelle", hit: "pending" },
    { name: "Démo Foulée", hit: "pending" },
    { name: null, hit: "pending" },
  ]),
  line(
    "100m",
    "100 m",
    24,
    [
      { name: "Démo Sprint", hit: "exact" },
      { name: "Démo Éclair", hit: "exact" },
      { name: "Démo Fusée", hit: "exact" },
    ],
    true,
  ),
  line("hauteur", "Saut en hauteur", 1, [
    { name: "Démo Perche", hit: "missed" },
    { name: "Démo Envol", hit: "misplaced" },
    { name: "Démo Athlète Au Nom Particulièrement Long Pour Voir", hit: "missed" },
  ]),
];

const meta = {
  title: "Profile/LatestPredictions",
  component: LatestPredictions,
  args: { lines },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LatestPredictions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A coming event, a perfect podium with the joker, a near miss. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("En attente")).toBeInTheDocument();
    await expect(canvas.getByText("+24 pts")).toBeInTheDocument();
    await expect(canvas.getAllByText("bonne place")).toHaveLength(3);
    await expect(canvas.getByText("Autre athlète")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /Tous mes pronos/ })).toHaveAttribute(
      "href",
      "/profil/pronos",
    );
  },
};

/** No prediction yet. */
export const Empty: Story = {
  args: { lines: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Pas encore de prono/)).toBeInTheDocument();
  },
};
