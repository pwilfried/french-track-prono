import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { ANIMALS } from "@/domain/band";

import { Animal } from "./animal";

const KINDS = [...ANIMALS, "locked"] as const;

function Band({ size }: { size: "small" | "medium" | "large" }) {
  return (
    <ul className="flex flex-wrap items-end gap-3">
      {KINDS.map((kind) => (
        <li key={kind}>
          <Animal kind={kind} size={size} label />
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: "Band/Animal",
  component: Animal,
  args: { kind: "guepard", size: "large", label: true },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Animal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One animal, named for screen readers. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("img", { name: "Guépard" })).toBeInTheDocument();
  },
};

/** The whole band and the « ? » of what is still to win, small (lists). */
export const SmallBand: Story = {
  render: () => <Band size="small" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("img")).toHaveLength(8);
    await expect(canvas.getByRole("img", { name: "À gagner" })).toBeInTheDocument();
  },
};

/** The whole band, large (profile header, bibs, statuettes). */
export const LargeBand: Story = {
  render: () => <Band size="large" />,
};

/** On the night background of the dark theme: fixed colours, like a bib. */
export const Dark: Story = {
  render: () => <Band size="large" />,
  decorators: [
    (Story) => (
      <div className="dark max-w-[390px] bg-[#052B5C] p-4">
        <Story />
      </div>
    ),
  ],
};

/** Decorative next to its name: hidden from screen readers. */
export const Decorative: Story = {
  args: { label: false, size: "small" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("img")).toBeNull();
  },
};
