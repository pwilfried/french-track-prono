import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { Captcha, type Turnstile } from "./captcha";

/** A stand-in for Cloudflare Turnstile: it fails on render, then passes after a reset. */
function fakeTurnstile(): Turnstile & { renders: Record<string, unknown>[]; resets: number } {
  const fake = {
    renders: [] as Record<string, unknown>[],
    resets: 0,
    render(_element: HTMLElement, options: Record<string, unknown>) {
      fake.renders.push(options);
      queueMicrotask(() => (options["error-callback"] as (code: string) => boolean)("110200"));
      return "widget-1";
    },
    reset() {
      fake.resets += 1;
      const options = fake.renders.at(-1)!;
      queueMicrotask(() => (options.callback as (token: string) => void)("token"));
    },
    remove() {},
  };
  return fake;
}

const meta = {
  title: "Account/Captcha",
  component: Captcha,
  args: { siteKey: "test-site-key" },
} satisfies Meta<typeof Captcha>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ErrorThenRetry: Story = {
  beforeEach: () => {
    const fake = fakeTurnstile();
    window.turnstile = fake;
    return () => {
      delete window.turnstile;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fake = window.turnstile as ReturnType<typeof fakeTurnstile>;
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      messages.errors.CAPTCHA_UNAVAILABLE,
    );
    await expect(fake.renders[0]).toMatchObject({ retry: "never" });

    await userEvent.click(canvas.getByRole("button", { name: messages.captcha.retry }));

    await expect(fake.resets).toBe(1);
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

export const WithoutSiteKey: Story = {
  args: { siteKey: "" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-label]")).toBeNull();
  },
};
