import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { episode } from "@/components/community/fixtures";

import { PodcastCard } from "./podcast-card";

const text = messages.playerHome.frenchTrack;
const announcement = messages.community.announcement;
const newTab = messages.legal.footer.opensNewTab;

const meta = {
  title: "Home/PodcastCard",
  component: PodcastCard,
  args: { episode: null },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PodcastCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No episode announced: the podcast's page, and FrenchTrack's accounts. */
export const NoEpisode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.title })).toBeVisible();
    await expect(canvas.getByRole("link", { name: newTab(text.listen) })).toHaveAttribute(
      "href",
      "https://podcastics.com/podcast/french-track",
    );
    await expect(canvas.queryByText(announcement.label.episode)).toBeNull();
    await expect(canvas.getByRole("link", { name: newTab("Instagram") })).toBeVisible();
  },
};

/** A new episode announced: its label, title, subtitle and the one « Écouter » button to it. */
export const Episode: Story = {
  args: { episode },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(announcement.label.episode)).toBeVisible();
    await expect(canvas.getByRole("heading", { name: episode.title })).toBeVisible();
    await expect(canvas.getByText(episode.subtitle!)).toBeVisible();
    await expect(canvas.getAllByRole("link", { name: /Écouter/ })).toHaveLength(1);
    await expect(canvas.getByRole("link", { name: newTab(announcement.listen) })).toHaveAttribute(
      "href",
      episode.link!,
    );
    await expect(canvas.getByRole("link", { name: newTab("TikTok") })).toBeVisible();
  },
};

/** The longest title (60 characters), no subtitle: it wraps at 390 px. */
export const LongTitle: Story = {
  args: {
    episode: {
      ...episode,
      title: "Épisode 128 : les championnats d'Europe de cross décortiqués",
      subtitle: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
