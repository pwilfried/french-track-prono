import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { InviteBanner } from "./invite-banner";

const text = messages.leagues;

const meta = {
  title: "Leagues/InviteBanner",
  component: InviteBanner,
  args: { code: "K7M2QX", leagueName: "Les Foulées" },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InviteBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Alone in the league: one big button, the code in small underneath. */
export const Alone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.aloneTitle })).toBeVisible();
    const button = canvas.getByRole("button", { name: text.inviteFriends });
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(canvas.getByText(text.orGiveCode("K7M 2QX"))).toBeVisible();
  },
};

/** Without a share sheet, the link is copied and the player is told so. */
export const CopiesTheLink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => undefined },
      configurable: true,
    });
    await userEvent.click(canvas.getByRole("button", { name: text.inviteFriends }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(text.linkCopied);
  },
};

/** A long league name does not change the banner: it is only in the shared text. */
export const LongText: Story = {
  args: { leagueName: "Les Gazelles infatigables de la Vallée de la Haute-Testrivière" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = canvas.getByRole("region", { name: text.aloneTitle });
    await expect(banner.scrollWidth).toBeLessThanOrEqual(banner.clientWidth + 1);
  },
};
