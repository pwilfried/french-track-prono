import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LeagueCompetitions } from "./league-competitions";

const text = messages.leagues;
const ADD_FORM = "Formulaire d'ajout";

const meta = {
  title: "Leagues/LeagueCompetitions",
  component: LeagueCompetitions,
  args: {
    competitions: [],
    addableCount: 0,
    isOwner: true,
    children: <p>{ADD_FORM}</p>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeagueCompetitions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No competition and none coming: one message only, no « already in the league » (#550). */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noComingCompetition)).toBeVisible();
    await expect(canvas.queryByText(text.noCompetition)).toBeNull();
    await expect(canvas.queryByText(text.nothingToAdd)).toBeNull();
    await expect(canvas.queryByText(ADD_FORM)).toBeNull();
  },
};

/** No competition yet, some coming: the creator is invited to add one, with the form. */
export const EmptyWithChoices: Story = {
  args: { addableCount: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noCompetition)).toBeVisible();
    await expect(canvas.getByText(ADD_FORM)).toBeVisible();
    await expect(canvas.queryByText(text.nothingToAdd)).toBeNull();
  },
};

/** A member of an empty league waits for its creator; no form. */
export const EmptyForMember: Story = {
  args: { isOwner: false, addableCount: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noCompetitionMember)).toBeVisible();
    await expect(canvas.queryByText(ADD_FORM)).toBeNull();
  },
};

/** The league counts every coming competition: « already in the league », no form. */
export const AllAdded: Story = {
  args: { competitions: [{ slug: "test-open", name: "Meeting de Testville" }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Meeting de Testville" })).toBeVisible();
    await expect(canvas.getByText(text.nothingToAdd)).toBeVisible();
    await expect(canvas.queryByText(text.noComingCompetition)).toBeNull();
    await expect(canvas.queryByText(ADD_FORM)).toBeNull();
  },
};

/** Long competition names wrap inside the column. */
export const LongText: Story = {
  args: {
    addableCount: 1,
    competitions: [
      {
        slug: "test-long",
        name: "Championnats interrégionaux en salle de la Vallée de la Haute-Testrivière espoirs et seniors",
      },
      { slug: "test-short", name: "Meeting de Testville" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const section = canvas.getByRole("region", { name: text.competitionsTitle });
    await expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth + 1);
    await expect(canvas.getByText(ADD_FORM)).toBeVisible();
  },
};
