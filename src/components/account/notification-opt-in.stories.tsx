import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { NotificationToggle } from "./notification-opt-in";

const text = messages.notifications;

const meta = {
  title: "Account/NotificationToggle",
  component: NotificationToggle,
  args: { state: "off", onTurnOn: fn(), onTurnOff: fn() },
} satisfies Meta<typeof NotificationToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: text.turnOn }));
    await expect(args.onTurnOn).toHaveBeenCalled();
  },
};

export const On: Story = {
  args: { state: "on" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(text.on);
    await userEvent.click(canvas.getByRole("button", { name: text.turnOff }));
    await expect(args.onTurnOff).toHaveBeenCalled();
  },
};

export const Denied: Story = {
  args: { state: "denied" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(text.denied);
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const Unsupported: Story = {
  args: { state: "unsupported" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(text.unsupported);
  },
};
