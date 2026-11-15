import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { NOW, poll, votedPoll } from "./fixtures";
import { PollCard, type VoteState } from "./poll-card";

const text = messages.community.poll;

const meta = {
  title: "Community/PollCard",
  component: PollCard,
  args: {
    poll,
    now: NOW,
    vote: fn(async (): Promise<VoteState> => ({ poll: votedPoll })),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PollCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the vote: the answers, no result; one tap votes, then the results show at once. */
export const BeforeVote: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.choose)).toBeVisible();
    await expect(canvas.queryByText(text.percent(60))).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Bravo" }));
    await waitFor(() => expect(args.vote).toHaveBeenCalled());
    await expect(await canvas.findByRole("status")).toHaveTextContent(text.voted);
    await expect(canvas.getByLabelText(text.result("Bravo", 60, true))).toBeVisible();
  },
};

/** After the vote: each answer's share, the player's own marked, the number of votes. */
export const AfterVote: Story = {
  args: { poll: votedPoll },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.getByText(text.myVote)).toBeVisible();
    await expect(canvas.getByText(text.votes(10))).toBeVisible();
  },
};

/** Closed without a vote: the results for all, no button. */
export const Closed: Story = {
  args: {
    poll: { ...poll, closesAt: "2026-11-14T19:00:00.000Z", votes: [3, 6, 1] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.closed)).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** Answers the vote of « Voting » once its play has looked at the waiting state. */
let answerVote: (state: VoteState) => void = () => {};

/** While the vote is sent: the pressed answer says so, the others are disabled. */
export const Voting: Story = {
  args: {
    vote: fn(() => new Promise<VoteState>((resolve) => (answerVote = resolve))),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Charlie" }));
    await expect(await canvas.findByRole("button", { name: text.voting })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Alpha" })).toBeDisabled();
    // React waits for every pending action: this one must end before the next story votes.
    answerVote({ poll: votedPoll });
    await expect(await canvas.findByRole("status")).toHaveTextContent(text.voted);
  },
};

/** The vote is refused: the reason, where the player is. */
export const Error: Story = {
  args: { vote: fn(async (): Promise<VoteState> => ({ error: "POLL_CLOSED" })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Alpha" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(messages.errors.POLL_CLOSED);
  },
};

/** The longest question and answers wrap at 390 px. */
export const LongText: Story = {
  args: {
    poll: {
      ...votedPoll,
      question: "Qui ".repeat(30).trim(),
      options: ["A".repeat(40), "B".repeat(40), "C".repeat(40), "D".repeat(40)],
      votes: [1, 1, 1, 1],
      myChoice: 3,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
