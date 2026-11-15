import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { ManagerTutorial } from "./manager-tutorial";

const text = messages.manager.tutorial;

const meta = {
  title: "Manager/ManagerTutorial",
  component: ManagerTutorial,
  args: { onClose: fn(), onLeave: fn() },
  decorators: [
    (Story) => (
      <div className="flex min-h-[760px] w-[390px] flex-col bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ManagerTutorial>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first screen: « 1 / 3 », the principle, no figure, nothing before it (#802). */
export const FirstStep: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.progress(1, 3))).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Deviens manager" })).toBeVisible();
    await expect(canvas.getByText(/Recrute des athlètes, aligne-les/)).toBeVisible();
    await expect(canvas.getByRole("region", { name: text.label })).not.toHaveTextContent(/\d{2}/);
    await expect(canvas.getByRole("button", { name: text.previous })).toBeDisabled();

    await userEvent.click(canvas.getByRole("button", { name: text.next }));
    await expect(canvas.getByText(text.progress(2, 3))).toBeVisible();
    await expect(canvas.getByText(/D'abord le mercato/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.previous }));
    await expect(canvas.getByText(text.progress(1, 3))).toBeVisible();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

/** The arrow keys move between the screens too. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("button", { name: text.next }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByText(text.progress(2, 3))).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByText(text.progress(1, 3))).toBeVisible();
  },
};

/** The navigation sits right under the content, not at the bottom of a tall screen (#709). */
export const NavigationUnderContent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dots = canvas.getByRole("list").getBoundingClientRect();
    const navigation = canvas.getByRole("navigation", { name: text.navLabel });
    const gap = navigation.getBoundingClientRect().top - dots.bottom;
    await expect(gap).toBeLessThanOrEqual(32);
  },
};

/** The last screen is the way in: « Créer » or « Rejoindre », no « Suivant » (#802). */
export const LastStep: Story = {
  args: { initialStep: 2 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.progress(3, 3))).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "À toi de jouer" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: text.next })).toBeNull();
    await expect(canvas.getByRole("link", { name: messages.manager.create })).toHaveAttribute(
      "href",
      "/manager/creer",
    );
    const join = canvas.getByRole("link", { name: messages.manager.joinWithCode });
    await expect(join).toHaveAttribute("href", "/manager/rejoindre");
    join.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await userEvent.click(join);
    await expect(args.onLeave).toHaveBeenCalledOnce();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

/** « Passer » closes it from any screen. */
export const Skip: Story = {
  args: { initialStep: 1 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.skipLabel }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

/** Dark theme: the presentation is night blue in both themes. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark flex min-h-[760px] w-[390px] flex-col bg-nuit">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.progress(1, 3))).toBeVisible();
  },
};

/** The narrowest screen, 320 px: the last screen and its buttons still fit. */
export const LongText: Story = {
  args: { initialStep: 2 },
  decorators: [
    (Story) => (
      <div className="flex min-h-[760px] w-[320px] flex-col bg-background">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const step = within(canvasElement).getByRole("region", { name: text.label });
    await expect(step.scrollWidth).toBeLessThanOrEqual(step.clientWidth);
  },
};
