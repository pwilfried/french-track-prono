import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { ResultLine } from "@/domain/event";

import { PodiumMedals } from "./podium-medals";

const line = (name: string, rank: number, mark: string, countryCode = "FRA"): ResultLine => ({
  athleteId: name,
  name,
  countryCode,
  rank,
  mark,
});

const meta = {
  title: "Podium/PodiumMedals",
  component: PodiumMedals,
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PodiumMedals>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    results: [
      line("Richardson", 1, "10.78", "USA"),
      line("Alfred", 2, "10.85", "LCA"),
      line("Ta Lou", 3, "10.91", "CIV"),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Richardson")).toBeInTheDocument();
    await expect(canvas.getByText("10.78")).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { results: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/pas encore connu/)).toBeInTheDocument();
  },
};

export const TieForThird: Story = {
  args: {
    results: [
      line("Richardson", 1, "10.78", "USA"),
      line("Alfred", 2, "10.85", "LCA"),
      line("Ta Lou", 3, "10.91", "CIV"),
      line("Asher-Smith", 3, "10.91", "GBR"),
    ],
  },
};

export const LongNames: Story = {
  args: {
    results: [
      line("Alexandrina Montgomery-Featherstonehaugh", 1, "10.78", "GBR"),
      line("Bartholomeus van der Westhuizen-Oosthuizen", 2, "10.85", "RSA"),
      line("Cleopatra Konstantinopoulou", 3, "10.91", "GRE"),
    ],
  },
};
