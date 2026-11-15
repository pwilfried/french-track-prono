import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { feedGroups, type FeedMoment } from "@/domain/league-moments";

import { LeagueFeed } from "./league-feed";

const text = messages.leagues.feed;
const NOW = "2026-11-15T21:00:00.000Z";

const moment = (key: string, kind: FeedMoment["kind"], happenedAt: string): FeedMoment => ({
  key,
  kind,
  happenedAt,
  pseudo: "Flèche du Nord",
  bib: { number: 23, color: "blue" },
  competitionName: "Meeting de Paris",
  event: { discipline: "100 m", gender: "F" },
  length: 5,
});

const meta = {
  title: "Leagues/LeagueFeed",
  component: LeagueFeed,
  args: {
    groups: feedGroups(
      [
        moment("a", "perfect_podium", "2026-11-15T19:00:00.000Z"),
        moment("b", "new_leader", "2026-11-15T19:00:00.000Z"),
        moment("c", "streak", "2026-11-14T19:00:00.000Z"),
      ],
      NOW,
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeagueFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tonight's moments under their competition, then yesterday's. */
export const Grouped: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: text.tonight("Meeting de Paris") }),
    ).toBeVisible();
    await expect(canvas.getByRole("heading", { name: text.yesterday })).toBeVisible();
    await expect(canvas.getAllByRole("article")).toHaveLength(3);
  },
};

/** Nothing told yet: what the feed will tell, and the next thing to do. */
export const Empty: Story = {
  args: { groups: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.empty)).toBeVisible();
    await expect(canvas.getByRole("link", { name: messages.ranking.predict })).toHaveAttribute(
      "href",
      "/competitions",
    );
  },
};

/** A long competition name wraps in the title of its group. */
export const LongText: Story = {
  args: {
    groups: feedGroups(
      [
        {
          ...moment("a", "perfect_podium", "2026-11-15T19:00:00.000Z"),
          competitionName: "Championnats d'Europe d'athlétisme en salle, session du soir",
        },
      ],
      NOW,
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
