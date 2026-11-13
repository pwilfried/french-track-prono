import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import type { SheetCompetition } from "../events/competition-sheet";
import { ScopeSheet } from "./scope-sheet";

const competition = (
  slug: string,
  name: string,
  startsOn: string,
  endsOn: string,
): SheetCompetition => ({
  slug,
  name,
  city: "Paris",
  scope: "international",
  venue: "outdoor",
  startsOn,
  endsOn,
  finals: 8,
});

// Invented competitions and leagues.
const meta = {
  title: "Leaderboard/ScopeSheet",
  component: ScopeSheet,
  args: {
    open: true,
    onClose: fn(),
    tab: "competitions",
    competitions: [
      competition("a-venir", "Meeting fictif à venir", "2027-06-04", "2027-06-04"),
      competition("en-cours", "Meeting fictif en cours", "2027-01-14", "2027-01-16"),
      competition("passe", "Meeting de l'an dernier", "2026-09-11", "2026-09-13"),
    ],
    competition: null,
    seasonLabel: "Toute la saison 2026-27",
    today: "2027-01-15",
    leagues: [
      {
        id: "l1",
        name: "Les Foulées du jeudi",
        memberCount: 8,
        rank: 2,
        competitions: 3,
      },
      { id: "l2", name: "Bureau", memberCount: 3, rank: null, competitions: 1 },
    ],
    league: "l1",
  },
} satisfies Meta<typeof ScopeSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** « Toute la saison » first, then in progress, then finished; never the coming ones. */
export const Competitions: Story = {
  play: async () => {
    const dialog = await body().findByRole("dialog", { name: "Choisir le classement" });
    const sheet = within(dialog);
    await expect(sheet.getByRole("tab", { name: "Saison ou compétition" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(sheet.getByRole("link", { current: "page" })).toHaveTextContent(
      "Toute la saison 2026-27",
    );
    await expect(sheet.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "En cours",
      "Terminées",
    ]);
    await expect(sheet.queryByText("Meeting fictif à venir")).not.toBeInTheDocument();
    await userEvent.type(sheet.getByRole("searchbox"), "an dernier");
    await expect(sheet.getByRole("link", { name: /Meeting de l'an dernier/ })).toHaveAttribute(
      "href",
      "/classement?vue=general&competition=passe",
    );
  },
};

/** « Mes ligues »: my rank, the number of players, the league shown ticked. */
export const Leagues: Story = {
  args: { tab: "leagues" },
  play: async () => {
    const dialog = await body().findByRole("dialog", { name: "Choisir le classement" });
    const sheet = within(dialog);
    const shown = sheet.getByRole("link", { current: "page" });
    await expect(shown).toHaveTextContent("Les Foulées du jeudi");
    await expect(shown).toHaveTextContent("2e sur 8");
    await expect(sheet.getByRole("link", { name: /Bureau/ })).toHaveTextContent(
      "Pas encore classé · 3 joueurs",
    );
    await expect(sheet.getByRole("link", { name: "Créer ou rejoindre une ligue" })).toBeVisible();
  },
};

/** Empty: no league yet, and a search that finds nothing. */
export const Empty: Story = {
  args: { leagues: [], tab: "leagues" },
  play: async () => {
    const dialog = await body().findByRole("dialog", { name: "Choisir le classement" });
    const sheet = within(dialog);
    await expect(sheet.getByText(/Tu n'as pas encore de ligue/)).toBeVisible();
    await userEvent.click(sheet.getByRole("tab", { name: "Saison ou compétition" }));
    await userEvent.type(sheet.getByRole("searchbox"), "zzz");
    await expect(sheet.getByText("Aucune compétition ne correspond.")).toBeVisible();
  },
};

/** A visitor: competitions only, no tabs. */
export const Visitor: Story = {
  args: { leagues: undefined },
  play: async () => {
    const dialog = await body().findByRole("dialog", { name: "Choisir le classement" });
    await expect(within(dialog).queryByRole("tab")).not.toBeInTheDocument();
  },
};

/** A long league name wraps. */
export const LongText: Story = {
  args: {
    tab: "leagues",
    leagues: [
      {
        id: "l1",
        name: "La ligue des amis du stade municipal de Fictiville et de ses environs",
        memberCount: 200,
        rank: 117,
        competitions: 42,
      },
    ],
  },
  play: async () => {
    const dialog = await body().findByRole("dialog", { name: "Choisir le classement" });
    await expect(within(dialog).getByText(/117e sur 200 · 42 compétitions/)).toBeVisible();
  },
};
