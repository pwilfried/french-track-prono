import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { BADGES, progressOf, type Badge } from "@/domain/badges";

import { BadgeGrid } from "./badge-grid";

const progress = (counts: Partial<Record<Badge, number>>) =>
  BADGES.map((badge) => progressOf(badge, counts[badge] ?? 0));

const meta = {
  title: "Profile/BadgeGrid",
  component: BadgeGrid,
  args: { progress: progress({ nostradamus: 3, chasseur: 2, serie: 12, fidele: 1, foudre: 64 }) },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BadgeGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Badges at each level, the others greyed; Chasseur is one winner away from bronze. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");
    await expect(items).toHaveLength(13);
    await expect(items[0]).toHaveAttribute("data-level", "silver");
    await expect(items[0]).toHaveTextContent("Niveau Argent");
    await expect(items[0]).toHaveTextContent("3 / 10 pour l'or");
    await expect(items[1]).toHaveAttribute("data-earned", "false");
    await expect(items[1]).toHaveTextContent("2 / 3 pour le bronze");
    await expect(items[6]).toHaveAttribute("data-level", "bronze");
    await expect(canvas.getByRole("heading", { name: "Badges de famille" })).toBeInTheDocument();
    await expect(canvas.getByText("Prochain : Chasseur, le bronze (encore 1)")).toBeInTheDocument();
  },
};

/** A new player: everything locked, the first badge in display order comes next. */
export const Empty: Story = {
  args: { progress: progress({}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("À débloquer")).toHaveLength(13);
    await expect(
      canvas.getByText("Prochain : Nostradamus, le bronze (encore 1)"),
    ).toBeInTheDocument();
  },
};

/** A family badge closest to its next level: what is left is told in points. */
export const FamilyNext: Story = {
  args: {
    progress: progress({
      nostradamus: 10,
      chasseur: 30,
      flair: 10,
      serie: 20,
      bleus: 15,
      fidele: 15,
      foudre: 140,
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Prochain : Foudre, l'argent (encore 10 pts)"),
    ).toBeInTheDocument();
  },
};

/** Every badge in gold: the long labels of the family badges still fit at 390 px. */
export const AllGold: Story = {
  args: { progress: progress(Object.fromEntries(BADGES.map((b) => [b, 1000]))) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Niveau maximum")).toHaveLength(13);
    await expect(canvas.getByText("Tous les badges sont en or !")).toBeInTheDocument();
  },
};
