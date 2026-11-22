import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { PREDICTION_JOKERS } from "@/domain/league-jokers";

import { EventLeagueJokers, MyJokers, type EventLeagueJokersView } from "./league-jokers";

const text = messages.leagueJokers;
const all = [...PREDICTION_JOKERS];

const meta = {
  title: "Leagues/LeagueJokers",
  component: MyJokers,
  args: { remaining: all, used: [] },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MyJokers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No joker played yet: the five to play, each with what it does. */
export const NonePlayed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noneUsed)).toBeVisible();
    for (const joker of all) await expect(canvas.getByText(text.explain[joker])).toBeVisible();
  },
};

/** Every joker played, one on an event no longer listed; a long event name (dark theme). */
export const AllPlayedDark: Story = {
  args: {
    remaining: [],
    used: [
      {
        joker: "double",
        event: { name: "3000 m steeple-chase hommes, finale olympique", href: "/epreuves/x" },
      },
      { joker: "spy", event: { name: "100 m femmes", href: "/epreuves/y" } },
      { joker: "outsider", event: null },
    ],
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noneLeft)).toBeVisible();
    await expect(canvas.getByRole("link", { name: /steeple-chase/ })).toHaveAttribute(
      "href",
      "/epreuves/x",
    );
  },
};

const league = (over: Partial<EventLeagueJokersView> = {}): EventLeagueJokersView => ({
  leagueId: "l1",
  name: "Les Gazelles du jeudi soir, ligue au nom vraiment très long",
  counted: true,
  hand: { remaining: all, used: [], onEvent: null, canChange: true },
  ...over,
});

/** On the page of an event: the joker chosen says what it does; a refusal is said in place. */
export const OnTheEventRefused: StoryObj<typeof EventLeagueJokers> = {
  render: (args) => <EventLeagueJokers {...args} />,
  args: {
    leagues: [league({ counted: false })],
    play: async () => ({ error: "JOKER_NOT_IN_LEAGUE" }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByRole("combobox"), "double");
    await expect(canvas.getByText(text.addFirst)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.play }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      messages.errors.JOKER_NOT_IN_LEAGUE,
    );
  },
};

/** The spy played: it stays, and the trend of the league shows; none yet in another league. */
export const SpyPlayed: StoryObj<typeof EventLeagueJokers> = {
  render: (args) => <EventLeagueJokers {...args} />,
  args: {
    leagues: [
      league({
        hand: {
          remaining: ["double", "all_or_nothing", "safety_net", "outsider"],
          used: [{ joker: "spy", eventId: "e1" }],
          onEvent: "spy",
          canChange: false,
        },
        spy: {
          total: 4,
          places: [
            { name: "Démo Gazelle", percent: 75 },
            { name: "Démo Foulée", percent: 50 },
            { name: text.other, percent: 25 },
          ],
        },
      }),
      league({
        leagueId: "l2",
        name: "Club",
        hand: {
          remaining: [],
          used: [{ joker: "spy", eventId: "e1" }],
          onEvent: "spy",
          canChange: false,
        },
        spy: { total: 0, places: [] },
      }),
    ],
    play: async () => ({}),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(`🃏 ${text.spySpent}`)).toHaveLength(2);
    await expect(canvas.getByText("75 %")).toBeVisible();
    await expect(canvas.getByText(text.spyEmpty)).toBeVisible();
  },
};

/** Nothing to show: no league of the event has jokers. */
export const NoLeague: StoryObj<typeof EventLeagueJokers> = {
  render: (args) => <EventLeagueJokers {...args} />,
  args: { leagues: [], play: async () => ({}) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("region")).toBeNull();
  },
};
