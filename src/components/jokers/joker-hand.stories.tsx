import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { PREDICTION_JOKERS } from "@/domain/league-jokers";

import { JokerHand, type HandCard } from "./joker-hand";

const text = messages.jokerHand;
const jokers = messages.leagueJokers;
const played = { emoji: "✓", label: text.played };
const cards: HandCard[] = PREDICTION_JOKERS.map((id) => ({
  id,
  emoji: jokers.emoji[id],
  name: jokers.name[id],
}));

/** A hand that puts its cards down and takes them back, as the pages do once the server agrees. */
function Playable(props: { cards: HandCard[]; placed?: string | null }) {
  const [placed, setPlaced] = useState(props.placed ?? null);
  return (
    <JokerHand
      cards={props.cards}
      placed={placed}
      onPlace={setPlaced}
      explain={placed ? jokers.explain[placed as keyof typeof jokers.explain] : null}
    />
  );
}

const meta = {
  title: "Jokers/JokerHand",
  component: JokerHand,
  args: { cards, placed: null, onPlace: () => {} },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JokerHand>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five free cards: touch one to put it down, touch it again to take it back. */
export const Empty: Story = {
  render: (args) => <Playable cards={args.cards} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.count(5))).toBeVisible();
    await expect(canvas.getByText(text.hint)).toBeVisible();
    const double = canvas.getByRole("button", { name: /Double/ });
    await userEvent.click(double);
    await expect(double).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByText(text.placed("Double"))).toBeVisible();
    await expect(canvas.getByText(text.count(4))).toBeVisible();
    await userEvent.click(double);
    await expect(double).toHaveAttribute("aria-pressed", "false");
    await expect(canvas.getByText(text.hint)).toBeVisible();
  },
};

/** A card down, lifted and tilted, with what it does (dark theme). */
export const PlacedDark: Story = {
  render: (args) => <Playable cards={args.cards} placed="all_or_nothing" />,
  decorators: [
    (Story) => (
      <div className="dark bg-background">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Tout ou rien/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.getByText(jokers.explain.all_or_nothing)).toBeVisible();
    // Another card replaces it.
    await userEvent.click(canvas.getByRole("button", { name: /Filet/ }));
    await expect(canvas.getByText(text.placed("Filet"))).toBeVisible();
  },
};

/** Every card played: hatched and disabled, no card left. */
export const AllPlayed: Story = {
  args: { cards: cards.map((c) => ({ ...c, off: played })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.count(0))).toBeVisible();
    for (const button of canvas.getAllByRole("button")) await expect(button).toBeDisabled();
  },
};

/** A choice being sent: every card waits. */
export const Sending: Story = {
  args: { placed: "double", pending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(text.sending);
    for (const button of canvas.getAllByRole("button")) await expect(button).toBeDisabled();
  },
};

/** The server refused: the error shows under the hand. */
export const Refused: Story = {
  args: { error: "JOKER_NOT_IN_LEAGUE" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(messages.errors.JOKER_NOT_IN_LEAGUE);
  },
};

/** Long names at 320 px: they wrap inside their card; a card away from home is hatched. */
export const LongNames: Story = {
  args: {
    cards: [
      ...(["captain", "false_start", "extended_bench", "coaching"] as const).map((id) => ({
        id,
        emoji: messages.managerJokers.emoji[id],
        name: messages.managerJokers.name[id],
      })),
      {
        id: "home_advantage",
        emoji: messages.managerJokers.emoji.home_advantage,
        name: messages.managerJokers.name.home_advantage,
        off: messages.managerJokers.away,
      },
    ],
    placed: "extended_bench",
    explain: messages.managerJokers.explain.extended_bench,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[320px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Avantage terrain/ })).toBeDisabled();
    await expect(canvas.getByText(messages.managerJokers.away.label)).toBeVisible();
  },
};
