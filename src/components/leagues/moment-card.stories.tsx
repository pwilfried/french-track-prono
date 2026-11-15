import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import type { FeedMoment } from "@/domain/league-moments";

import { MomentCard } from "./moment-card";

const text = messages.leagues.feed;
/** Testing Library reads no-break spaces (« 100 m ») as plain spaces. */
const plain = (value: string) => value.replace(/\u00a0/g, " ");

const base: FeedMoment = {
  key: "perfect_podium:e1:u1",
  kind: "perfect_podium",
  happenedAt: "2026-11-15T19:00:00.000Z",
  pseudo: "Flèche du Nord",
  bib: { number: 23, color: "blue" },
  competitionName: "Meeting de Paris",
  event: { discipline: "100 m", gender: "F" },
};

const meta = {
  title: "Leagues/MomentCard",
  component: MomentCard,
  args: { moment: base },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MomentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A member found the perfect podium of an event. */
export const PerfectPodium: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.label.perfect_podium)).toBeVisible();
    await expect(
      canvas.getByText(
        plain(text.text.perfect_podium("Flèche du Nord", messages.events.name("100 m", "F"))),
      ),
    ).toBeVisible();
  },
};

/** The 1st place of the league changed. */
export const NewLeader: Story = {
  args: { moment: { ...base, key: "new_leader", kind: "new_leader" } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.label.new_leader)).toBeVisible();
  },
};

/** The final result of a Manager duel, with both scores. */
export const DuelResult: Story = {
  args: {
    moment: {
      ...base,
      key: "duel",
      kind: "duel_result",
      otherPseudo: "Perche Dorée",
      scores: [3120, 2985],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        text.text.duel_result("Flèche du Nord", "Perche Dorée", [3120, 2985]),
      ),
    ).toBeVisible();
  },
};

/** A winning bid at the reveal of a mercato round. */
export const MercatoWin: Story = {
  args: {
    moment: {
      ...base,
      key: "mercato",
      kind: "mercato_win",
      athlete: "Athlète Inventée",
      price: 42,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.label.mercato_win)).toBeVisible();
  },
};

/** A draw: both players named, the same score. */
export const DuelDraw: Story = {
  args: {
    moment: {
      ...base,
      key: "draw",
      kind: "duel_result",
      otherPseudo: "Perche Dorée",
      scores: [3000, 3000],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        text.text.duel_result("Flèche du Nord", "Perche Dorée", [3000, 3000]),
      ),
    ).toBeVisible();
  },
};

/** A new badge level, named with its level. */
export const Badge: Story = {
  args: {
    moment: { ...base, key: "badge", kind: "badge", badge: "nostradamus", level: "gold" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.label.badge)).toBeVisible();
    await expect(
      canvas.getByText(text.text.badge("Flèche du Nord", "Nostradamus", "en or")),
    ).toBeVisible();
  },
};

/** A run of scoring predictions. */
export const Streak: Story = {
  args: { moment: { ...base, key: "streak", kind: "streak", length: 7 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(text.text.streak("Flèche du Nord", 7)),
    ).toBeVisible();
  },
};

/** A long pseudo and a long event name wrap on a phone, nothing overflows. */
export const LongText: Story = {
  args: {
    moment: {
      ...base,
      pseudo: "Supercalifragilistique du demi-fond",
      event: {
        discipline: "Relais 4x400 m, finale des Championnats d'Europe par équipes",
        gender: "X",
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
