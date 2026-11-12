import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { PasteCodeButton } from "./paste-code-button";

const text = messages.signIn;

const meta = {
  title: "Account/PasteCodeButton",
  component: PasteCodeButton,
  args: { onCode: fn() },
} satisfies Meta<typeof PasteCodeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: { readClipboard: async () => "Ton code : 123 456" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.pasteCode }));
    await expect(args.onCode).toHaveBeenCalledWith("123456");
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};

export const Refused: Story = {
  args: { readClipboard: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.pasteCode }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(text.noCodeToPaste);
    await expect(args.onCode).not.toHaveBeenCalled();
  },
};

export const NoCode: Story = {
  args: { readClipboard: async () => "une liste de courses" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.pasteCode }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(text.noCodeToPaste);
    await expect(args.onCode).not.toHaveBeenCalled();
  },
};
