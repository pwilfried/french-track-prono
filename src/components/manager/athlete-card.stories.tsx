import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { AthleteCard } from "./athlete-card";

const text = messages.team;

const meta = {
  title: "Manager/AthleteCard",
  component: AthleteCard,
  args: {
    athlete: { name: "Léa Fictive", discipline: "100 m haies", family: "hurdles", sex: "F" },
    paid: 18,
  },
  decorators: [
    (Story) => (
      <div className="w-36 bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AthleteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Family code, price paid, initials, first name and initial, event. */
export const Normal: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", {
      name: text.cardLabel("Léa Fictive", "100 m haies", 18),
    });
    await expect(card).toHaveTextContent("SPR");
    await expect(card).toHaveTextContent("18 cr.");
    await expect(card).toHaveTextContent("LF");
    await expect(card).toHaveTextContent("Léa F.");
    await expect(card).toHaveTextContent("100 m haies F");
    await expect(card).not.toHaveTextContent(text.selected);
    await expect(card).not.toHaveTextContent(text.absent);
  },
};

/** In the lineup (#427): picked for the next competition. */
export const Selected: Story = {
  args: { state: "selected" },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article");
    await expect(within(card).getByText(text.selected)).toBeVisible();
  },
};

/** In the lineup (#427): not entered in the competition. */
export const Absent: Story = {
  args: { state: "absent" },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article");
    await expect(within(card).getByText(text.absent)).toBeVisible();
  },
};

/** A long name and a long event still fit: the card shows the first name and an initial. */
export const LongName: Story = {
  args: {
    athlete: {
      name: "Marie-Charlotte Démonstration-Fictive de la Grande Piste",
      discipline: "3000 m steeple",
      family: "middle",
      sex: "F",
    },
    paid: 120,
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article");
    await expect(card).toHaveTextContent("DEM");
    await expect(card).toHaveTextContent("Marie-Charlotte P.");
    await expect(card).toHaveTextContent("MP");
    await expect(card).toHaveTextContent("120 cr.");
  },
};

/** Each family has its code; on the night background of the dark theme. */
export const Families: Story = {
  render: () => (
    <div className="grid w-[22rem] grid-cols-3 gap-3 rounded-2xl bg-nuit p-4">
      {(
        [
          ["Léa Fictive", "100 m", "sprint"],
          ["Inès Démo", "800 m", "middle"],
          ["Hugo Fictif", "10 000 m", "long"],
          ["Noé Démo", "Perche", "vertical_jumps"],
          ["Sam Fictif", "Disque", "throws"],
          ["Alex Démo", "Décathlon", "combined"],
        ] as const
      ).map(([name, discipline, family]) => (
        <AthleteCard key={name} athlete={{ name, discipline, family, sex: "M" }} paid={10} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cards = within(canvasElement).getAllByRole("article");
    await expect(cards.map((c) => c.textContent?.slice(0, 3))).toEqual([
      "SPR",
      "DEM",
      "FON",
      "SAU",
      "LAN",
      "COM",
    ]);
  },
};

/** In a head-to-head (#605): the athlete's points at the bottom, no price. */
export const WithPoints: Story = {
  args: { score: { points: 1032, bonus: 0 } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", {
      name: text.scoredCardLabel("Léa Fictive", "100 m haies", 1032, 0),
    });
    await expect(card).toHaveTextContent("1032 pts");
    await expect(card).not.toHaveTextContent("cr.");
  },
};

/** Sporting bonuses earned: « +20 » top right, within the points. */
export const WithBonus: Story = {
  args: { score: { points: 1120, bonus: 20 } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article", {
      name: text.scoredCardLabel("Léa Fictive", "100 m haies", 1120, 20),
    });
    await expect(card).toHaveTextContent("+20");
    await expect(card).toHaveTextContent("1120 pts");
  },
};

/** An athlete at 0 (no start, no mark): a dashed red frame. */
export const AtZero: Story = {
  args: { score: { points: 0, bonus: 0 } },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("article");
    await expect(card).toHaveTextContent("0 pt");
    await expect(card.firstElementChild).toHaveClass("outline-dashed");
  },
};

/** The opponent's cards are light blue; on the night background of the dark theme. */
export const OpponentDark: Story = {
  render: () => (
    <div className="grid w-[22rem] grid-cols-3 gap-3 rounded-2xl bg-nuit p-4">
      <AthleteCard
        athlete={{ name: "Inès Démo", discipline: "800 m", family: "middle", sex: "F" }}
        score={{ points: 980, bonus: 20 }}
        tone="blue"
      />
      <AthleteCard
        athlete={{ name: "Hugo Fictif", discipline: "Disque", family: "throws", sex: "M" }}
        score={{ points: 0, bonus: 0 }}
        tone="blue"
      />
      <AthleteCard
        athlete={{ name: "Léa Fictive", discipline: "100 m", family: "sprint", sex: "F" }}
        score={{ points: null, bonus: 0 }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cards = within(canvasElement).getAllByRole("article");
    await expect(cards[0]).toHaveTextContent("+20");
    await expect(cards[2]).toHaveTextContent("–");
  },
};
