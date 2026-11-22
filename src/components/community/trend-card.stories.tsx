import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { trend, trendWithResult } from "./fixtures";
import { REVEAL_ANCHOR, TrendCard } from "./trend-card";

const text = messages.community.trend;
/** Testing Library reads no-break spaces (« 100 m ») as plain spaces. */
const plain = (value: string) => value.replace(/ /g, " ");

const meta = {
  title: "Community/TrendCard",
  component: TrendCard,
  args: { trend },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the result: the favourite at 1st place, its share and the number of predictions. */
export const BeforeResult: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link");
    await expect(card).toHaveAttribute("href", `/epreuves/${trend.slug}#${REVEAL_ANCHOR}`);
    await expect(card).toHaveTextContent(text.label);
    await expect(card).toHaveTextContent(plain(messages.events.name("100 m", "F")));
    await expect(card).toHaveTextContent(plain(text.favourite("Alpha Bravo", 62)));
    await expect(card).toHaveTextContent(text.predictions(128));
  },
};

/** After the result: whether the favourite won, and the share of perfect podiums. */
export const AfterResult: Story = {
  args: { trend: trendWithResult },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link");
    await expect(card).toHaveTextContent(text.favouriteWon("Alpha Bravo"));
    await expect(card).toHaveTextContent(plain(text.perfect(8)));
    await expect(card).not.toHaveTextContent(text.predictions(128));
  },
};

/** The favourite lost, and nobody found the perfect podium. */
export const FavouriteLost: Story = {
  args: { trend: { ...trend, result: { favouriteWon: false, perfectPercent: 0 } } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link");
    await expect(card).toHaveTextContent(text.favouriteLost("Alpha Bravo"));
    await expect(card).toHaveTextContent(plain(text.perfect(0)));
  },
};

/** The favourite is « Autre », an athlete not on the start list. */
export const OtherAthlete: Story = {
  args: {
    trend: { ...trend, total: 1, favourite: { athleteId: "other", name: null, percent: 100 } },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("link");
    await expect(card).toHaveTextContent(plain(text.favourite(messages.picker.other, 100)));
    await expect(card).toHaveTextContent(text.predictions(1));
  },
};

/** A long name and a long discipline wrap at 390 px. */
export const LongText: Story = {
  args: {
    trend: {
      ...trend,
      discipline: "3 000 m steeple des espoirs",
      favourite: {
        athleteId: "a1",
        name: "Maximilienne-Alexandrine de la Vallée-Haute",
        percent: 34,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
