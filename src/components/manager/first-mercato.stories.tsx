import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { FirstMercatoCards } from "./first-mercato";

const text = messages.catalogue.firstMercato;
const rules = { budget: 120, perFamily: 2, starters: 8, bench: 4 };

const meta = {
  title: "Manager/FirstMercato",
  component: FirstMercatoCards,
  args: { rules, onClose: fn() },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FirstMercatoCards>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first card: the budget, « Premier mercato · 1 sur 4 », nothing before it. */
export const Budget: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.progress(1, 4))).toBeVisible();
    await expect(canvas.getByText(/120 crédits/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.previous })).toBeDisabled();
  },
};

/** Four cards; the last one ends the guide. */
export const ToTheEnd: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(canvas.getByRole("button", { name: text.next }));
    }
    await expect(canvas.getByText(text.progress(4, 4))).toBeVisible();
    await expect(canvas.getByText(/8 titulaires et 4 remplaçants/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.done }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

/** « Passer » from any card closes it. */
export const Skip: Story = {
  args: { initialStep: 2 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Couvre toutes les familles" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.skipLabel }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};
