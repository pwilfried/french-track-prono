import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { PublicLeagueRow, PublicLeagueRowSkeleton } from "./public-league-row";

const text = messages.leagues;

const meta = {
  title: "Leagues/PublicLeagueRow",
  component: PublicLeagueRow,
  args: {
    name: "Les Foulées",
    memberCount: 12,
    maxMembers: 200,
    summary: { count: 3, start: "2027-03", end: "2027-09" },
    children: <button type="button">{text.publicJoin}</button>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicLeagueRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Players out of the limit, competitions over which months, how full it is, « Rejoindre » (#662). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("12/200 joueurs · 3 compétitions · mars → sept. 2027"),
    ).toBeVisible();
    await expect(canvas.getByRole("img", { name: text.fillLabel(12, 200) })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: text.publicJoin })).toBeVisible();
  },
};

/** Limited to families: the badge under the name. */
export const Families: Story = {
  args: { families: ["throws", "jumps"] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(text.familiesBadge(["Sauts", "Lancers"])),
    ).toBeVisible();
  },
};

/** Empty: no competition yet. */
export const Empty: Story = {
  args: { memberCount: 1, summary: { count: 0, start: null, end: null } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(`1/200 joueurs · ${text.noCompetitionTag}`),
    ).toBeVisible();
  },
};

/** While loading: a row-shaped placeholder. */
export const Loading: Story = {
  render: () => <PublicLeagueRowSkeleton />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-hidden]")).not.toBeNull();
  },
};

/** The join failed: the form shows its error under the button. */
export const JoinError: Story = {
  args: {
    children: (
      <>
        <button type="button">{text.publicJoin}</button>
        <p role="alert" className="text-xs font-semibold text-accent-text">
          {messages.errors.LEAGUE_FULL}
        </p>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      messages.errors.LEAGUE_FULL,
    );
  },
};

/** A long name on two lines at most, every family: nothing overflows the row. */
export const LongText: Story = {
  args: {
    name: "Les Gazelles infatigables de la Vallée de la Haute-Testrivière et de ses environs",
    memberCount: 199,
    families: ["sprint", "hurdles", "middle", "long", "jumps", "throws", "combined", "relay"],
    summary: { count: 12, start: "2026-12", end: "2027-09" },
  },
  play: async ({ canvasElement }) => {
    const row = canvasElement.firstElementChild as HTMLElement;
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
  },
};
