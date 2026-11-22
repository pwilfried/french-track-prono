import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LeaguePredict, type PredictFinal } from "./league-predict";

const text = messages.leagues.predict;
const now = new Date("2026-09-12T14:25:00Z");
const final = (slug: string, discipline: string, startsAt: string): PredictFinal => ({
  slug,
  competitionSlug: "ultimate-2026",
  discipline,
  gender: "F",
  startsAt,
  lockAt: startsAt,
});
const hurdles = final("60m-haies-f", "60 m haies", "2026-09-12T16:40:00Z");

const meta = {
  title: "Leagues/LeaguePredict",
  component: LeaguePredict,
  args: { now, call: { kind: "predict", finals: [hurdles] } },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeaguePredict>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One open final: a big « Pronostiquer » link to it, with its time and the time left. */
export const OneOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.next)).toBeVisible();
    await expect(canvas.getByText(text.open)).toBeVisible();
    await expect(canvas.getByText(text.startsAt(text.today, "18:40", "2 h 15 min"))).toBeVisible();
    const link = canvas.getByRole("link", { name: text.play });
    await expect(link).toHaveAttribute("href", "/epreuves/60m-haies-f");
    await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
  },
};

/** Several open finals the same day: their list, the link goes to the day's finals to predict. */
export const SeveralTheSameDay: Story = {
  args: {
    call: {
      kind: "predict",
      finals: [
        hurdles,
        final("200m-f", "200 m", "2026-09-12T17:10:00Z"),
        final("perche-f", "Saut à la perche", "2026-09-12T18:00:00Z"),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.nextMany)).toBeVisible();
    await expect(canvas.getByText(text.openCount(3))).toBeVisible();
    await expect(canvas.getByText(text.manyFinals(text.today, 3))).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getByRole("link", { name: text.play })).toHaveAttribute(
      "href",
      "/competitions?competition=ultimate-2026&jour=2026-09-12&filtre=todo",
    );
  },
};

/** Every open podium posed: a green band and a secondary « Voir » to my predictions. */
export const AllPosed: Story = {
  args: { call: { kind: "done", posed: 3, first: hurdles } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.doneTitle)).toBeVisible();
    await expect(canvas.getByText(text.done(3, text.untilTime("18:40")))).toBeVisible();
    await expect(canvas.queryByRole("link", { name: text.play })).toBeNull();
    const see = canvas.getByRole("link", { name: text.seeLabel });
    await expect(see.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

/** Nothing open: no button, one line saying when the next one opens. */
export const NoneOpen: Story = {
  args: { call: { kind: "next", competition: { startsOn: "2026-11-27" } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(`${text.none} ven. 27 nov.`);
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};

/** Nothing open and nothing to come: no block at all. */
export const Empty: Story = {
  args: { call: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("section, [role=status]")).toBeNull();
  },
};

/** A long final name wraps inside the card at 390 px. */
export const LongText: Story = {
  args: {
    call: {
      kind: "predict",
      finals: [final("long", "3 000 m steeple (relevé, finale reprogrammée)", hurdles.startsAt)],
    },
  },
  play: async ({ canvasElement }) => {
    const section = within(canvasElement).getByRole("region");
    await expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth);
  },
};
