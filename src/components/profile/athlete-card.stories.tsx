import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AthleteCard } from "./athlete-card";

const meta = {
  title: "Profile/AthleteCard",
  component: AthleteCard,
  decorators: [
    (Story) => (
      <div className="w-[390px]">
        <Story />
      </div>
    ),
  ],
  args: {
    pseudo: "Lièvre du dimanche",
    bib: { number: 42, color: "blue" },
    animal: "guepard",
    club: "Athlé Paris",
    since: "12 sept. 2026",
    figures: { points: 184, rank: 42, players: 1243 },
  },
} satisfies Meta<typeof AthleteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Animal, bib, club, the two figures and the two actions. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement);
    await expect(card.getByRole("link", { name: "Modifier mon dossard" })).toHaveAttribute(
      "href",
      "/profil/modifier",
    );
    await expect(card.getByText("42e")).toBeVisible();
    await expect(card.getByText("sur 1 243 joueurs")).toBeVisible();
    await expect(card.getByRole("link", { name: "✏️ Modifier" })).toBeVisible();
  },
};

/** A very long pseudo wraps instead of overflowing. */
export const LongPseudo: Story = {
  args: { pseudo: "Supercalifragilisticexpialidocious-du-stade-de-France-2026" },
};

/** No validated club: the line keeps only the date. */
export const NoClub: Story = {
  args: { club: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/🏟️/)).toBeNull();
  },
};

/** No animal yet: the locked hare and the invitation. */
export const NoAnimal: Story = { args: { animal: null } };

/** Not ranked yet. */
export const NotRanked: Story = {
  args: { figures: { points: 0, rank: null, players: 1243 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Pas encore classé")).toBeVisible();
  },
};

/** New player: no figures, the edit button alone. */
export const NewPlayer: Story = { args: { figures: null } };
