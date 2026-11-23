import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

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

/** The athletes a player won in a mercato round: one card, folded names and prices (#979). */
export const MercatoWin: Story = {
  args: {
    moment: {
      ...base,
      key: "mercato_win:1:u1",
      kind: "mercato_win",
      round: 1,
      price: 40,
      athletes: [
        { name: "Athlète Inventée", price: 22 },
        { name: "Coureuse Imaginaire", price: 12 },
        { name: "Sauteur Fictif", price: 5 },
        { name: "Lanceuse Rêvée", price: 1 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.label.mercato_win)).toBeVisible();
    await expect(canvas.getByText(text.text.mercato_win("Flèche du Nord", 4, 1, 40))).toBeVisible();
    // Folded: the names show once the card is opened.
    await expect(canvas.getByText("Athlète Inventée")).not.toBeVisible();
    await userEvent.click(canvas.getByText(text.athletes));
    await expect(canvas.getByText("Athlète Inventée")).toBeVisible();
    await expect(canvas.getByText(text.credits(1))).toBeVisible();
  },
};

/** A very long athlete name wraps inside the opened card. */
export const MercatoLongName: Story = {
  args: {
    moment: {
      ...base,
      key: "mercato_win:2:u1",
      kind: "mercato_win",
      round: 2,
      price: 120,
      athletes: [
        { name: "Marie-Charlotte Bernadette Inventée de la Fontaine-Imaginaire", price: 120 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText(text.athletes));
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
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

/** The final podium of a league, told once (#1134): the three medals, then the gold statuette. */
export const TrophyPodium: Story = {
  args: {
    moment: {
      ...base,
      key: "trophy:2026:league:L",
      kind: "trophy",
      trophy: {
        kind: "league",
        animal: "guepard",
        podium: [
          { pseudo: "Flèche du Nord", metal: "gold" },
          { pseudo: "Gazelle", metal: "silver" },
          { pseudo: "Le Lièvre", metal: "bronze" },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.label.trophy)).toBeVisible();
    await expect(canvas.getByText(/Flèche du Nord 🥇 Gazelle 🥈 Le Lièvre 🥉/)).toBeVisible();
    await expect(canvas.getByText(/décroche le Guépard d'or/)).toBeVisible();
  },
};

/** The best evening of the league (#1134), with its points. */
export const TrophyChrono: Story = {
  args: {
    moment: {
      ...base,
      key: "trophy:2026:chrono:L:u1",
      kind: "trophy",
      trophy: { kind: "chrono", points: 84 },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/84 points en une soirée/)).toBeVisible();
    await expect(within(canvasElement).getByText(text.trophyEmoji.chrono)).toBeInTheDocument();
  },
};

/** A Record de ligue, and a podium of long pseudos: nothing overflows on a phone. */
export const TrophyLongText: Story = {
  args: {
    moment: {
      ...base,
      key: "trophy:2026:league:L",
      kind: "trophy",
      pseudo: "Supercalifragilistique du demi-fond",
      trophy: {
        kind: "league",
        animal: "kangourou",
        podium: [
          { pseudo: "Supercalifragilistique du demi-fond", metal: "gold" },
          { pseudo: "Gazelle des Plateaux", metal: "silver" },
          { pseudo: "Gazelle des Plateaux 2", metal: "silver" },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
