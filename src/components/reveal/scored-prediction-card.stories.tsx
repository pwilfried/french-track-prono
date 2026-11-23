import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { NoPredictionCard, ScoredPredictionCard } from "./scored-prediction-card";

const text = messages.breakdown;
// Invented players and athletes.
const picks = [
  { slot: 1 as const, name: "Démo Fusée", outcome: "exact" as const },
  { slot: 2 as const, name: "Démo Comète", outcome: "on_podium" as const },
  { slot: 3 as const, name: "Démo Éclair", outcome: "on_podium" as const },
];
const detail = {
  lines: [
    { label: text.exact[1], points: 3 },
    { label: text.misplaced(2), points: 2 },
  ],
  subtotal: 5,
  joker: { label: text.joker("🔥", "Double"), points: 5 },
  total: 10,
};

const meta = {
  title: "Reveal/ScoredPredictionCard",
  component: ScoredPredictionCard,
  args: {
    rank: 1,
    pseudo: "Sprinteur Fou",
    bib: { number: 7, color: "blue" },
    mine: false,
    joker: text.jokerChip("🔥", "Double"),
    picks,
    detail,
    group: "story",
  },
  decorators: [
    (Story) => (
      <ul className="flex max-w-[390px] flex-col gap-2.5 bg-background p-4">
        <Story />
        <NoPredictionCard pseudo="Grillon Muet" bib={{ number: 12, color: "red" }} mine={false} />
      </ul>
    ),
  ],
} satisfies Meta<typeof ScoredPredictionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Folded: rank, podium marked, total; a tap unfolds the detail with the joker. */
export const Folded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.subtotal)).not.toBeVisible();
    await userEvent.click(canvas.getByLabelText(text.label("Sprinteur Fou")));
    await expect(canvas.getByText(text.subtotal)).toBeVisible();
    await expect(canvas.getByText(text.joker("🔥", "Double"))).toBeVisible();
    await expect(canvas.getByText(messages.leagueResult.noPrediction)).toBeVisible();
  },
};

/** Mine: highlighted and open first. */
export const Mine: Story = {
  args: { mine: true, rank: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.total)).toBeVisible();
  },
};

/** Not scored yet: no detail, the points to come. */
export const Pending: Story = {
  args: { rank: null, detail: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.pending)).toBeVisible();
  },
};

/** A long pseudo and long names stay inside 320 px. */
export const LongText: Story = {
  args: {
    pseudo: "Le plus long pseudo jamais vu sur une piste",
    picks: picks.map((p) => ({ ...p, name: `${p.name} de la Grande Vallée du Rhône` })),
    detail: { ...detail, joker: null, total: 5 },
  },
};
