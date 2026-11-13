import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ScopeButton } from "./scope-button";

// Invented league.
const meta = {
  title: "Leaderboard/ScopeButton",
  component: ScopeButton,
  args: {
    label: "Ligue",
    value: "Les Foulées du jeudi",
    detail: "8 joueurs",
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScopeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** « Ligue · <nom> · N joueurs » with « Changer », which opens the sheet. */
export const League: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Les Foulées du jeudi")).toBeVisible();
    await expect(canvas.getByText(/8 joueurs/)).toBeVisible();
    const change = canvas.getByRole("button", { name: /Changer de classement/ });
    await expect(change.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.click(change);
    await expect(args.onChange).toHaveBeenCalled();
  },
};

/** « Portée · Toute la saison 2026-27 » in « Général ». */
export const Season: Story = {
  args: { label: "Portée", value: "Toute la saison 2026-27", detail: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Toute la saison 2026-27")).toBeVisible();
  },
};

/** Empty: nothing else to choose, no « Changer ». */
export const NoChoice: Story = {
  args: { onChange: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { status: "loading" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("status", { name: "Chargement de la portée…" }),
    ).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: { status: "error" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "Les classements à choisir ne sont pas disponibles",
    );
  },
};

/** A long competition name wraps; « Changer » stays reachable. */
export const LongText: Story = {
  args: {
    label: "Portée",
    value: "Championnats d'Europe fictifs d'athlétisme en salle des moins de 23 ans",
    detail: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Changer de classement/ }),
    ).toBeVisible();
  },
};
