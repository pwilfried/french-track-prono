import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { bandPoints } from "@/domain/band";

import { BandPoints } from "./band-points";

const at = (day: number) => `2026-08-${String(day).padStart(2, "0")}T19:00:00Z`;
const band = bandPoints([
  { family: "sprint", points: 42, eventStartsAt: at(1) },
  { family: "throws", points: 30, eventStartsAt: at(2) },
  { family: "middle", points: 12, eventStartsAt: at(3) },
]);

const meta = {
  title: "Band/BandPoints",
  component: BandPoints,
  args: { band, animal: "guepard", toReach: { animal: "ours", points: 12 } },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BandPoints>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A Guépard, the Ours next within reach. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(7);
    await expect(canvas.getAllByRole("listitem")[0]).toHaveAttribute("data-mine", "true");
    await expect(canvas.getByText("Encore 12 pts en lancers pour passer Ours")).toBeInTheDocument();
  },
};

/** A new player: no point yet, the bars empty and what gives an animal. */
export const Empty: Story = {
  args: { band: bandPoints([]), animal: null, toReach: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Marque tes premiers points/)).toBeInTheDocument();
  },
};
