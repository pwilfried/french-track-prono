import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { FirstLineupCard } from "./first-lineup-card";

const text = messages.lineup.first;

const meta = {
  title: "Manager/FirstLineupCard",
  component: FirstLineupCard,
  args: {
    href: "/manager/l1/alignement/meeting",
    rulesLines: text.rulesLines(10, 5),
    done: { starters: false, bench: false, tactical: false, validate: false },
    current: "starters",
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FirstLineupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing done: four steps, the button leads to the current one. */
export const Start: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.title })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    await expect(canvas.getByRole("link", { name: text.go })).toHaveAttribute(
      "href",
      "/manager/l1/alignement/meeting",
    );
  },
};

/** Starters and bench ticked: the player is on the validation. */
export const AlmostThere: Story = {
  args: {
    done: { starters: true, bench: true, tactical: false, validate: false },
    current: "validate",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(text.done(text.steps.starters))).toBeVisible();
    await expect(canvas.getByLabelText(text.todo(text.steps.validate))).toHaveAttribute(
      "aria-current",
      "step",
    );
  },
};

/** The rules sheet opens over the card. */
export const RulesSheet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.rules }));
    await expect(await within(document.body).findByText(/divisés par 10/)).toBeVisible();
  },
};
