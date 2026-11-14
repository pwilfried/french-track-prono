import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { ManagerIntro } from "./manager-intro";

const text = messages.manager.intro;

const meta = {
  title: "Manager/ManagerIntro",
  component: ManagerIntro,
  args: {
    figures: {
      budget: 250,
      minTeamSize: 12,
      lineupMax: 8,
      winBonus: 10,
      leagueMin: 4,
      leagueMax: 10,
      minCompetitions: 6,
    },
    skipHref: "/manager?passer=1",
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[760px] w-[390px] flex-col bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ManagerIntro>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five numbered steps whose figures come from the rules, then the two ways in. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.manager.title,
    );
    const steps = within(canvas.getByRole("list", { name: text.stepsLabel }));
    await expect(steps.getAllByRole("listitem")).toHaveLength(5);
    await expect(steps.getByText(/250 crédits pour recruter au moins 12 athlètes/)).toBeVisible();
    await expect(steps.getByText(/jusqu'à 8 athlètes/)).toBeVisible();
    await expect(steps.getByText(/\+10 pour une victoire/)).toBeVisible();
    await expect(canvas.getByRole("link", { name: text.create })).toHaveAttribute(
      "href",
      "/manager/creer",
    );
    await expect(canvas.getByRole("link", { name: text.haveCode })).toHaveAttribute(
      "href",
      "/manager/rejoindre",
    );
    await expect(canvas.getByRole("link", { name: text.skipLabel })).toHaveAttribute(
      "href",
      "/manager?passer=1",
    );
  },
};

/** Dark theme: the page is night blue too, the screen stays the same. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="flex min-h-[760px] w-[390px] flex-col bg-nuit">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link", { name: text.create })).toBeVisible();
  },
};

/** Large figures still wrap inside the 390 px screen. */
export const LongText: Story = {
  args: {
    figures: {
      budget: 1234567,
      minTeamSize: 123,
      lineupMax: 99,
      winBonus: 1000,
      leagueMin: 4,
      leagueMax: 10,
      minCompetitions: 6,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/1234567 crédits/)).toBeVisible();
    const list = canvas.getByRole("list", { name: text.stepsLabel });
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  },
};
