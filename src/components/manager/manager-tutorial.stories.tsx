import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { ManagerTutorial } from "./manager-tutorial";

const text = messages.manager.tutorial;

const meta = {
  title: "Manager/ManagerTutorial",
  component: ManagerTutorial,
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
    onClose: fn(),
  },
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

/** The first step: « 1 / 7 », the players set by the competitions (#644), nothing before it. */
export const FirstStep: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.progress(1, 7))).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Une ligue entre amis" })).toBeVisible();
    await expect(
      canvas.getByText(/au moins 6 compétitions : elles fixent le nombre de joueurs, de 4 à 10/),
    ).toBeVisible();
    await expect(canvas.queryByText(/en nombre pair/)).toBeNull();
    await expect(canvas.getByRole("button", { name: text.previous })).toBeDisabled();

    await userEvent.click(canvas.getByRole("button", { name: text.next }));
    await expect(canvas.getByText(text.progress(2, 7))).toBeVisible();
    await expect(canvas.getByText(/Tu as 250 crédits/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.previous }));
    await expect(canvas.getByText(text.progress(1, 7))).toBeVisible();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

/** The arrow keys move between the steps too. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("button", { name: text.next }).focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(canvas.getByText(text.progress(3, 7))).toBeVisible();
    await expect(canvas.getByText(/Au moins 12 athlètes/)).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByText(text.progress(2, 7))).toBeVisible();
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

/** The head-to-heads, and the bonus matchdays at the end (#644). */
export const Matchdays: Story = {
  args: { initialStep: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/victoire 3 points, nul 1, défaite 0/)).toBeVisible();
    await expect(canvas.getByText(/journées bonus : des points, sans confrontation/)).toBeVisible();
  },
};

/** The last step ends on « C'est parti », which closes the tutorial. */
export const LastStep: Story = {
  args: { initialStep: 6 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.progress(7, 7))).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Deviens champion" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: text.next })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: text.done }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

/** « Passer » closes it from any step. */
export const Skip: Story = {
  args: { initialStep: 3 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/jusqu'à 8 titulaires/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.skipLabel }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

/** Dark theme: the tutorial is night blue in both themes. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark flex min-h-[760px] w-[390px] flex-col bg-nuit">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.progress(1, 7))).toBeVisible();
  },
};

/** Large figures still wrap inside the 390 px screen. */
export const LongText: Story = {
  args: {
    initialStep: 4,
    figures: {
      budget: 1234567,
      minTeamSize: 123,
      lineupMax: 99,
      winBonus: 100000,
      leagueMin: 4,
      leagueMax: 10,
      minCompetitions: 6,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/\+100000 pour une victoire/)).toBeVisible();
    const step = canvas.getByRole("region", { name: text.label });
    await expect(step.scrollWidth).toBeLessThanOrEqual(step.clientWidth);
  },
};
