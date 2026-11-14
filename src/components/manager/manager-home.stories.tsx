import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { MySeason } from "@/application/manager-home";
import { messages } from "@/app/messages.fr";

import { ManagerStart, MySeasonCard } from "./manager-home";

const text = messages.managerHome;
const NOW = new Date("2026-11-13T12:00:00.000Z");

const zoe = { userId: "u1", pseudo: "Flèche", bib: { number: 7, color: "gold" as const } };
const max = { userId: "u2", pseudo: "Comète", bib: { number: 12, color: "blue" as const } };

const waiting: MySeason = {
  leagueId: "L",
  step: "league",
  mercato: null,
  round: null,
  standing: null,
  next: null,
  lineup: null,
  lastPoints: null,
};

const lineup: MySeason = {
  ...waiting,
  step: "lineup",
  round: { current: 3, total: 12 },
  standing: { rank: 2, points: 4, wins: 1, draws: 1, losses: 0, difference: 120 },
  next: { round: 3, home: true, me: zoe, opponent: max },
  // Locks in 2 days.
  lineup: { slug: "meeting-3", lockAt: "2026-11-15T12:00:00.000Z" },
  lastPoints: "meeting-2",
};

function decorator(className: string) {
  return function Frame(Story: () => React.ReactNode) {
    return (
      <div className={`w-[390px] p-4 ${className}`}>
        <Story />
      </div>
    );
  };
}

const meta = {
  title: "Manager/ManagerHome",
  component: MySeasonCard,
  args: { season: lineup, now: NOW },
  decorators: [decorator("bg-background text-foreground")],
} satisfies Meta<typeof MySeasonCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Without a Manager league: the mode in one line, the ways in, then the steps. */
export const NoLeague: Story = {
  render: () => <ManagerStart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.startTitle })).toBeVisible();
    await expect(canvas.getByText(text.startText)).toBeVisible();
    await expect(canvas.getByRole("link", { name: messages.manager.create })).toHaveAttribute(
      "href",
      "/manager/creer",
    );
    await expect(canvas.queryByRole("region", { name: text.mySeason })).toBeNull();
    const steps = within(canvas.getByRole("list", { name: text.stepsTitle }));
    await expect(steps.getAllByRole("listitem")).toHaveLength(7);
    await expect(steps.getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
  },
};

/** The mercato is open: its round, the action leads to the catalogue. */
export const MercatoOpen: Story = {
  args: {
    season: { ...waiting, step: "mercato", mercato: { round: 1, endsAt: "2026-11-14T12:00:00Z" } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const season = within(canvas.getByRole("region", { name: text.mySeason }));
    await expect(season.getByText(messages.managerLeagueCard.phase.mercato(1))).toBeVisible();
    await expect(season.getByText(text.notStarted)).toBeVisible();
    await expect(season.getByRole("link", { name: text.action.mercato })).toHaveAttribute(
      "href",
      "/manager/L/catalogue",
    );
  },
};

/** Matchday 3 of 12: place, points, difference, the next head-to-head and the lineup to set. */
export const LineupToDo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const season = within(canvas.getByRole("region", { name: text.mySeason }));
    await expect(season.getByText(messages.managerLeagueCard.phase.season(3, 12))).toBeVisible();
    await expect(season.getByText("2e")).toBeVisible();
    await expect(season.getByText(text.record(1, 1, 0))).toBeVisible();
    await expect(season.getByText("+120")).toBeVisible();
    await expect(season.getByLabelText(text.nextDuel("Flèche", "Comète"))).toBeVisible();
    await expect(season.getByRole("link", { name: text.lineupAction("2 j") })).toHaveAttribute(
      "href",
      "/manager/L/alignement/meeting-3",
    );
  },
};

/** The season is over: the action leads to its end. */
export const SeasonOver: Story = {
  args: {
    season: {
      ...lineup,
      step: "champion",
      round: { current: 12, total: 12 },
      standing: { rank: 1, points: 25, wins: 8, draws: 1, losses: 3, difference: 940 },
      next: null,
      lineup: null,
      lastPoints: "meeting-12",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const season = within(canvas.getByRole("region", { name: text.mySeason }));
    await expect(season.getByText("1er")).toBeVisible();
    await expect(season.queryByText(text.nextTitle(12))).toBeNull();
    await expect(season.getByRole("link", { name: text.action.champion })).toHaveAttribute(
      "href",
      "/manager/L/fin-de-saison",
    );
  },
};

/** Dark theme: the page on the night background, the season card keeps its night blue. */
export const Dark: Story = {
  decorators: [decorator("dark bg-nuit text-white")],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("region", { name: text.mySeason })).toBeVisible();
  },
};

/** Long pseudos still wrap inside the 390 px screen. */
export const LongText: Story = {
  args: {
    season: {
      ...lineup,
      next: {
        ...lineup.next!,
        me: { ...zoe, pseudo: "Fléchedargentdu400mhaies" },
        opponent: { ...max, pseudo: "Comètesupersoniquedu3000steeple" },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: text.mySeason });
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
