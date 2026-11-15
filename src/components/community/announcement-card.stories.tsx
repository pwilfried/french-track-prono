import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { AnnouncementCard } from "./announcement-card";
import { competitionOpen, episode } from "./fixtures";

const text = messages.community.announcement;

const meta = {
  title: "Community/AnnouncementCard",
  component: AnnouncementCard,
  args: { announcement: episode },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnnouncementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new episode: the night-blue card, and where to listen to it in a new tab. */
export const Episode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.label.episode)).toBeVisible();
    const listen = canvas.getByRole("link", {
      name: messages.legal.footer.opensNewTab(text.listen),
    });
    await expect(listen).toHaveAttribute("href", episode.link);
    await expect(listen).toHaveAttribute("target", "_blank");
  },
};

/** A competition opening: a page of the app, opened here. */
export const CompetitionOpen: Story = {
  args: { announcement: competitionOpen },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.label.competition_open)).toBeVisible();
    await expect(canvas.getByRole("link", { name: text.see })).toHaveAttribute(
      "href",
      "/competitions",
    );
  },
};

/** A schedule published, without subtitle nor link: only the title. */
export const WithoutLink: Story = {
  args: {
    announcement: {
      ...competitionOpen,
      kind: "schedule",
      title: "Le programme de Paris",
      subtitle: null,
      link: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link")).toBeNull();
  },
};

/** The longest title and subtitle wrap at 390 px. */
export const LongText: Story = {
  args: {
    announcement: { ...episode, title: "É".repeat(60), subtitle: "Pronostic ".repeat(12).trim() },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
