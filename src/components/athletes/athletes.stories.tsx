import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { AthleteRace } from "@/domain/athlete";

import { AthleteHero } from "./athlete-hero";
import { RecentRaces } from "./recent-races";
import { RecordsRow } from "./records-row";

const meta = {
  title: "Athletes/AthletePage",
  component: AthleteHero,
  args: { name: "Sha'Carri Richardson", countryCode: "USA", gender: "F" },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AthleteHero>;

export default meta;
type Story = StoryObj<typeof meta>;

const race = (eventSlug: string, startsAt: string, rank: number, mark: string): AthleteRace => ({
  competitionSlug: "ultimate-championship-2026",
  eventSlug,
  discipline: eventSlug === "f-200m" ? "200 m" : "100 m",
  startsAt,
  meeting: "World Athletics Ultimate Championship",
  rank,
  mark,
});

/** Hero, records band and recent races together. */
export const Full: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      <AthleteHero {...args} />
      <RecordsRow
        rows={[
          {
            discipline: "100 m",
            pr: {
              discipline: "100 m",
              kind: "pr",
              mark: "10.65",
              date: "2023-08-21",
              meeting: null,
            },
            sb: {
              discipline: "100 m",
              kind: "sb",
              mark: "10.76",
              date: "2026-09-12",
              meeting: null,
            },
          },
          {
            discipline: "200 m",
            pr: {
              discipline: "200 m",
              kind: "pr",
              mark: "21.92",
              date: "2023-08-25",
              meeting: null,
            },
            sb: null,
          },
        ]}
      />
      <RecentRaces
        races={[
          race("f-100m", "2026-09-12T18:00:00Z", 3, "10.76"),
          race("f-200m", "2026-09-11T18:00:00Z", 2, "22.10"),
        ]}
        linkable={() => true}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Richardson");
    await expect(canvas.getByText("10.65")).toBeVisible();
    await expect(canvas.getAllByRole("link")).toHaveLength(2);
  },
};

/** No record and no race yet. */
export const Empty: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      <AthleteHero {...args} />
      <RecordsRow rows={[]} />
      <RecentRaces races={[]} linkable={() => true} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pas encore de record connu.")).toBeVisible();
    await expect(canvas.getByText("Pas encore de résultat dans le jeu.")).toBeVisible();
  },
};

/** A long name and a long meeting name wrap instead of overflowing. */
export const LongText: Story = {
  args: { name: "Marie-Josée Ta Lou-Smith Konan Bi Tra", countryCode: "CIV" },
  render: (args) => (
    <div className="flex flex-col gap-6">
      <AthleteHero {...args} />
      <RecentRaces
        races={[
          {
            ...race("f-100m", "2026-09-12T18:00:00Z", 1, "10.80"),
            meeting: "Meeting international de Paris Saint-Denis Diamond League",
          },
        ]}
        linkable={() => false}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole("link")).toHaveLength(0);
  },
};
