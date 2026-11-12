import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { BIB_COLORS } from "@/domain/bib";

import { Bib } from "./bib";

const meta = {
  title: "Profile/Bib",
  component: Bib,
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-4 bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Bib>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Large: pins, « FRENCH TRACK », the number and the pseudo. */
export const Large: Story = {
  args: { bib: { number: 42, color: "blue" }, size: "large", pseudo: "Démo Gazelle" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { name: "Dossard 42, Démo Gazelle" })).toBeVisible();
    await expect(canvas.getByText("FRENCH TRACK")).toBeVisible();
  },
};

/** Small: the number alone, next to a pseudo in a ranking. */
export const Small: Story = {
  args: { bib: { number: 7, color: "red" } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("7")).toBeVisible();
  },
};

/** The six colours, with a number of 1, 2 and 3 digits, both sizes. */
export const EveryColour: Story = {
  args: { bib: { number: 0, color: "blue" } },
  render: () => (
    <div className="flex flex-col gap-6">
      {BIB_COLORS.map((color) => (
        <div key={color} className="flex flex-wrap items-center gap-3">
          {[0, 42, 999].map((number) => (
            <Bib key={number} bib={{ number, color }} />
          ))}
          <Bib bib={{ number: 999, color }} size="large" pseudo="Démo Perche" />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const bibs = canvasElement.querySelectorAll("[data-bib-color]");
    await expect(bibs).toHaveLength(BIB_COLORS.length * 4);
  },
};

/** On the night background of the dark theme: the white and night bibs keep a visible border. */
export const OnDarkBackground: Story = {
  args: { bib: { number: 0, color: "blue" } },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-nuit p-6">
      {BIB_COLORS.map((color, i) => (
        <Bib key={color} bib={{ number: [5, 18, 110, 999, 1, 64][i]!, color }} />
      ))}
      <Bib bib={{ number: 1, color: "night" }} size="large" pseudo="Démo Nuit" />
      <Bib bib={{ number: 88, color: "white" }} size="large" pseudo="Démo Blanc" />
    </div>
  ),
};

/** A long pseudo is cut on one line, the number stays whole. */
export const LongPseudo: Story = {
  args: {
    bib: { number: 999, color: "green" },
    size: "large",
    pseudo: "Démo Pseudo Très Long 24",
  },
};

/** A large bib without a pseudo (preview before typing one): the space stays, nothing moves. */
export const NoPseudo: Story = {
  args: { bib: { number: 1, color: "white" }, size: "large" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("img", { name: "Dossard 1" })).toBeVisible();
  },
};
