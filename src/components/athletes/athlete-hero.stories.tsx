import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AthleteHero } from "./athlete-hero";

const meta = {
  title: "Athletes/AthleteHero",
  component: AthleteHero,
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AthleteHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithEmojiAvatar: Story = {
  args: {
    name: "Sha'Carri Richardson",
    flag: "🇺🇸",
    country: "États-Unis",
    gender: "F",
    avatar: "🏃‍♀️",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Sha'Carri/)).toBeInTheDocument();
  },
};

export const WithMixedRelay: Story = {
  args: {
    name: "Relais 4 × 400 m mixte — France",
    flag: "🇫🇷",
    country: "France",
    gender: "X",
    avatar: "🏃",
  },
};

export const LongName: Story = {
  args: {
    name: "Alexandrina Montgomery-Featherstonehaugh",
    flag: "🇬🇧",
    country: "Royaume-Uni",
    gender: "F",
  },
};
