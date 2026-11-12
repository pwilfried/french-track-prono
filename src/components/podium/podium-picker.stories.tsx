import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import type { Entry } from "@/domain/event";
import { OTHER_ATHLETE } from "@/domain/podium-draft";

import { PodiumPicker, type PickerAthlete } from "./podium-picker";

const entry = (athleteId: string, name: string, countryCode: string): Entry => ({
  athleteId,
  slug: athleteId,
  name,
  countryCode,
  seasonBest: null,
});

// Invented athletes.
const athletes = [
  entry("lena", "Lena Okoro", "NGR"),
  entry("mateo", "Mateo Ruiz", "ESP"),
  entry("ines", "Ines Barbier", "FRA"),
  entry("kofi", "Kofi Mensah", "GHA"),
  entry("aiko", "Aiko Tanabe", "JPN"),
];

const meta = {
  title: "Podium/PodiumPicker",
  component: PodiumPicker,
  args: { athletes },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background py-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PodiumPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const athlete = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement).getByRole("button", { name: new RegExp(`^${name}`) });
const step = (canvasElement: HTMLElement, place: string) =>
  within(canvasElement).getByRole("button", { name: new RegExp(`^${place} place`) });

/** Nothing placed: the winner's step is selected. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(step(canvasElement, "1re")).toHaveAttribute("aria-pressed", "true");
    await expect(within(canvasElement).getAllByText("Touche un athlète")).toHaveLength(3);
  },
};

/** Tapping athletes fills the steps in order: 1st, 2nd, 3rd. */
export const PlacingInOrder: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(athlete(canvasElement, "Lena Okoro"));
    await userEvent.click(athlete(canvasElement, "Ines Barbier"));
    await userEvent.click(athlete(canvasElement, "Mateo Ruiz"));
    await expect(step(canvasElement, "1re")).toHaveAccessibleName("1re place : Lena Okoro");
    await expect(step(canvasElement, "2e")).toHaveAccessibleName("2e place : Ines Barbier");
    await expect(step(canvasElement, "3e")).toHaveAccessibleName("3e place : Mateo Ruiz");
  },
};

/** Two placed, the third step is the next one. */
export const Partial: Story = {
  args: { initialDraft: { first: "lena", second: "ines", third: null } },
  play: async ({ canvasElement }) => {
    await expect(step(canvasElement, "3e")).toHaveAttribute("aria-pressed", "true");
  },
};

/** Complete podium: tapping a placed athlete removes him, the empty step is filled next. */
export const Complete: Story = {
  args: { initialDraft: { first: "lena", second: "ines", third: "mateo" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(athlete(canvasElement, "Ines Barbier"));
    await expect(step(canvasElement, "2e")).toHaveAccessibleName("2e place : vide");
    await userEvent.click(athlete(canvasElement, "Kofi Mensah"));
    await expect(step(canvasElement, "2e")).toHaveAccessibleName("2e place : Kofi Mensah");
  },
};

/** Selecting a step then a placed athlete moves him there: an athlete is never on two steps. */
export const MovingNoDuplicate: Story = {
  args: { initialDraft: { first: "lena", second: "ines", third: "mateo" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(step(canvasElement, "1re"));
    await userEvent.click(athlete(canvasElement, "Mateo Ruiz"));
    await expect(step(canvasElement, "1re")).toHaveAccessibleName("1re place : Mateo Ruiz");
    await expect(step(canvasElement, "3e")).toHaveAccessibleName("3e place : Lena Okoro");
    await expect(within(canvasElement).getAllByText("Mateo Ruiz")).toHaveLength(2);
  },
};

/** Very long names wrap inside the steps and the list. */
export const LongNames: Story = {
  args: {
    athletes: [
      entry("a", "Maximilienne-Augustine Vandenberghe-Lefèvre", "BEL"),
      entry("b", "Oluwaseun Adebayo-Okonkwo", "NGR"),
      entry("c", "Kristóf Szentgyörgyi-Bartholomeusz", "HUN"),
      entry("d", "Ana", "POR"),
    ],
    initialDraft: { first: "a", second: "b", third: "c" },
  },
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole("button");
    for (const button of buttons) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  },
};

/** An error from the server is shown under the podium. */
export const WithError: Story = {
  args: {
    initialDraft: { first: "lena", second: "ines", third: "mateo" },
    error: "Tu as déjà utilisé ton joker dans cette compétition.",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("joker");
  },
};

/** Locked: read only. */
export const Disabled: Story = {
  args: { initialDraft: { first: "lena", second: "ines", third: "mateo" }, disabled: true },
  play: async ({ canvasElement }) => {
    await expect(athlete(canvasElement, "Kofi Mensah")).toBeDisabled();
  },
};

// With odds: five proposed athletes (favourite first), their PR and SB, and « autre athlète ».
const withOdds: PickerAthlete[] = [
  { ...athletes[0]!, odds: 1.8, personalBest: "10.98", seasonBest: "11.04" },
  { ...athletes[1]!, odds: 2.5, personalBest: "11.02", seasonBest: "11.10" },
  { ...athletes[2]!, odds: 3, personalBest: "11.15", seasonBest: null },
  { ...athletes[3]!, odds: 4, personalBest: null, seasonBest: "11.31" },
  { ...athletes[4]!, odds: 5, personalBest: "11.31", seasonBest: "11.35" },
  {
    athleteId: OTHER_ATHLETE,
    slug: OTHER_ATHLETE,
    name: "Autre athlète",
    countryCode: "",
    seasonBest: null,
    odds: 8,
    personalBest: null,
  },
];

/** With odds: « autre athlète » takes a place like an athlete, and only one. */
export const WithOdds: Story = {
  args: { athletes: withOdds },
  play: async ({ canvasElement }) => {
    await expect(athlete(canvasElement, "Lena Okoro")).toHaveAccessibleName(/cote 1,80$/);
    await userEvent.click(athlete(canvasElement, "Autre athlète"));
    await userEvent.click(athlete(canvasElement, "Lena Okoro"));
    await expect(step(canvasElement, "1re")).toHaveAccessibleName("1re place : Autre athlète");
    await expect(step(canvasElement, "2e")).toHaveAccessibleName("2e place : Lena Okoro");
    await expect(within(canvasElement).getByText("×8,00")).toBeVisible();
  },
};

/** Each athlete opens their page (#336), except « autre athlète »; the tap still places them. */
export const WithAthletePages: Story = {
  args: {
    athletes: withOdds,
    athleteHref: (a: PickerAthlete) => `/athletes/${a.slug}`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Fiche de Lena Okoro" })).toHaveAttribute(
      "href",
      "/athletes/lena",
    );
    await expect(canvas.queryByRole("link", { name: /Fiche de Autre athlète/ })).toBeNull();
    await userEvent.click(athlete(canvasElement, "Lena Okoro"));
    await expect(step(canvasElement, "1re")).toHaveAccessibleName("1re place : Lena Okoro");
  },
};

/** The help link says what it opens, in words and not only with « ? » (#494). */
export const WithHelp: Story = {
  args: { helpHref: "/regles" },
  play: async ({ canvasElement }) => {
    const help = within(canvasElement).getByRole("link", { name: "Comment jouer : les règles" });
    await expect(help).toHaveAttribute("href", "/regles");
    await expect(help).toHaveTextContent("Règles");
  },
};
