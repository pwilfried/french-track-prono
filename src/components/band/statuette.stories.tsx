import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Statuette } from "./statuette";

const meta = {
  title: "Band/Statuette",
  component: Statuette,
  args: {
    shape: "guepard",
    metal: "gold",
    title: "Guépard d'or",
    plaque: ["Les Copains", "Saison 2026"],
  },
  decorators: [
    (Story) => (
      <div className="w-32 bg-background p-4">
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
    await expect(canvas.getByText("Les Copains")).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-animal="guepard"]')).not.toBeNull();
  },
};

export const Silver: Story = {
  args: { shape: "ours", metal: "silver", title: "Ours d'argent", plaque: ["Bureau"] },
};

/** The Manager trophy: the hare. */
export const Bronze: Story = {
  args: {
    shape: "lievre",
    metal: "bronze",
    title: "Lièvre de bronze",
    plaque: ["Manager · Mercato", "Saison 2026"],
  },
};

/** The laurel of the general ranking, the place at its centre. */
export const Laurel: Story = {
  args: {
    shape: "laurel",
    metal: "silver",
    title: "Laurier d'argent",
    plaque: ["Classement général", "Saison 2026"],
    center: "Top 3",
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg text")).toHaveTextContent("Top 3");
  },
};

/** The Chrono figé: a stopwatch. */
export const Chrono: Story = {
  args: { shape: "chrono", title: "Chrono figé", plaque: ["Les Copains", "Saison 2026"] },
};

/** The Témoin d'or: a relay baton. */
export const Witness: Story = {
  args: {
    shape: "witness",
    title: "Témoin d'or",
    plaque: ["Devant le compte FrenchTrack", "Saison 2026"],
  },
};

/** The Record de ligue: an engraved plaque, the points on it. */
export const Record: Story = {
  args: {
    shape: "record",
    title: "Record de ligue",
    plaque: ["Les Copains", "Saison 2026"],
    center: "142",
  },
};

/** An empty slot of the display case: a dashed frame and what it takes. */
export const Empty: Story = {
  args: {
    shape: "witness",
    metal: null,
    title: "Témoin d'or",
    plaque: ["À gagner", "Finis une compétition devant le compte FrenchTrack"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("À gagner")).toBeInTheDocument();
    await expect(canvasElement.querySelector("figure")).toHaveAttribute("data-metal", "empty");
  },
};

/** An animal still to win: the grey « ? » silhouette. */
export const EmptyAnimal: Story = {
  args: { metal: null, title: "Ligue", plaque: ["À gagner"] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-animal="locked"]')).not.toBeNull();
  },
};

/** A long league name wraps on the plaque. */
export const LongText: Story = {
  args: {
    plaque: ["La ligue des grands amateurs de demi-fond du jeudi soir", "Saison 2026"],
  },
};

/** On the night background of the dark theme. */
export const Dark: Story = {
  args: { shape: "laurel", title: "Laurier d'or", plaque: ["Classement général"], center: "1er" },
  decorators: [
    (Story) => (
      <div className="dark w-32 bg-[#052B5C] p-4">
        <Story />
      </div>
    ),
  ],
};
