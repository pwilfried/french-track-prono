import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import type { CommunityMoment } from "@/domain/community";

import { CommunityBlock } from "./community-block";
import { competitionOpen, episode, NOW, poll } from "./fixtures";

const text = messages.community;

const moment = (key: string, leagueName: string): CommunityMoment => ({
  key,
  kind: "perfect_podium",
  happenedAt: "2026-11-14T19:00:00.000Z",
  pseudo: "Flèche du Nord",
  bib: { number: 23, color: "blue" },
  competitionName: "Meeting de Paris",
  event: { discipline: "100 m", gender: "F" },
  leagueId: key,
  leagueName,
});

const meta = {
  title: "Community/CommunityBlock",
  component: CommunityBlock,
  args: {
    community: {
      announcements: [episode, competitionOpen],
      polls: [poll],
      moments: [moment("a", "Les amis du stade"), moment("b", "Le bureau")],
    },
    now: NOW,
    vote: fn(async () => ({})),
    compact: true,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CommunityBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On the home: the latest announcement, the open poll, the moments with their league. */
export const Home: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.title })).toBeVisible();
    await expect(canvas.getByRole("link", { name: text.seeAll })).toHaveAttribute(
      "href",
      "/communaute",
    );
    await expect(canvas.queryByText(competitionOpen.title)).toBeNull();
    await expect(canvas.getByText("Les amis du stade")).toBeVisible();
    await expect(canvas.getByText(poll.question)).toBeVisible();
  },
};

/** Its page: everything, under « FrenchTrack », « Sondages » and « Dans mes ligues ». */
export const Page: Story = {
  args: { compact: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.momentsTitle })).toBeVisible();
    await expect(canvas.getByText(competitionOpen.title)).toBeVisible();
  },
};

/** Nothing yet: what will come, and the next thing to do. */
export const Empty: Story = {
  args: { community: { announcements: [], polls: [], moments: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.empty)).toBeVisible();
    await expect(canvas.getByRole("link", { name: messages.ranking.predict })).toBeVisible();
  },
};

/** It could not be read: the message and a retry. */
export const Error: Story = {
  args: { community: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      messages.errors.COMMUNITY_UNAVAILABLE,
    );
  },
};

/** A long league name wraps at 390 px. */
export const LongText: Story = {
  args: {
    community: {
      announcements: [],
      polls: [],
      moments: [moment("a", "La ligue des fans de demi-fond du club de la vallée")],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
