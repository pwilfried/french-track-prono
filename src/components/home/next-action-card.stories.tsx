import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { EventSummary } from "@/domain/event";

import { NextActionCard } from "./next-action-card";

const now = new Date("2026-09-11T16:00:00.000Z");
const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

const final: EventSummary = {
  id: "ev-100m-f",
  slug: "f-100m",
  discipline: "100 m",
  gender: "F",
  startsAt: inMinutes(4 * 60 + 40),
  lockAt: inMinutes(4 * 60 + 30),
  isFeatured: true,
  status: "upcoming",
  round: "final",
};

const meta = {
  title: "Home/NextActionCard",
  component: NextActionCard,
  args: {
    now,
    firstPrediction: false,
    competitionSlug: "ultimate-championship-2026",
    action: { kind: "predict", final, sameDay: 0 },
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NextActionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An open final to predict: its lock, its start in Paris time, one red button. */
export const Predict: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Ta prochaine action" })).toBeVisible();
    await expect(canvas.getByText("À toi de jouer")).toBeVisible();
    await expect(canvas.getByText("Verrouille dans 4 h 30 min")).toBeVisible();
    await expect(canvas.getByText(/Départ vendredi 11 septembre à 22:40/)).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Faire mon podium" })).toHaveAttribute(
      "href",
      "/epreuves/f-100m",
    );
    await expect(canvas.queryByText(/autres? finales? ce soir/)).toBeNull();
  },
};

/** The player's very first prediction, other finals the same evening. */
export const FirstPredictionWithOthers: Story = {
  args: { firstPrediction: true, action: { kind: "predict", final, sameDay: 3 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Ton premier prono")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "3 autres finales ce soir" })).toHaveAttribute(
      "href",
      "/competitions?competition=ultimate-championship-2026",
    );
  },
};

/** Less than an hour before the lock: the chip turns gold. */
export const LocksSoon: Story = {
  args: {
    action: {
      kind: "predict",
      final: { ...final, lockAt: inMinutes(42), startsAt: inMinutes(50) },
      sameDay: 1,
    },
  },
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByText("Verrouille dans 42 min");
    await expect(chip.className).toContain("bg-gold-soft");
  },
};

/** Nothing open to predict: the next competition and its programme. */
export const NextCompetition: Story = {
  args: {
    action: {
      kind: "competition",
      competition: {
        slug: "meeting-fictif-2026",
        name: "Meeting fictif de Fictiville",
        place: "Fictiville · 3–4 oct. 2026",
        finals: 12,
      },
      daysLeft: 9,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Prochaine compétition")).toBeVisible();
    await expect(canvas.getByText("Dans 9 j")).toBeVisible();
    await expect(canvas.getByText("Fictiville · 3–4 oct. 2026 · 12 finales")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Voir le programme" })).toHaveAttribute(
      "href",
      "/competitions/meeting-fictif-2026",
    );
  },
};

/** Long names wrap inside the card at 390 px. */
export const LongText: Story = {
  args: {
    action: {
      kind: "predict",
      final: { ...final, discipline: "3 000 m steeple avec obstacles supplémentaires" },
      sameDay: 12,
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Ta prochaine action" });
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};

/** Long competition name and place. */
export const LongCompetition: Story = {
  args: {
    action: {
      kind: "competition",
      competition: {
        slug: "championnats-fictifs",
        name: "Championnats fictifs interclubs de la grande région de Fictiville-sur-Mer",
        place: "Fictiville-sur-Mer-les-Bains · 28 sept. – 3 oct. 2026",
        finals: 1,
      },
      daysLeft: 1,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Demain")).toBeVisible();
    await expect(canvas.getByText(/· 1 finale$/)).toBeVisible();
  },
};
