import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { Hare } from "./hare";

const meta = {
  title: "Brand/Hare",
  component: Hare,
  args: { size: 160 },
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-end gap-6 bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Hare>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  args: { size: 320 },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg");
    await expect(svg).toHaveAttribute("width", "320");
    await expect(svg).toHaveAttribute("aria-hidden", "true");
  },
};

export const Small: Story = {
  args: { size: 48 },
};

/** The head alone, as in the browser tab favicon. */
export const Head: Story = {
  args: { size: 32, variant: "head" },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg");
    await expect(svg).toHaveAttribute("data-variant", "head");
    await expect(svg).toHaveAttribute("height", "32");
  },
};

/** Every size side by side, from the favicon to the home-screen icon. */
export const AllSizes: Story = {
  render: () => (
    <>
      <Hare size={16} variant="head" />
      <Hare size={32} variant="head" />
      <Hare size={48} />
      <Hare size={96} />
      <Hare size={240} />
    </>
  ),
};
