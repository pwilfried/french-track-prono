import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { ChallengeMomentCard } from "./challenge-moment-card";
import { challenge } from "./fixtures";

const text = messages.challenge;

const meta = {
  title: "Community/ChallengeMomentCard",
  component: ChallengeMomentCard,
  args: { moment: challenge },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChallengeMomentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A computed challenge: the event, the share of players who beat FrenchTrack, my verdict. */
export const Won: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("link");
    await expect(card).toHaveAttribute("href", `/epreuves/${challenge.slug}`);
    await expect(card).toHaveTextContent(messages.events.name("100 m", "F"));
    await expect(card).toHaveTextContent(text.beaten(42));
    await expect(card).toHaveTextContent(text.verdict.won);
  },
};

/** Nobody beat FrenchTrack, and I had no prediction. */
export const NobodyBeatIt: Story = {
  args: { moment: { ...challenge, beaten: { count: 0, percent: 0 }, verdict: "no_prediction" } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link");
    await expect(card).toHaveTextContent(text.beaten(0));
    await expect(card).toHaveTextContent(text.verdict.no_prediction);
  },
};

/** A long event name wraps inside 320 px. */
export const LongText: Story = {
  args: {
    moment: {
      ...challenge,
      discipline: "3000 m steeple en salle des championnats",
      verdict: "tie",
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-[320px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
  },
};
