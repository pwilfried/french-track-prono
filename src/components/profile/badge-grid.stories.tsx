import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { BADGES, type BadgeProgress } from "@/domain/badges";

import { BadgeGrid } from "./badge-grid";

const targets = { nostradamus: 1, chasseur: 3, flair: 1, serie: 5, bleus: 1, fidele: 4 };
const progress = (current: Partial<Record<(typeof BADGES)[number], number>>): BadgeProgress[] =>
  BADGES.map((badge) => ({ badge, current: current[badge] ?? 0, target: targets[badge] }));

const meta = {
  title: "Profile/BadgeGrid",
  component: BadgeGrid,
  args: { progress: progress({ nostradamus: 1, chasseur: 2, serie: 3, fidele: 1 }) },
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

/** One badge earned, the others greyed; Chasseur is one winner away. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");
    await expect(items).toHaveLength(6);
    await expect(items[0]).toHaveAttribute("data-earned", "true");
    await expect(items[1]).toHaveAttribute("data-earned", "false");
    await expect(items[1]).toHaveTextContent("3 vainqueurs trouvés");
    await expect(canvas.getByText("Prochain : Chasseur (encore 1)")).toBeInTheDocument();
  },
};

/** A new player: everything locked, the first badge in display order comes next. */
export const Empty: Story = {
  args: { progress: progress({}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("À débloquer")).toHaveLength(6);
    await expect(canvas.getByText("Prochain : Nostradamus (encore 1)")).toBeInTheDocument();
  },
};

/** Every badge earned. */
export const AllEarned: Story = {
  args: { progress: progress(targets) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Tous les badges sont à toi !"),
    ).toBeInTheDocument();
  },
};
