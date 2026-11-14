import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { BADGES, progressOf } from "@/domain/badges";

import { ProfileStart } from "./profile-start";

const meta = {
  title: "Profile/ProfileStart",
  component: ProfileStart,
  args: {
    predictions: 0,
    finalSlug: "uc26-100m-f",
    progress: BADGES.map((badge) => progressOf(badge, 0)),
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileStart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** « Profil vide »: one card, the next badge only (no greyed bibs) and the next open final. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Fais ton premier prono pour débloquer tes stats" }),
    ).toBeVisible();
    await expect(canvas.getByText("Prochain : Fidèle, le bronze (encore 1)")).toBeVisible();
    await expect(canvas.queryByRole("listitem")).toBeNull();
    await expect(canvas.getByRole("link", { name: "Faire mon podium" })).toHaveAttribute(
      "href",
      "/epreuves/uc26-100m-f",
    );
  },
};

/** The same card in the dark theme. */
export const EmptyDark: Story = {
  decorators: [
    (Story) => (
      <div className="dark w-[390px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
};

/** Predictions saved, none computed yet: the card waits for the first result. */
export const Waiting: Story = {
  args: { predictions: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Tes stats arrivent bientôt" })).toBeVisible();
    await expect(canvas.getByText(/2 pronos enregistrés/)).toBeVisible();
  },
};

/** No final open: the button sends to the competitions. */
export const NoOpenFinal: Story = {
  args: { finalSlug: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Voir les compétitions" }),
    ).toHaveAttribute("href", "/competitions");
  },
};

/** The badges cannot be read (error): the card stays, without the next badge. */
export const BadgesError: Story = {
  args: { progress: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/Prochain :/)).toBeNull();
  },
};

/** Long text at 320 px: nothing overflows. */
export const LongText: Story = {
  args: { predictions: 128 },
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("section")!;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
