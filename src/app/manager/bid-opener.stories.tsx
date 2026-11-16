import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { BidOpener } from "./bid-opener";

const meta = {
  title: "Manager/BidOpener",
  component: BidOpener,
  args: { name: "Léa Martin", current: null, onOpen: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-[180px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BidOpener>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoBid: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Enchérir sur Léa Martin" });
    await expect(button).toHaveTextContent("Enchérir");
    await userEvent.click(button);
    await expect(args.onOpen).toHaveBeenCalledOnce();
  },
};

export const WithBid: Story = {
  args: { current: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Mon offre : 12 cr.")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Modifier mon offre sur Léa Martin" }),
    ).toHaveTextContent("Modifier");
  },
};

export const LongName: Story = {
  args: { name: "Marie-Charlotte de La Tour-Dupont-Vasseur" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", {
        name: "Enchérir sur Marie-Charlotte de La Tour-Dupont-Vasseur",
      }),
    ).toBeVisible();
  },
};
