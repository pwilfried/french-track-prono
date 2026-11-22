import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { PREDICTION_JOKERS } from "@/domain/league-jokers";

import { MyJokers } from "./league-jokers";

const text = messages.leagueJokers;
const all = [...PREDICTION_JOKERS];

const meta = {
  title: "Leagues/LeagueJokers",
  component: MyJokers,
  args: { remaining: all, used: [] },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MyJokers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No joker played yet: the five to play, each with what it does. */
export const NonePlayed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noneUsed)).toBeVisible();
    for (const joker of all) await expect(canvas.getByText(text.explain[joker])).toBeVisible();
  },
};

/** Every joker played, one on an event no longer listed; a long event name (dark theme). */
export const AllPlayedDark: Story = {
  args: {
    remaining: [],
    used: [
      {
        joker: "double",
        event: { name: "3000 m steeple-chase hommes, finale olympique", href: "/epreuves/x" },
      },
      { joker: "spy", event: { name: "100 m femmes", href: "/epreuves/y" } },
      { joker: "outsider", event: null },
    ],
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noneLeft)).toBeVisible();
    await expect(canvas.getByRole("link", { name: /steeple-chase/ })).toHaveAttribute(
      "href",
      "/epreuves/x",
    );
  },
};
