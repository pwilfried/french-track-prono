import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { buttonVariants } from "./button";

/** Checks that the text of each link stays inside the box of its link (#701). */
async function expectLabelsInside(canvasElement: HTMLElement) {
  const links = within(canvasElement).getAllByRole("link");
  for (const link of links) {
    const range = document.createRange();
    range.selectNodeContents(link);
    const label = range.getBoundingClientRect();
    const box = link.getBoundingClientRect();
    await expect(label.left).toBeGreaterThanOrEqual(box.left);
    await expect(label.right).toBeLessThanOrEqual(box.right);
    await expect(label.top).toBeGreaterThanOrEqual(box.top);
    await expect(label.bottom).toBeLessThanOrEqual(box.bottom);
    await expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

function Buttons({ labels }: { labels: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {labels.map((label, i) => (
        <a
          key={label}
          href="#"
          className={buttonVariants({ variant: i === 0 ? "default" : "outline" })}
        >
          {label}
        </a>
      ))}
    </div>
  );
}

const meta = {
  title: "UI/Button",
  component: Buttons,
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Buttons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoPerRow: Story = {
  args: { labels: ["Créer", "J'ai un code"] },
  play: async ({ canvasElement }) => expectLabelsInside(canvasElement),
};

/** Two long labels side by side at 320 px: each wraps inside its button. */
export const LongText: Story = {
  args: { labels: [messages.prediction.leagueCreate, messages.prediction.leagueCreatePublic] },
  play: async ({ canvasElement }) => expectLabelsInside(canvasElement),
};
