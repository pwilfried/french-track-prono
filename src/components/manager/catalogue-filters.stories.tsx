import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { CatalogueFilters, type FilterChip } from "./catalogue-filters";

const chip = (name: string, active = false): FilterChip => ({
  key: name,
  name,
  href: "#",
  active,
});

const base = {
  sort: { label: "Trier", options: [chip("Prix ↓", true), chip("Prix ↑"), chip("Nom")] },
  families: {
    label: "Famille",
    chips: [
      chip("Tous", true),
      chip("Sprint"),
      chip("Demi-fond/fond"),
      chip("Sauts · 1 manquant"),
      chip("Lancers · 2 manquants"),
    ],
  },
  disciplines: { label: "Épreuve", chips: [] as FilterChip[] },
  sexes: { label: "Sexe", chips: [chip("F"), chip("H")] },
  toggles: {
    label: "Autres filtres",
    chips: [chip("Dans mon budget"), chip("Disponibles", true), chip("Mes enchères")],
  },
  clear: null,
};

const meta = {
  title: "Manager/CatalogueFilters",
  component: CatalogueFilters,
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CatalogueFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No filter beyond the default ones: no clear link. */
export const None: Story = {
  args: base,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByText("Effacer les filtres")).toBeNull();
    await expect(c.getByText("Prix ↓")).toHaveAttribute("aria-current", "page");
  },
};

/** A family, a discipline, a sex and the budget at once. */
export const Several: Story = {
  args: {
    ...base,
    families: {
      ...base.families,
      chips: base.families.chips.map((c) => ({ ...c, active: c.name === "Sprint" })),
    },
    disciplines: { label: "Épreuve", chips: [chip("100 m"), chip("200 m", true), chip("400 m")] },
    sexes: { label: "Sexe", chips: [chip("F", true), chip("H")] },
    toggles: {
      label: "Autres filtres",
      chips: [chip("Dans mon budget", true), chip("Disponibles", true), chip("Mes enchères")],
    },
    clear: { name: "Effacer les filtres", href: "#" },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("200 m")).toHaveAttribute("aria-current", "page");
    await expect(c.getByText("Effacer les filtres")).toBeVisible();
  },
};

/** A filter that leaves the list empty: the clear link is the way out. */
export const EmptyList: Story = {
  args: {
    ...base,
    toggles: {
      label: "Autres filtres",
      chips: [chip("Dans mon budget"), chip("Disponibles", true), chip("Mes enchères", true)],
    },
    clear: { name: "Effacer les filtres", href: "#" },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Effacer les filtres")).toBeVisible();
  },
};
