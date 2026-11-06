import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { ResultLine } from "@/domain/event";

import { PodiumDisplay } from "./podium-display";

const line = (name: string, rank: number, mark: string, countryCode = "FRA"): ResultLine => ({
  athleteId: name,
  name,
  countryCode,
  rank,
  mark,
});

const meta = {
  title: "Podium/PodiumDisplay",
  component: PodiumDisplay,
  decorators: [
    (Story) => (
      <div className="hero max-w-sm px-4 pb-0 pt-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PodiumDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    results: [
      line("Ada Martin", 1, "9.85"),
      line("Bea Durand", 2, "9.90"),
      line("Cleo Petit", 3, "9.93"),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Ada Martin")).toBeInTheDocument();
    await expect(canvas.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  },
};

/** No official result yet: the three steps stay empty and a message explains why. */
export const Empty: Story = {
  args: { results: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/pas encore connu/)).toBeInTheDocument();
  },
};

/** Two athletes tied for third share the third step. */
export const TieForThird: Story = {
  args: {
    results: [
      line("Ada Martin", 1, "2.34"),
      line("Bea Durand", 2, "2.31"),
      line("Cleo Petit", 3, "2.28"),
      line("Dora Leroy", 3, "2.28"),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cleo Petit")).toBeInTheDocument();
    await expect(canvas.getByText("Dora Leroy")).toBeInTheDocument();
  },
};

/** Long names wrap inside their column instead of overflowing. */
export const LongNames: Story = {
  args: {
    results: [
      line("Alexandrina Montgomery-Featherstonehaugh", 1, "9.85", "GBR"),
      line("Bartholomeus van der Westhuizen-Oosthuizen", 2, "9.90", "RSA"),
      line("Cleopatra Konstantinopoulou", 3, "9.93", "GRE"),
    ],
  },
};
