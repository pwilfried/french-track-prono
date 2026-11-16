import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { ReactionBar } from "./reaction-bar";

const text = messages.reactions;

const meta = {
  title: "Reveal/ReactionBar",
  component: ReactionBar,
  args: {
    slug: "100m-hommes",
    predictionId: "p1",
    pseudo: "Gazelle",
    counts: {},
    mine: null,
    react: fn(async () => ({})),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReactionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nobody reacted yet: the group names whose podium it is, then six emoji without a count. */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "Réagir au prono de Gazelle" });
    await expect(within(group).getAllByRole("button")).toHaveLength(6);
    await userEvent.click(within(group).getByRole("button", { name: text.label("feu", 0) }));
    await waitFor(() => expect(args.react).toHaveBeenCalled());
  },
};

/** Counts, and my reaction pressed. */
export const WithReactions: Story = {
  args: { counts: { "🔥": 3, "👏": 1 }, mine: "🔥" },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole("group", {
      name: "Réagir au prono de Gazelle",
    });
    const fire = within(group).getByRole("button", { name: text.label("feu", 3) });
    await expect(fire).toHaveAttribute("aria-pressed", "true");
    await expect(
      within(group).getByRole("button", { name: text.label("bravo", 1) }),
    ).toHaveAttribute("aria-pressed", "false");
  },
};

/** The reaction failed: the error shows under the emoji. */
export const Error: Story = {
  args: { react: fn(async () => ({ error: "REACTION_NOT_ALLOWED" as const })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.label("bravo", 0) }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      messages.errors.REACTION_NOT_ALLOWED,
    );
  },
};

/** A long pseudo still names the group. */
export const LongText: Story = {
  args: { pseudo: "Supercalifragilistique-du-400-mètres-haies" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("group", {
        name: "Réagir au prono de Supercalifragilistique-du-400-mètres-haies",
      }),
    ).toBeVisible();
  },
};
