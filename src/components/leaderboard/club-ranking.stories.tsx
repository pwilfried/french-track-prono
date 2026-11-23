import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { rankClubs } from "@/domain/club-ranking";

import { ClubRanking } from "./club-ranking";

// Invented clubs and players.
const of = (clubId: string, club: string, points: number[]) =>
  points.map((p, i) => ({
    userId: `${clubId}-${i}`,
    pseudo: `Démo joueur ${clubId}-${i + 1}`,
    clubId,
    club,
    points: p,
  }));
const longName = "Démo Entente Athlétique des Hauts-de-Seine et du Val-d'Oise";
const clubs = rankClubs([
  ...of("1", "Démo Gazelles", [130, 120, 125]),
  ...of("2", "Démo Foulées Bleues", [110, 112, 108, 114]),
  ...of("3", "Démo Stade Club", [140, 2, 3]),
  ...of("4", longName, [45, 20, 30]),
]);

const meta = {
  title: "Leaderboard/ClubRanking",
  component: ClubRanking,
  args: { clubs, myClub: { id: "4", name: longName }, meId: "4-0" },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClubRanking>;

export default meta;
type Story = StoryObj<typeof meta>;

/** « Ton club »: a long name wraps; rank, average and what the player brings. Rows folded. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("region", { name: "Ton club" });
    await expect(card).toHaveTextContent(longName);
    await expect(card).toHaveTextContent("4e sur 4");
    await expect(card).toHaveTextContent("👟 Tu en apportes 45");
    const list = canvas.getByRole("list", { name: "Classement des clubs" });
    await expect(within(list).getAllByRole("button")).toHaveLength(4);
    await expect(within(list).getAllByRole("button")[0]).toHaveAttribute("aria-expanded", "false");
    await expect(within(list).getAllByRole("button")[0]).toHaveTextContent("🥇");
    await expect(within(list).getAllByRole("button")[3]).toHaveTextContent("moy.");
    await expect(within(list).getAllByRole("listitem")[3]).toHaveAttribute("aria-current", "true");
  },
};

/** Touching a club unfolds its players with their points, best first; again folds them. */
export const Unfolded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button", { name: /Gazelles/ });
    await userEvent.click(row);
    await expect(row).toHaveAttribute("aria-expanded", "true");
    const players = canvas.getByRole("list", { name: "Joueurs de Démo Gazelles" });
    await expect(within(players).getAllByRole("listitem")[0]).toHaveTextContent("130 pts");
    await userEvent.click(row);
    await expect(canvas.queryByRole("list", { name: "Joueurs de Démo Gazelles" })).toBeNull();
  },
};

/** The player's club has too few players to be ranked. */
export const NotRanked: Story = {
  args: { myClub: { id: "9", name: "Démo Petit Club" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Démo Petit Club n'est pas encore classé/),
    ).toBeInTheDocument();
  },
};

/** No club yet, and no club ranked: a link to fill it in on the profile. */
export const Empty: Story = {
  args: { clubs: [], myClub: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", { name: "Ajoute ton club pour le faire grimper" }),
    ).toHaveAttribute("href", "/profil/modifier");
    await expect(canvas.getByText("Aucun club classé pour l'instant.")).toBeInTheDocument();
  },
};

/** A visitor: the clubs without « Ton club ». */
export const Visitor: Story = {
  args: { myClub: undefined, meId: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("region", { name: "Ton club" })).toBeNull();
  },
};
