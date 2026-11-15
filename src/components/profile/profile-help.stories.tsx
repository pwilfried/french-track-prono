import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { ProfileHelp } from "./profile-help";

const meta = {
  title: "Profile/ProfileHelp",
  component: ProfileHelp,
  decorators: [
    (Story) => (
      <div className="flex w-[390px] flex-col bg-brand-ink p-4 text-brand-foreground dark:bg-card dark:text-foreground">
        <p className="font-semibold text-secondary">Pas encore d&apos;animal</p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** Closed: one « C'est quoi ? » under the animal line. */
export const Closed: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "C'est quoi, l'animal et les badges ?" }),
    ).toBeVisible();
    await expect(body().queryByRole("dialog")).toBeNull();
  },
};

/** Open: a sheet over the profile names every animal and its family, then the badge levels. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "C'est quoi, l'animal et les badges ?" }),
    );
    const sheet = body().getByRole("dialog", { name: "L'animal et les badges" });
    await expect(within(sheet).getByRole("heading", { name: "Ton animal" })).toBeVisible();
    await expect(within(sheet).getByText(/Sprint/)).toBeVisible();
    await expect(within(sheet).getAllByRole("listitem")).toHaveLength(7);
    await expect(within(sheet).getByText(/en bronze, puis en argent, puis en or/)).toBeVisible();
    await userEvent.click(within(sheet).getByRole("button", { name: "Fermer" }));
    await expect(body().queryByRole("dialog")).toBeNull();
  },
};
