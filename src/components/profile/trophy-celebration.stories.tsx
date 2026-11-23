import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import type { Trophy } from "@/domain/trophies";

import { TrophyCelebration } from "./trophy-celebration";

const gold: Trophy = {
  userId: "me",
  season: 2026,
  kind: "league",
  metal: "gold",
  leagueId: "L",
  leagueName: "Ma Ligue",
  animal: "guepard",
};
const chrono: Trophy = { ...gold, kind: "chrono", metal: null, animal: null };

const meta = {
  title: "Profile/TrophyCelebration",
  component: TrophyCelebration,
  parameters: { layout: "fullscreen" },
  args: { trophies: [gold], onSeen: fn(async () => {}) },
} satisfies Meta<typeof TrophyCelebration>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One new trophy: stored as seen only when the player closes the celebration. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1er de Ma Ligue")).toBeInTheDocument();
    await expect(args.onSeen).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Poser dans ma vitrine 🏆" }));
    await expect(args.onSeen).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** Several trophies: one per screen, a counter, « Suivant » then « Poser dans ma vitrine ». */
export const Several: Story = {
  args: { trophies: [gold, chrono, { ...gold, kind: "manager", animal: "lievre" }] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 / 3")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Suivant 👉" }));
    await expect(canvas.getByText("Meilleure soirée de Ma Ligue")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Suivant 👉" }));
    await expect(canvas.getByText("3 / 3")).toBeInTheDocument();
    await expect(args.onSeen).not.toHaveBeenCalled();
  },
};

/** « Plus tard » closes from any screen and stores them too: they come once. */
export const Later: Story = {
  args: { trophies: [gold, chrono] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Plus tard" }));
    await expect(args.onSeen).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** Nothing new: no screen. */
export const Empty: Story = {
  args: { trophies: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** A long league name wraps instead of overflowing. */
export const LongText: Story = {
  args: {
    trophies: [
      { ...gold, leagueName: "Les anciens du club d'athlétisme de la vallée de la Loire" },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("dialog")).toHaveTextContent("vallée de la Loire");
  },
};
