import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { rankClubs } from "@/domain/club-ranking";

import { ClubRanking } from "./club-ranking";

// Invented clubs.
const players = [
  ...[30, 20, 25].map((points) => ({ clubId: "1", club: "Démo Athlé Gazelles", points })),
  ...[10, 12, 8, 14].map((points) => ({ clubId: "2", club: "Démo Foulées Bleues", points })),
  ...[40, 2, 3].map((points) => ({ clubId: "3", club: "Démo Stade Club", points })),
  ...[1, 2, 3].map((points) => ({
    clubId: "4",
    club: "Démo Entente Athlétique des Hauts-de-Seine et du Val-d'Oise",
    points,
  })),
];
const clubs = rankClubs(players);

const meta = {
  title: "Profile/ClubRanking",
  component: ClubRanking,
  args: { clubs, myClub: { id: "4", name: clubs[3]!.name } },
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

/** My club is 4th, below the podium; a long club name wraps. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent("Démo Athlé Gazelles");
    await expect(canvas.getByText(/4e sur 4/)).toBeInTheDocument();
  },
};

/** My club is on the podium: its line is highlighted. */
export const OnThePodium: Story = {
  args: { myClub: { id: "3", name: "Démo Stade Club" } },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");
    await expect(items[1]).toHaveAttribute("aria-current", "true");
  },
};

/** My club does not have enough players yet. */
export const NotRanked: Story = {
  args: { myClub: { id: "9", name: "Démo Petit Club" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Démo Petit Club n'est pas encore classé/),
    ).toBeInTheDocument();
  },
};

/** No club yet, and no club ranked. */
export const Empty: Story = {
  args: { clubs: [], myClub: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", { name: "Ajoute ton club pour le faire grimper" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Aucun club classé pour l'instant.")).toBeInTheDocument();
  },
};
