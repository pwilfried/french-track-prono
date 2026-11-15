import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { NO_REACTIONS, type MomentReactions as Reactions } from "@/domain/moment-reactions";

import { MomentReactions, PresetMessageSheet } from "./moment-reactions";

const text = messages.leagues.feed.reactions;

const reacted: Reactions = {
  emojis: [
    { code: "fire", count: 3, mine: true },
    { code: "clap", count: 1, mine: false },
    { code: "wow", count: 0, mine: false },
    { code: "laugh", count: 12, mine: false },
  ],
  messages: [
    {
      id: "m1",
      code: "well_played",
      pseudo: "Gazelle",
      bib: { number: 7, color: "red" },
      mine: false,
      reported: false,
    },
    {
      id: "m2",
      code: "rematch",
      pseudo: "Flèche",
      bib: { number: 23, color: "blue" },
      mine: true,
      reported: false,
    },
  ],
  myMessage: "rematch",
};

const done = () => fn(async () => ({}));

const meta = {
  title: "Leagues/MomentReactions",
  component: MomentReactions,
  args: {
    leagueId: "l1",
    momentKey: "perfect_podium:e1:u1",
    reactions: NO_REACTIONS,
    actions: { react: done(), send: done(), report: done() },
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MomentReactions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nobody reacted yet: the four emojis, no count, and « Message ». */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: text.group });
    await expect(within(group).getAllByRole("button")).toHaveLength(5);
    await userEvent.click(canvas.getByRole("button", { name: text.label("feu", 0, false) }));
    await expect(args.actions.react).toHaveBeenCalledWith(
      "l1",
      "perfect_podium:e1:u1",
      "fire",
      true,
    );
    await expect(canvas.queryByRole("list", { name: text.list })).toBeNull();
  },
};

/** Counts, my reaction pressed (tap again removes it), and the messages with « Signaler ». */
export const WithReactions: Story = {
  args: { reactions: reacted },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const mine = canvas.getByRole("button", { name: text.label("feu", 3, true) });
    await expect(mine).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(mine);
    await expect(args.actions.react).toHaveBeenCalledWith(
      "l1",
      "perfect_podium:e1:u1",
      "fire",
      false,
    );
    const list = canvas.getByRole("list", { name: text.list });
    await expect(list).toHaveTextContent(`Gazelle · ${text.messages.well_played}`);
    // My own message cannot be reported; the others' can.
    await expect(canvas.queryByRole("button", { name: text.reportLabel("Flèche") })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: text.reportLabel("Gazelle") }));
    await expect(args.actions.report).toHaveBeenCalledWith("l1", "m1");
  },
};

/** While a reaction is sent: every button waits, « Envoi en cours… » shows. */
let release = () => {};
export const Loading: Story = {
  args: {
    actions: {
      react: fn(
        () =>
          new Promise<{ error?: never }>((resolve) => {
            release = () => resolve({});
          }),
      ),
      send: done(),
      report: done(),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.label("bravo", 0, false) }));
    await expect(await canvas.findByText(text.pending)).toBeVisible();
    for (const button of within(canvas.getByRole("group")).getAllByRole("button"))
      await expect(button).toBeDisabled();
    // React waits for every pending action: this one ends here, not to hold the next stories.
    release();
    await waitFor(() => expect(canvas.queryByText(text.pending)).toBeNull());
  },
};

/** Refused (not a member any more): the error shows under the bar. */
export const Error: Story = {
  args: {
    actions: {
      react: fn(async () => ({ error: "MOMENT_REACTION_REFUSED" as const })),
      send: done(),
      report: done(),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.label("surpris", 0, false) }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      messages.errors.MOMENT_REACTION_REFUSED,
    );
  },
};

/** Long pseudos and big counts still fit at 320 px. */
export const LongText: Story = {
  args: {
    reactions: {
      ...reacted,
      messages: [
        {
          id: "m3",
          code: "catching_up",
          pseudo: "Supersonique-des-Pyrénées-Orientales",
          bib: { number: 999, color: "gold" },
          mine: false,
          reported: true,
        },
      ],
    },
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
    await expect(canvas.getByText(text.reported)).toBeVisible();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};

/** « Message » opens the sheet; one tap sends it and closes the sheet. */
export const SendMessage: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.messageLabel }));
    const sheet = within(canvasElement.ownerDocument.body).getByRole("dialog", {
      name: text.sheetTitle,
    });
    await userEvent.click(within(sheet).getByRole("button", { name: text.messages.well_played }));
    await expect(args.actions.send).toHaveBeenCalledWith(
      "l1",
      "perfect_podium:e1:u1",
      "well_played",
    );
    await waitFor(() => expect(canvas.getByText(text.sent)).toBeVisible());
  },
};

/** The sheet of preset messages on its own, my current one marked. */
export const Sheet: StoryObj<typeof PresetMessageSheet> = {
  render: (args) => <PresetMessageSheet {...args} />,
  args: { open: true, onClose: fn(), current: "rematch", pending: false, onSend: fn() },
  play: async ({ canvasElement, args }) => {
    const sheet = within(canvasElement.ownerDocument.body).getByRole("dialog", {
      name: text.sheetTitle,
    });
    await expect(within(sheet).getAllByRole("button", { pressed: false })).toHaveLength(4);
    await expect(within(sheet).getByRole("button", { name: /^Revanche/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(sheet).getByRole("button", { name: text.messages.bad_luck }));
    await expect(args.onSend).toHaveBeenCalledWith("bad_luck");
  },
};
