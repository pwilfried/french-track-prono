import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { BadgeCelebration } from "./badge-celebration";

const meta = {
  title: "Profile/BadgeCelebration",
  component: BadgeCelebration,
  args: {
    raised: [{ badge: "chasseur", level: "silver" }],
    onSeen: fn(async () => {}),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BadgeCelebration>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A level won: the hare says it once, the level is stored as seen, and the card closes. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Chasseur : Argent");
    await expect(args.onSeen).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole("button", { name: "Super !" }));
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

/** Nothing new: no card, nothing stored. */
export const Empty: Story = {
  args: { raised: [] },
  play: async ({ args, canvasElement }) => {
    await expect(within(canvasElement).queryByRole("status")).not.toBeInTheDocument();
    await expect(args.onSeen).not.toHaveBeenCalled();
  },
};

/** Several levels at once, long names included. */
export const LongText: Story = {
  args: {
    raised: [
      { badge: "nostradamus", level: "bronze" },
      { badge: "force", level: "gold" },
      { badge: "train", level: "silver" },
      { badge: "touche", level: "bronze" },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(4);
  },
};
