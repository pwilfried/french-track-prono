import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { CompetitionSheet, type SheetCompetition } from "./competition-sheet";

const competition = (
  slug: string,
  name: string,
  startsOn: string,
  extra: Partial<SheetCompetition> = {},
): SheetCompetition => ({
  slug,
  name,
  city: "Paris",
  scope: "international",
  venue: "outdoor",
  startsOn,
  endsOn: startsOn,
  finals: 8,
  ...extra,
});

const competitions = [
  competition("meeting-fictif", "Meeting fictif", "2027-06-04", { city: "Rome" }),
  competition("france-elite", "Championnats de France fictifs", "2027-07-24", {
    scope: "france",
    city: "Angers",
    finals: 0,
  }),
  competition("salle", "Meeting fictif en salle", "2027-02-10", {
    venue: "indoor",
    city: "Liévin",
  }),
  competition("ligue", "Grand prix des amis", "2027-06-20", { city: "Lyon" }),
  competition("passe", "Meeting de l'an dernier", "2026-09-11"),
];

const meta = {
  title: "Events/CompetitionSheet",
  component: CompetitionSheet,
  args: {
    open: true,
    onClose: fn(),
    competitions,
    myLeagueSlugs: ["ligue"],
    selected: "meeting-fictif",
    today: "2027-01-15",
  },
} satisfies Meta<typeof CompetitionSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const sheet = () => within(document.body);

/** My leagues first, then by month, then the finished ones; the one shown is ticked. */
export const Default: Story = {
  play: async () => {
    const body = sheet();
    const dialog = await body.findByRole("dialog", { name: "Choisir une compétition" });
    const headings = within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    await expect(headings).toEqual([
      "Dans mes ligues",
      "février 2027",
      "juin 2027",
      "juillet 2027",
      "Terminées",
    ]);
    await expect(within(dialog).getByRole("link", { current: "page" })).toHaveTextContent(
      "Meeting fictif",
    );
    await expect(within(dialog).getByText("programme à venir")).toBeVisible();
    await expect(within(dialog).getByText("Salle")).toBeVisible();
  },
};

/** Search by city, then the France filter. */
export const SearchAndFilter: Story = {
  play: async () => {
    const dialog = await sheet().findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("searchbox"), "ange");
    await waitFor(() =>
      expect(
        within(dialog)
          .getAllByRole("link")
          .map((l) => l.textContent),
      ).toEqual([expect.stringContaining("Championnats de France fictifs")]),
    );
    await userEvent.clear(within(dialog).getByRole("searchbox"));
    await userEvent.click(within(dialog).getByRole("radio", { name: "Internationales" }));
    await expect(
      within(dialog).queryByText("Championnats de France fictifs"),
    ).not.toBeInTheDocument();
  },
};

/** The « Fermer » button closes it. */
export const Close: Story = {
  play: async ({ args }) => {
    const dialog = await sheet().findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Fermer" }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

/** Escape closes it too; the focus stays inside while it is open. */
export const CloseWithEscape: Story = {
  play: async ({ args }) => {
    const dialog = await sheet().findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("searchbox"));
    await expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
  },
};

/** Empty: nothing matches the search. */
export const NoMatch: Story = {
  play: async () => {
    const dialog = await sheet().findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("searchbox"), "zzz");
    await expect(within(dialog).getByText("Aucune compétition ne correspond.")).toBeVisible();
  },
};

/** Error: the competitions could not be read, the list is empty. */
export const Unavailable: Story = {
  args: { competitions: [] },
  play: async () => {
    const dialog = await sheet().findByRole("dialog");
    await expect(within(dialog).getByText("Aucune compétition ne correspond.")).toBeVisible();
  },
};

/** Loading: the sheet only opens once the page is there, closed it shows nothing. */
export const Closed: Story = {
  args: { open: false },
  play: async () => {
    await expect(sheet().queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** Long text: long names wrap inside the line, the tick stays visible. */
export const LongNames: Story = {
  args: {
    competitions: [
      competition(
        "long",
        "Championnats d'Europe d'athlétisme en salle des moins de 23 ans et des espoirs",
        "2027-03-05",
        { city: "Saint-Jean-de-Luz", venue: "indoor", scope: "france" },
      ),
    ],
    selected: "long",
    myLeagueSlugs: [],
  },
  play: async () => {
    const dialog = await sheet().findByRole("dialog");
    const line = within(dialog).getByRole("link");
    await expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth + 1);
  },
};
