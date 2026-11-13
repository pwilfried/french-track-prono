import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { VenueChip } from "./venue-chip";

const meta = {
  title: "Events/VenueChip",
  component: VenueChip,
  args: { venue: "indoor" },
  decorators: [
    (Story) => (
      <div className="flex max-w-sm flex-wrap items-center gap-2 bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VenueChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An indoor competition: the « Salle » chip. */
export const Indoor: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Salle")).toBeInTheDocument();
  },
};

/** Empty: an outdoor competition, the usual case, shows nothing. */
export const Outdoor: Story = {
  args: { venue: "outdoor" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText("Salle")).not.toBeInTheDocument();
  },
};

/** Long text: next to a long competition name in a narrow card, the chip keeps one line. */
export const NextToALongName: Story = {
  render: (args) => (
    <p className="flex w-56 items-start justify-between gap-2 rounded-card bg-card p-3">
      <span className="font-bold">Championnats d&apos;Europe d&apos;athlétisme en salle 2027</span>
      <VenueChip {...args} className="shrink-0" />
    </p>
  ),
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByText("Salle");
    await expect(chip.getBoundingClientRect().height).toBeLessThan(40);
  },
};
