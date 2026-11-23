import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LatestResult } from "./latest-result";

const text = messages.leagueResult;

const meta = {
  title: "Leagues/LatestResult",
  component: LatestResult,
  args: {
    eventName: "100 m hommes",
    href: "/ligues/demo/epreuves/100m-h",
    winner: { pseudo: "Sprinteur Fou", points: 14 },
    mine: { rank: 2, points: 9 },
    perfect: 1,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LatestResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Sprinteur Fou")).toBeVisible();
    await expect(canvas.getByRole("link", { name: text.latestSeeAll })).toHaveAttribute(
      "href",
      "/ligues/demo/epreuves/100m-h",
    );
  },
};

/** I did not predict it. */
export const WithoutMine: Story = { args: { mine: null } };

/** Nobody scored yet. */
export const Nobody: Story = {
  args: { winner: null, mine: null, perfect: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.latestNobody)).toBeVisible();
  },
};

/** A long pseudo and a long event name. */
export const LongText: Story = {
  args: {
    eventName: "3 000 m steeple femmes · Finale du championnat",
    winner: { pseudo: "Le plus long pseudo jamais vu", points: 128 },
  },
};
