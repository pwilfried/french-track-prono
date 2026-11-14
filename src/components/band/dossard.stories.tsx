import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Dossard } from "./dossard";

const meta = {
  title: "Band/Dossard",
  component: Dossard,
  args: { animal: "guepard", number: "01", name: "Foudre", level: "gold" },
  decorators: [
    (Story) => (
      <div className="w-32 bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Dossard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gold: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Or")).toBeInTheDocument();
    await expect(canvas.getByText("Foudre")).toBeInTheDocument();
  },
};

export const Silver: Story = {
  args: { animal: "ours", name: "Force tranquille", level: "silver" },
};

export const Bronze: Story = { args: { animal: "lievre", name: "Chasseur", level: "bronze" } };

/** Still to win: grey, the « ? » medallion instead of the animal. */
export const Locked: Story = {
  args: { level: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("À débloquer")).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-animal="locked"]')).not.toBeNull();
  },
};

/** A long name wraps inside the bib at the width of a grid of three on 320 px. */
export const LongName: Story = {
  args: {
    animal: "renard",
    number: "07",
    name: "Touche-à-tout des épreuves combinées",
    level: "bronze",
  },
  decorators: [
    (Story) => (
      <div className="w-24">
        <Story />
      </div>
    ),
  ],
};

/** On the night background of the dark theme. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark bg-[#052B5C] p-4">
        <Story />
      </div>
    ),
  ],
};
