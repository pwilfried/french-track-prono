import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { ShareInvite } from "./share-invite";

const text = messages.leagues;

const meta = {
  title: "Leagues/ShareInvite",
  component: ShareInvite,
  args: { code: "K7M2QX", leagueName: "Les Foulées" },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShareInvite>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Private league: the code, the share button and the copy button. */
export const Private: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("K7M 2QX")).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.share })).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.copy })).toBeVisible();
  },
};

/** Public league: the link only, no code and no « Copier le code » button. */
export const Public: Story = {
  args: { isPublic: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: text.share })).toBeVisible();
    await expect(canvas.getByText(text.publicLinkNote)).toBeVisible();
    await expect(canvas.queryByText("K7M 2QX")).toBeNull();
    await expect(canvas.queryByText(text.codeCaption)).toBeNull();
    await expect(canvas.queryByRole("button", { name: text.copy })).toBeNull();
  },
};
