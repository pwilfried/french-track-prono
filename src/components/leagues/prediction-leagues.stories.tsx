import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import type { PredictionLeague } from "@/application/prediction-leagues";
import { PREDICTION_JOKERS, type JokerHand } from "@/domain/league-jokers";

import {
  PredictionLeaguesBlock,
  PredictionLeaguesSheet,
  type LeagueJokersView,
} from "./prediction-leagues";

const text = messages.predictionLeagues;
const lockLabel = "samedi 12 septembre à 18:40";
const league = (id: string, name: string, over: Partial<PredictionLeague> = {}) => ({
  id,
  name,
  kind: "private" as const,
  memberCount: 8,
  rank: 3,
  counted: false,
  ...over,
});
const amis = league("l1", "Les copains du stade");
const club = league("l2", "Club d'athlé", { kind: "public", memberCount: 24, rank: null });
const longName = league(
  "l3",
  "La ligue des amis du mercredi soir au stade municipal de la ville d'à côté",
  { kind: "official", memberCount: 1520, rank: 104 },
);

const body = () => within(document.body);
const jokerText = messages.leagueJokers;
const hand = (over: Partial<JokerHand> = {}): JokerHand => ({
  remaining: [...PREDICTION_JOKERS],
  used: [],
  onEvent: null,
  canChange: true,
  ...over,
});
const withJokers = (views: Record<string, LeagueJokersView>) => views;

const meta = {
  title: "Leagues/PredictionLeaguesBlock",
  component: PredictionLeaguesBlock,
  args: { leagues: [amis, club], locked: false, lockLabel, save: fn(async () => ({})) },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background py-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PredictionLeaguesBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the lock, nothing on: the general ranking always, one switch per league. */
export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: text.jokersTitle })).toBeVisible();
    await expect(canvas.getByText(text.noJoker)).toBeVisible();
    await expect(canvas.getByText(text.jokersText)).toBeVisible();
    await expect(canvas.getByText(text.openFoot(lockLabel))).toBeVisible();
    const toggle = canvas.getByRole("switch", { name: text.switchLabel(amis.name) });
    await expect(toggle).not.toBeChecked();
    await userEvent.click(canvas.getByText(amis.name));
    await expect(toggle).toBeChecked();
    await expect(args.save).toHaveBeenCalledWith([amis.id]);
    await expect(canvas.getByText(club.name).closest("label")!.offsetHeight).toBeGreaterThanOrEqual(
      44,
    );
  },
};

/** A refused save: the switch goes back and the reason shows. */
export const SaveRefused: Story = {
  args: { save: fn(async () => ({ error: "PREDICTION_LOCKED" as const })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("switch", { name: text.switchLabel(club.name) });
    await userEvent.click(canvas.getByText(club.name));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      messages.errors.PREDICTION_LOCKED,
    );
    await expect(toggle).not.toBeChecked();
  },
};

/** A league switched off shows no card; once on, its hand of jokers: put one down, take it back. */
export const JokersOffThenOn: Story = {
  args: {
    jokers: withJokers({ l1: { hand: hand() } }),
    play: fn(async () => ({})),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /Double/ })).toBeNull();
    await expect(canvas.getByText(text.off)).toBeVisible();
    await userEvent.click(canvas.getByText(amis.name));
    const double = await canvas.findByRole("button", { name: /Double/ });
    await userEvent.click(double);
    await expect(args.play).toHaveBeenCalledWith(amis.id, "double");
    await expect(double).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(double);
    await expect(args.play).toHaveBeenLastCalledWith(amis.id, null);
    await expect(double).toHaveAttribute("aria-pressed", "false");
  },
};

/** Switching off a league with a card down asks first; taking it back switches the league off. */
export const SwitchOffAsks: Story = {
  args: {
    leagues: [{ ...amis, counted: true }],
    jokers: withJokers({
      l1: {
        hand: hand({
          remaining: PREDICTION_JOKERS.filter((j) => j !== "double"),
          used: [{ joker: "double", eventId: "e1" }],
          onEvent: "double",
        }),
      },
    }),
    play: fn(async () => ({})),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // The card on this event is in the hand, put down, even though it is no longer « remaining ».
    await expect(canvas.getByRole("button", { name: /Double/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const toggle = canvas.getByRole("switch", { name: text.switchLabel(amis.name) });
    await userEvent.click(canvas.getByText(amis.name));
    await expect(canvas.getByText(text.offConfirm("🔥", "Double"))).toBeVisible();
    await expect(toggle).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: text.keep }));
    await expect(toggle).toBeChecked();
    await expect(args.save).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByText(amis.name));
    await userEvent.click(canvas.getByRole("button", { name: text.takeBack }));
    await expect(args.play).toHaveBeenCalledWith(amis.id, null);
    await expect(args.save).toHaveBeenCalledWith([]);
    await expect(toggle).not.toBeChecked();
  },
};

