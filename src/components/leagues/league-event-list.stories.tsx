import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LeagueEventList } from "./league-event-list";

const text = messages.leagues;

const events = [
  { id: "1", slug: "100m-h", name: "100 m hommes", startsAt: "2026-09-12T18:00:00Z", counts: true },
  {
    id: "2",
    slug: "jav-f",
    name: "Javelot femmes",
    startsAt: "2026-09-12T19:00:00Z",
    counts: false,
  },
];

const meta = {
  title: "Leagues/LeagueEventList",
  component: LeagueEventList,
  args: { events, title: text.eventsTitle },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeagueEventList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A sprint league: the javelin is greyed « Hors ligue », still a link to predict it. */
export const OutOfLeague: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(text.outOfLeague)).toHaveLength(1);
    await expect(canvas.getByRole("link", { name: /Javelot femmes/ })).toHaveAttribute(
      "href",
      "/epreuves/jav-f",
    );
    await expect(canvas.getByText(text.outOfLeagueNote)).toBeVisible();
  },
};

/** The preview of an added family: started events do not count, coming ones do. */
export const Preview: Story = {
  args: { variant: "preview", title: text.previewTitle(text.family.throws) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.previewCounts)).toBeVisible();
    await expect(canvas.getByText(text.previewNotCounted)).toBeVisible();
    await expect(canvas.queryByText(text.outOfLeague)).toBeNull();
  },
};

/** No event announced yet. */
export const Empty: Story = {
  args: { events: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.eventsEmpty)).toBeVisible();
  },
};

/** No event of the family in the preview. */
export const PreviewEmpty: Story = {
  args: { events: [], variant: "preview", title: text.previewTitle(text.family.relay) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.previewEmpty)).toBeVisible();
  },
};

/** A long event name wraps on a phone. */
export const LongText: Story = {
  args: {
    events: [
      {
        id: "3",
        slug: "relay",
        name: "Relais mixte 4x400 m, finale des Championnats d'Europe par équipes",
        startsAt: "2026-09-13T18:00:00Z",
        counts: false,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
