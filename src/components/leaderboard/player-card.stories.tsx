import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { PlayerCard } from "./player-card";

// Invented player and club.
const meta = {
  title: "Leaderboard/PlayerCard",
  component: PlayerCard,
  args: { pseudo: "Démo Gazelle", avatar: "🦌", club: "Foulées de Fictiville", rank: 3, total: 12 },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-card p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pseudo, avatar, club and rank: nothing else. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: "Fiche de Démo Gazelle" });
    await expect(card).toHaveTextContent("Foulées de Fictiville");
    await expect(card).toHaveTextContent("3e sur 12 joueurs");
    await expect(card).not.toHaveTextContent("@");
  },
};

/** A player who gave no club (empty state). */
export const NoClub: Story = {
  args: { club: null, rank: 1, total: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Club non renseigné")).toBeInTheDocument();
    await expect(canvas.getByText("1er sur 1 joueur")).toBeInTheDocument();
  },
};

/** A long pseudo and a long club name wrap inside the card. */
export const LongText: Story = {
  args: {
    pseudo: "Maximilienne-Augustine_du_Stade",
    club: "Association Sportive Athlétique Intercommunale de la Vallée de Fictiville et Environs",
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
  },
};
