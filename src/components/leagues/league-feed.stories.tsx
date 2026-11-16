import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { feedGroups, type FeedMoment } from "@/domain/league-moments";
import { mercatoMoments, type MercatoWinFact } from "@/domain/manager-moments";

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

/** A full mercato: 4 players, 3 rounds, 7 athletes each, then a duel and a badge. */
const PLAYERS = ["Démo Disque", "Démo Haies", "Démo Perche", "Démo Sprint"];
const fullMercato: MercatoWinFact[] = PLAYERS.flatMap((pseudo, p) =>
  Array.from({ length: 7 }, (_, i) => {
    const round = (i % 3) + 1;
    return {
      round,
      athleteId: `${p}-${i}`,
      athlete: `Athlète ${p * 7 + i + 1}`,
      price: 3 + ((p + i) % 6),
      userId: `u${p}`,
      pseudo,
      closedAt: `2026-11-1${round}T09:00:00.000Z`,
    };
  }),
);

/** A Manager feed after a full mercato: one card per round and player, 10 first (#979). */
export const ManagerMercato: Story = {
  args: {
    pageSize: 10,
    groups: feedGroups(
      [
        ...mercatoMoments(fullMercato),
        {
          key: "duel_result:1:u0",
          kind: "duel_result",
          happenedAt: "2026-11-15T20:00:00.000Z",
          pseudo: "Démo Disque",
          otherPseudo: "Démo Haies",
          competitionName: "Meeting de Paris",
          scores: [900, 700],
        },
        {
          key: "badge:u2:foudre:silver",
          kind: "badge",
          happenedAt: "2026-11-15T19:00:00.000Z",
          pseudo: "Démo Perche",
          badge: "foudre",
          level: "silver",
        },
      ],
      NOW,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 12 mercato cards (4 players × 3 rounds), a duel and a badge: 14, 10 shown.
    await expect(canvas.getAllByRole("article")).toHaveLength(10);
    await userEvent.click(canvas.getByRole("button", { name: text.more }));
    await expect(canvas.getAllByRole("article")).toHaveLength(14);
    await expect(canvas.queryByRole("button", { name: text.more })).toBeNull();
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

/** An empty Manager feed points to the mercato of the league (#875). */
export const ManagerEmpty: Story = {
  args: {
    groups: [],
    empty: {
      text: messages.manager.feed.empty,
      href: "/manager/ligue/catalogue",
      action: messages.manager.feed.toMercato,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(messages.manager.feed.empty)).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: messages.manager.feed.toMercato }),
    ).toHaveAttribute("href", "/manager/ligue/catalogue");
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
