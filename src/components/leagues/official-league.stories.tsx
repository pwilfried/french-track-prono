import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { OfficialLeague } from "./official-league";

const meta = {
  title: "Leagues/OfficialLeague",
  component: OfficialLeague,
  args: {
    name: "Ligue FrenchTrack",
    memberCount: 1234,
    children: <button type="button">Rejoindre la Ligue FrenchTrack</button>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OfficialLeague>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Above the public leagues while the player is not in it (#553). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const block = within(canvasElement).getByRole("region", { name: "Ligue FrenchTrack" });
    await expect(block).toHaveTextContent("Officielle");
    await expect(block).toHaveTextContent("Ouverte à tous");
    await expect(block).toHaveTextContent("1234 joueurs");
    await expect(
      within(block).getByRole("button", { name: "Rejoindre la Ligue FrenchTrack" }),
    ).toBeInTheDocument();
  },
};

/** A long name wraps inside the block. */
export const LongName: Story = {
  args: { name: "Ligue FrenchTrack des Championnats d'Europe d'athlétisme en salle" },
  play: async ({ canvasElement }) => {
    const block = within(canvasElement).getByRole("region");
    await expect(block.scrollWidth).toBeLessThanOrEqual(block.clientWidth + 1);
  },
};
