import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LeagueCard } from "./league-card";

const text = messages.leagues;

const meta = {
  title: "Leagues/LeagueCard",
  component: LeagueCard,
  args: {
    href: "/ligues/demo",
    name: "Les Foulées",
    memberCount: 6,
    competitionNames: ["Meeting de Testville"],
    standing: { rank: 3, change: null },
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeagueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The player's place on the right, read out in full. */
export const Rank: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3e")).toBeVisible();
    await expect(canvas.getByText(text.rankLabel(3))).toBeInTheDocument();
    await expect(canvas.getByText("6 joueurs · Meeting de Testville")).toBeVisible();
  },
};

/** Two places won since yesterday; a lost place shows ▼. */
export const Movement: Story = {
  args: { standing: { rank: 1, change: 2 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1er")).toBeVisible();
    await expect(canvas.getByText(messages.leaderboard.change(2))).toBeInTheDocument();
  },
};

/** No points yet: no place, a short note instead. */
export const WithoutPoints: Story = {
  args: { standing: null, memberCount: 1, competitionNames: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noPointsYet)).toBeVisible();
    await expect(canvas.getByText(`1 joueur · ${text.noCompetitionTag}`)).toBeVisible();
  },
};

/** A league limited to families shows them in a badge: « Sprint · Haies » (#613). */
export const Families: Story = {
  args: { families: ["hurdles", "sprint"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.familiesBadge(["Sprint", "Haies"]))).toBeVisible();
  },
};

/** A league on all events has no badge. */
export const AllEvents: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/ · Haies/)).toBeNull();
  },
};

/** A long name and several competitions wrap inside the card; the place stays on the right. */
export const LongText: Story = {
  args: {
    name: "Les Gazelles infatigables de la Vallée de la Haute-Testrivière",
    isPublic: true,
    families: ["combined", "relay", "middle", "long", "jumps", "throws"],
    memberCount: 48,
    competitionNames: [
      "Championnats interrégionaux en salle de la Vallée de la Haute-Testrivière",
      "Meeting de Testville",
    ],
    standing: { rank: 12, change: -3 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("link");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
    await expect(canvas.getByText("12e")).toBeVisible();
  },
};
