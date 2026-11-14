import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Statuette } from "./statuette";

const meta = {
  title: "Band/Statuette",
  component: Statuette,
  args: { animal: "guepard", metal: "gold", plaque: ["Les Copains", "Saison 2026", "1er sur 8"] },
  decorators: [
    (Story) => (
      <div className="w-36 bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Statuette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A won league: the Guépard d'or on its engraved base. */
export const Gold: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Guépard d'or")).toBeInTheDocument();
    await expect(canvas.getByText("1er sur 8")).toBeInTheDocument();
  },
};

export const Silver: Story = {
  args: { animal: "ours", metal: "silver", plaque: ["Bureau", "Saison 2026", "2e sur 5"] },
};

/** The Manager trophy: the hare. */
export const Bronze: Story = {
  args: {
    animal: "lievre",
    metal: "bronze",
    plaque: ["Manager du club", "Saison 2026", "3e sur 6"],
  },
};

/** An empty slot of the display case: grey « ? » and what it takes. */
export const Empty: Story = {
  args: { metal: null, plaque: ["Finis sur le podium d'une ligue"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("À gagner cette saison")).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-animal="locked"]')).not.toBeNull();
  },
};

/** A long league name wraps on the plaque. */
export const LongText: Story = {
  args: {
    plaque: [
      "La ligue des grands amateurs de demi-fond du jeudi soir",
      "Saison 2026",
      "1er sur 24",
    ],
  },
};

/** On the night background of the dark theme. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark w-36 bg-[#052B5C] p-4">
        <Story />
      </div>
    ),
  ],
};