/** The spy asks before it goes out; once played it stays and the trend shows (dark theme). */
export const SpyDark: Story = {
  args: {
    leagues: [
      { ...amis, counted: true },
      { ...club, counted: true, rank: 1 },
    ],
    jokers: withJokers({
      l1: { hand: hand() },
      l2: {
        hand: hand({
          remaining: PREDICTION_JOKERS.filter((j) => j !== "spy"),
          used: [{ joker: "spy", eventId: "e1" }],
          onEvent: "spy",
          canChange: false,
        }),
        spy: {
          total: 4,
          places: [
            { name: "Démo Gazelle", percent: 75 },
            { name: "Démo Foulée", percent: 50 },
            { name: jokerText.other, percent: 25 },
          ],
        },
      },
    }),
    play: fn(async () => ({})),
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background">
        <Story />
      </div>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(jokerText.spySpent)).toBeVisible();
    await expect(canvas.getByText("75 %")).toBeVisible();
    await expect(canvas.getByText(text.rankLine(24, 1))).toBeVisible();
    const [spy] = canvas.getAllByRole("button", { name: /Espion/ });
    await userEvent.click(spy!);
    await expect(canvas.getByText(jokerText.spyAsk)).toBeVisible();
    await expect(args.play).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: jokerText.spyGo }));
    await expect(args.play).toHaveBeenCalledWith(amis.id, "spy");
  },
};

/** A refused card: the reason shows under the hand, nothing is put down. */
export const JokerRefused: Story = {
  args: {
    leagues: [{ ...amis, counted: true }],
    jokers: withJokers({ l1: { hand: hand() } }),
    play: fn(async () => ({ error: "JOKER_NOT_IN_LEAGUE" as const })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const double = canvas.getByRole("button", { name: /Double/ });
    await userEvent.click(double);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      messages.errors.JOKER_NOT_IN_LEAGUE,
    );
    await expect(double).toHaveAttribute("aria-pressed", "false");
  },
};

/** After the lock: no switch, « Compte » or « Ne compte pas » per league. */
export const Locked: Story = {
  args: { locked: true, leagues: [{ ...amis, counted: true }, club], save: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("switch")).toBeNull();
    await expect(canvas.getByText(text.lockedText(1))).toBeVisible();
    await expect(canvas.getByText(text.counts)).toBeVisible();
    await expect(canvas.getByText(text.notCounted)).toBeVisible();
    await expect(canvas.getByText(text.lockedFoot)).toBeVisible();
  },
};

/** Locked without any league chosen: the general ranking only. */
export const LockedGeneralOnly: Story = {
  args: { locked: true, save: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.lockedText(0))).toBeVisible();
  },
};

/** A long name wraps inside 390 px, the switch stays in view. */
export const LongText: Story = {
  args: { leagues: [longName, amis] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: text.jokersTitle });
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
    await expect(canvas.getByText(text.rankLine(1520, 104))).toBeVisible();
  },
};

/** The sheet after a save: nothing ticked, the button asks for one league, then confirms. */
export const Sheet: Story = {
  render: (args) => (
    <PredictionLeaguesSheet
      open
      onClose={fn()}
      leagues={args.leagues}
      lockLabel={args.lockLabel}
      save={args.save!}
    />
  ),
  play: async ({ args }) => {
    const sheet = within(body().getByRole("dialog", { name: text.sheetTitle }));
    await expect(sheet.getByText(text.general)).toBeVisible();
    await expect(sheet.getByRole("checkbox", { name: new RegExp(amis.name) })).not.toBeChecked();
    await expect(sheet.getByRole("button", { name: text.pickOne })).toBeDisabled();
    await userEvent.click(sheet.getByText(amis.name));
    await userEvent.click(sheet.getByRole("button", { name: text.add(1) }));
    await expect(args.save).toHaveBeenCalledWith([amis.id]);
    await expect(await sheet.findByRole("status")).toHaveTextContent(text.done([amis.name]));
    await expect(sheet.getByRole("button", { name: text.seeMine })).toBeVisible();
  },
};

/** The sheet when the save is refused: the reason shows, the choice stays. */
export const SheetError: Story = {
  ...Sheet,
  args: { save: fn(async () => ({ error: "PREDICTION_LOCKED" as const })) },
  play: async () => {
    const sheet = within(body().getByRole("dialog", { name: text.sheetTitle }));
    await userEvent.click(sheet.getByText(club.name));
    await userEvent.click(sheet.getByRole("button", { name: text.add(1) }));
    await expect(await sheet.findByRole("alert")).toHaveTextContent(
      messages.errors.PREDICTION_LOCKED,
    );
    await expect(sheet.getByRole("checkbox", { name: new RegExp(club.name) })).toBeChecked();
  },
};
